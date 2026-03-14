import { replyText, replyWithQuickReply, getImageAsBase64, pushMessage } from '../services/lineService.js';
import { describeImage, askClaude } from '../services/claudeService.js';
import { getStore, savePendingImageContext, clearPendingImageContext, uploadImageToStorage, setPendingCommand, clearPendingCommand, savePostHistory } from '../services/supabaseService.js';
import { getBlendedInsights, saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { getPersonalizationPromptAddition } from '../services/personalizationEngine.js';
import { getAdvancedPersonalizationPrompt, autoRegeneratePersonaIfNeeded } from '../services/advancedPersonalization.js';
import { getSeasonalMemoryPromptAddition } from '../services/seasonalMemoryService.js';
import { extractInsightsFromScreenshot } from '../services/insightsOCRService.js';
import { applyEngagementMetrics, getRecentPostHistory } from './reportHandler.js';
import { detectContentCategory } from '../utils/contentCategoryDetector.js';
import { checkGenerationLimit, isFeatureEnabled } from '../services/subscriptionService.js';
import { isDevTestStore } from './adminHandler.js';
import { buildImagePostPrompt, buildStrategicAdvice } from '../utils/promptBuilder.js';
import { getGlobalPromptRules } from '../services/promptTuningService.js';
import { getRevisionExample } from '../utils/categoryExamples.js';
import { extractSelectedProposal } from './proposalHandler.js';


/**
 * describeImage出力から観察視点（[① カテゴリ] 内容）をパースし、5項目観察と分離する
 * @param {string} imageDescription - describeImageの出力テキスト
 * @returns {{ cleanDescription: string, viewpoints: string[], viewpointLabels: string[] }}
 */
export function parseCharmViewpoints(imageDescription) {
  if (!imageDescription) return { cleanDescription: '', viewpoints: [], viewpointLabels: [] };

  // フォーマット: [① _] 内容（旧: [① カテゴリ名] 内容 も互換）
  const newFormatRegex = /\[([①②③])\s*(.+?)\]\s*(.+)/g;
  const viewpoints = [];
  const viewpointLabels = [];
  let match;
  while ((match = newFormatRegex.exec(imageDescription)) !== null) {
    viewpointLabels.push(match[2].trim());
    viewpoints.push(match[3].trim());
  }

  // 旧フォーマットフォールバック: [視点A/B/C] 内容
  if (viewpoints.length === 0) {
    const oldFormatRegex = /\[視点([ABC])\]\s*(.+)/g;
    while ((match = oldFormatRegex.exec(imageDescription)) !== null) {
      viewpoints.push(match[2].trim());
    }
  }

  // Observation・Detectionセクション（6. 【Observation / 写真の観察 / 投稿の切り口〜末尾）を除去して5項目のみ残す
  const cleanDescription = imageDescription
    .replace(/\n*6\.\s*(?:【?Observation|写真の観察|投稿の切り口)[\s\S]*$/m, '')
    .replace(/\[(?:[①②③]\s*.+?|視点[ABC])\]\s*.+\n?/g, '')
    .trim();

  return {
    cleanDescription: cleanDescription || imageDescription,
    viewpoints: viewpoints.length === 3 ? viewpoints : [],
    viewpointLabels: viewpointLabels.length === 3 ? viewpointLabels : [],
  };
}

/**
 * バックグラウンドで画像分析→投稿生成まで一気に実行し、結果をPush通知で送信
 * ヒント選択ステップなし — 写真を送るだけで3案が届く
 */
async function analyzeImageInBackground(userId, lineUserId, store, imageBase64, imageUrl, messageId) {
  try {
    console.log(`[Image] バックグラウンド分析+生成開始: store=${store.name}`);
    const startMs = Date.now();

    const safeResolve = (promise, defaultVal, label) =>
      promise.catch(err => {
        console.warn(`[Image] ${label} 取得失敗（続行）:`, err.message);
        return defaultVal;
      });

    // プラン別機能チェック + describeImage + パーソナライゼーション（全並列）
    const [
      canAdvanced,
      canSeasonal,
      imageDescription,
      basicPersonalization,
    ] = await Promise.all([
      isFeatureEnabled(userId, 'advancedPersonalization'),
      isFeatureEnabled(userId, 'seasonalMemory'),
      describeImage(imageBase64),
      safeResolve(getPersonalizationPromptAddition(store.id), '', 'personalization'),
    ]);

    // canAdvanced/canSeasonal の結果で追加取得
    const [advancedPersonalization, seasonalMemory] = await Promise.all([
      canAdvanced
        ? safeResolve(getAdvancedPersonalizationPrompt(store.id), '', 'advancedPersonalization')
        : '',
      canSeasonal
        ? safeResolve(getSeasonalMemoryPromptAddition(store.id), '', 'seasonalMemory')
        : '',
    ]);

    if (!imageDescription) {
      console.error('[Image] バックグラウンド分析: imageDescription が空');
      await savePendingImageContext(userId, {
        messageId,
        imageDescription: null,
        storeId: store.id,
        analysisStatus: 'error',
        imageUrl,
        createdAt: new Date().toISOString(),
      });
      await pushMessage(lineUserId, [{
        type: 'text',
        text: '画像がうまく読み取れませんでした...もう一度送ってみてください',
      }]);
      return;
    }

    // 観察視点をパース（5項目観察と分離）
    const { cleanDescription, viewpoints, viewpointLabels } = parseCharmViewpoints(imageDescription);
    if (viewpoints.length === 3) {
      const labelInfo = viewpointLabels.length === 3 ? viewpointLabels.join('/') : 'ラベルなし';
      console.log(`[Image] 観察視点抽出成功: [${labelInfo}] ${viewpoints.map((v, i) => `${i + 1}="${v}"`).join(', ')}`);
    } else {
      console.log('[Image] 観察視点パース失敗（ヒントなしで生成続行）');
    }

    // 被写体カテゴリー検出 → 集合知取得（cleanDescriptionで検出）
    const contentCategory = detectContentCategory(cleanDescription);
    const effectiveCategory = isDevTestStore(store)
      ? (contentCategory || store.category)
      : store.category;
    if (isDevTestStore(store) && contentCategory) {
      console.log(`[Image] 開発者テスト: 自動検出カテゴリー → ${contentCategory}`);
    } else if (contentCategory && contentCategory !== store.category) {
      console.log(`[Image] 被写体カテゴリー検出: store=${store.category} → content=${contentCategory}`);
    }
    const blendedInsights = await safeResolve(
      effectiveCategory
        ? getBlendedInsights(store.id, effectiveCategory, contentCategory)
        : Promise.resolve(null),
      null, 'blendedInsights'
    );

    const personalization = (basicPersonalization || '') + (advancedPersonalization || '') + (seasonalMemory || '');
    const hasLearning = (advancedPersonalization || '') !== '';

    // ── 分析完了 → そのまま投稿生成へ ──
    // DB状態を 'generating' に更新（ユーザーがテキスト送信した場合の判定用）
    await savePendingImageContext(userId, {
      messageId,
      imageDescription: cleanDescription,
      charmViewpoints: viewpoints,
      storeId: store.id,
      blendedInsights: blendedInsights ?? null,
      personalization,
      imageUrl,
      hasLearning,
      effectiveCategory: effectiveCategory || null,
      analysisStatus: 'generating',
      createdAt: new Date().toISOString(),
    });

    const analysisElapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`[Image] 分析完了 (${analysisElapsed}s) → 投稿生成開始: store=${store.name}`);

    // ── 投稿生成 ──
    const isPremium = await isFeatureEnabled(userId, 'enhancedPhotoAdvice');

    // 開発者テスト店舗: 検出カテゴリーで store を一時的にオーバーライド
    const storeForPrompt = isDevTestStore(store) && effectiveCategory
      ? { ...store, category: effectiveCategory }
      : store;

    // PDCA自動チューニング: グローバルルールを取得
    const globalRules = await getGlobalPromptRules();

    // Detection（観察視点）を内部処理としてプロンプトに渡す
    const prompt = buildImagePostPrompt(
      storeForPrompt,
      null,
      blendedInsights ?? null,
      personalization,
      cleanDescription,
      { isPremium, detections: viewpoints, globalRules },
    );

    const rawContent = await askClaude(prompt);
    const savedPost = await savePostHistory(userId, store.id, rawContent, null, imageUrl || null);

    // pending context クリア（生成完了）
    await clearPendingImageContext(userId);

    // persona自動更新チェック（fire-and-forget）
    autoRegeneratePersonaIfNeeded(store.id).catch(e =>
      console.error('[AutoPersona] エラー:', e.message));

    // 集合知保存（開発者テスト店舗は除外）
    if (store.category && !isDevTestStore(store)) {
      try {
        await saveEngagementMetrics(store.id, store.category, {
          post_id: savedPost.id,
          content: rawContent,
        });
      } catch (metricsErr) {
        console.error('[Image] メトリクス初期保存エラー（投稿は成功）:', metricsErr.message);
      }
    }

    const totalElapsed = ((Date.now() - startMs) / 1000).toFixed(1);

    // ── Push通知で1案ドン表示（内部3案からA案を抽出） ──
    const genLimit = await checkGenerationLimit(userId);
    const revisionExample = getRevisionExample(store.category);
    const learningNote = hasLearning ? '\n🧠 これまでの学習を反映しています' : '';
    const remaining = Number.isFinite(genLimit.limit) ? genLimit.limit - (genLimit.used + 1) : null;
    const remainingNote = remaining !== null && remaining <= 3 ? `\n📊 今月の残り: ${remaining}回` : '';

    // ランダムに1案を抽出して表示（DB には3案全文を保存済み）
    const selections = ['A', 'B', 'C'];
    const randomPick = selections[Math.floor(Math.random() * selections.length)];
    const pickedProposal = extractSelectedProposal(rawContent, randomPick);
    // 抽出失敗時は他の案を試す → 全滅なら全文フォールバック
    const displayContent = pickedProposal
      || extractSelectedProposal(rawContent, 'A')
      || extractSelectedProposal(rawContent, 'B')
      || extractSelectedProposal(rawContent, 'C')
      || rawContent;
    const isOneProposal = !!pickedProposal;
    const pickedLabel = pickedProposal ? randomPick : null;

    const hasAdviceInRaw = /📸/.test(rawContent) || /[━─―]{5,}/.test(rawContent);
    console.log(`[Image] 分析+生成完了: store=${store.name} (${totalElapsed}s), 表示案=${pickedLabel || '全文'}, PhotoAdvice=${hasAdviceInRaw ? '有' : '無'}`);

    // 投稿文とPhoto Adviceを分離（━━━区切り or 📸マーカーで検出）
    const adviceSplit = displayContent.match(/^([\s\S]*?)(\n\n[━─―]{5,}[\s\S]*[━─―]{5,})\s*$/)
      || displayContent.match(/^([\s\S]*?)(\n\n📸[\s\S]*)$/);
    const postText = adviceSplit ? adviceSplit[1].trim() : displayContent;
    // 非Premiumユーザーは💡次の被写体提案と🎯明日撮るべきものを除外
    const rawPhotoAdvice = adviceSplit ? adviceSplit[2] : '';
    const photoAdvice = isPremium
      ? rawPhotoAdvice
      : rawPhotoAdvice.replace(/\n💡 次はこんなのも[\s\S]*?(?=\n[━─―]|$)/, '').replace(/\n🎯 明日撮るべきもの[\s\S]*?(?=\n[━─―]|$)/, '');

    const formattedReply = isOneProposal
      ? `まずはおすすめの案です！${learningNote}
━━━━━━━━━━━
${postText}
━━━━━━━━━━━

このまま投稿できます。
📝「学習: ${revisionExample}」で修正＋今後にも反映${remainingNote}${photoAdvice}`
      : `3つの投稿案ができました！どの案が理想に近いですか？👇${learningNote}
━━━━━━━━━━━
${rawContent}
━━━━━━━━━━━

A・B・C を選んだあと「学習: ${revisionExample}」で修正もできます${remainingNote}`;

    const quickReplyItems = isOneProposal
      ? [
          { type: 'action', action: { type: 'message', label: '✅ これで決定', text: pickedLabel } },
          { type: 'action', action: { type: 'message', label: '🔄 別の案を見る', text: '別案' } },
          { type: 'action', action: { type: 'message', label: '📝 学習', text: '学習:' } },
        ]
      : [
          { type: 'action', action: { type: 'message', label: '✅ A案', text: 'A' } },
          { type: 'action', action: { type: 'message', label: '✅ B案', text: 'B' } },
          { type: 'action', action: { type: 'message', label: '✅ C案', text: 'C' } },
          { type: 'action', action: { type: 'message', label: '📝 学習', text: '学習:' } },
        ];

    await pushMessage(lineUserId, [{
      type: 'text',
      text: formattedReply,
      quickReply: { items: quickReplyItems },
    }]);

    // 戦略アドバイス（投稿タイミング等）をTipsとして送信
    try {
      const advice = buildStrategicAdvice(blendedInsights, store);
      if (advice?.postingTimeTip) {
        await pushMessage(lineUserId, [{ type: 'text', text: `💡 ${advice.postingTimeTip}` }]);
      }
    } catch {
      // 戦略Tips送信失敗は無視
    }
  } catch (err) {
    console.error(`[Image] バックグラウンド分析+生成エラー (store=${store.name}):`, err.message);
    try {
      await clearPendingImageContext(userId);
      await pushMessage(lineUserId, [{
        type: 'text',
        text: 'うまくいきませんでした...もう一度画像を送ってみてください',
      }]);
    } catch {
      // Push送信も失敗した場合は諦める
    }
  }
}


/**
 * 画像メッセージ処理
 *
 * 最適化フロー:
 *   画像取得 → [Upload + インサイト判定 + 生成チェック 並列]
 *   → ボタン即表示 → 裏で describeImage + パーソナライゼーション
 *
 * ユーザーがボタンを選ぶ間に画像分析が完了するため、体感3-5秒短縮
 */
export async function handleImageMessage(user, messageId, replyToken) {
  // カルーセルモード中 → 画像を追加
  if (user.pending_image_context?.carousel_mode) {
    return await handleCarouselImageAdd(user, messageId, replyToken);
  }

  if (!user.current_store_id) {
    return await replyText(replyToken,
      'まだ店舗が登録されていないみたいです。「登録」で始められます！'
    );
  }

  // 予約投稿やストック操作中の pending_command をクリア（新しい画像フローを優先）
  if (user.pending_command) {
    await clearPendingCommand(user.id);
  }

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '店舗が見つかりません。「店舗一覧」で確認してみてください');
    }

    // ── direct_mode: AI生成スキップ → テキスト入力待ち ──
    if (store.config?.post_mode === 'direct') {
      console.log(`[Image] direct_mode: AI生成スキップ store=${store.name}`);
      const imageBase64 = await getImageAsBase64(messageId);
      const imageUrl = await uploadImageToStorage(imageBase64, `${user.id}/${Date.now()}.jpg`)
        .catch(err => {
          console.warn('[Image] Storage アップロード失敗:', err.message);
          return null;
        });

      if (!imageUrl) {
        return await replyText(replyToken, '画像のアップロードに失敗しました。もう一度送ってください。');
      }

      await savePendingImageContext(user.id, {
        messageId,
        storeId: store.id,
        imageUrl,
        direct_mode: true,
        createdAt: new Date().toISOString(),
      });

      return await replyText(replyToken, '📷 写真を受け取りました！\n\n投稿の冒頭テキストを送ってください。\nテンプレートとハッシュタグは自動で付きます。');
    }

    // 画像をBase64で取得
    console.log(`[Image] 画像取得中: messageId=${messageId}`);
    const imageBase64 = await getImageAsBase64(messageId);

    // ── Phase 1: Upload + インサイト判定 + 生成チェック（並列）──
    // 3つとも独立した処理なので同時実行
    const [imageUrl, insights, genLimit] = await Promise.all([
      uploadImageToStorage(imageBase64, `${user.id}/${Date.now()}.jpg`)
        .then(url => {
          console.log(`[Image] Storage アップロード完了: ${url?.slice(0, 80)}...`);
          return url;
        })
        .catch(err => {
          console.warn('[Image] Storage アップロード失敗（続行）:', err.message);
          return null;
        }),
      extractInsightsFromScreenshot(imageBase64),
      checkGenerationLimit(user.id),
    ]);

    // ── インサイトスクショ判定 ──
    if (insights.isInsights) {
      console.log(`[Image] インサイトスクショ検出: store=${store.name}, likes=${insights.likes}, saves=${insights.saves}`);

      if (insights.likes !== null || insights.saves !== null || insights.comments !== null) {
        const recentPosts = await getRecentPostHistory(user.id, store.id, 3);

        if (recentPosts.length === 0) {
          return await replyText(replyToken,
            'スクショは読めたんですが、まだ投稿がないみたいです。先に投稿を作ってから送ってください！'
          );
        }

        const metrics = {
          likes:    insights.likes    ?? 0,
          saves:    insights.saves    ?? 0,
          comments: insights.comments ?? 0,
          reach:    insights.reach,
        };

        // 投稿が1件だけなら従来通り自動紐づけ
        if (recentPosts.length === 1) {
          await applyEngagementMetrics(user, store, metrics, recentPosts[0], replyToken);
          return;
        }

        // 複数件ある場合 → OCR結果を一時保存し、投稿選択を求める
        await savePendingImageContext(user.id, {
          insightsData: metrics,
          recentPosts: recentPosts.map(p => ({ id: p.id, content: p.content })),
          storeId: store.id,
          analysisStatus: 'awaiting_post_selection',
          createdAt: new Date().toISOString(),
        });
        await setPendingCommand(user.id, 'awaiting_post_selection');

        // 投稿リストをクイックリプライで表示
        const postListText = recentPosts.map((p, i) => {
          const preview = (p.content || '').replace(/\n/g, ' ').slice(0, 25);
          return `${i + 1}. ${preview}…`;
        }).join('\n');

        const quickReplies = recentPosts.map((_, i) => ({
          type: 'action',
          action: { type: 'message', label: `${i + 1}`, text: `${i + 1}` },
        }));

        await replyWithQuickReply(
          replyToken,
          `📊 インサイトを読み取りました！\nいいね: ${metrics.likes} / 保存: ${metrics.saves} / コメント: ${metrics.comments}${metrics.reach ? ` / リーチ: ${metrics.reach}` : ''}\n\nどの投稿の報告ですか？\n\n${postListText}`,
          quickReplies
        );
        return;
      }

      console.warn('[Image] インサイト判定: 数値読み取り失敗 → 投稿生成フローへ');
    }

    // ── 生成回数チェック ──
    if (!genLimit.allowed) {
      return await replyText(replyToken,
        `⚠️ 今月の生成上限（${genLimit.limit}回）に達しました。\n\n現在: ${genLimit.used}回 / ${genLimit.limit}回\n\n「アップグレード」で上限を増やすことができます。\n\n次月（1日）にリセットされます。`
      );
    }

    // ── Phase 2: 即応答 + バックグラウンドで魅力発見 ──
    // 「分析中」状態で pending context を保存
    await savePendingImageContext(user.id, {
      messageId,
      imageDescription: null,
      storeId: store.id,
      analysisStatus: 'pending',
      imageUrl,
      createdAt: new Date().toISOString(),
    });

    // 即応答 — 秘書トーンで「お任せください」メッセージ
    await replyText(replyToken, 'お任せください、投稿を考えておきますね！\n他の作業をしていてもらって大丈夫です✨');

    // バックグラウンドで画像分析 + 魅力発見開始（awaitしない = ユーザーの操作と並列実行）
    analyzeImageInBackground(user.id, user.line_user_id, store, imageBase64, imageUrl, messageId)
      .catch(err => console.error('[Image] バックグラウンド分析未捕捉エラー:', err));

  } catch (err) {
    console.error('[Image] 画像投稿生成エラー:', err);
    await replyText(replyToken, 'うまくいきませんでした...もう一度試してみてください');
  }
}

/**
 * カルーセルモード中に画像が送信された場合の処理
 * 画像をStorageにアップロードし、pending_image_contextのimages配列に追加
 */
async function handleCarouselImageAdd(user, messageId, replyToken) {
  const ctx = user.pending_image_context;

  if (ctx.images.length >= 10) {
    const { replyWithQuickReply } = await import('../services/lineService.js');
    await replyWithQuickReply(
      replyToken,
      '最大10枚に達しました。「完了」を押して投稿してください。',
      [
        { type: 'action', action: { type: 'message', label: '✅ 完了', text: '完了' } },
        { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' } },
      ]
    );
    return;
  }

  try {
    const imageBase64 = await getImageAsBase64(messageId);
    const imageUrl = await uploadImageToStorage(imageBase64, `${user.id}/${Date.now()}.jpg`);

    if (!imageUrl) {
      await replyText(replyToken, '画像のアップロードに失敗しました。もう一度送ってください。');
      return;
    }

    // images配列に追加
    const updatedImages = [...ctx.images, imageUrl];
    await savePendingImageContext(user.id, {
      ...ctx,
      images: updatedImages,
    });

    const { replyWithQuickReply } = await import('../services/lineService.js');
    await replyWithQuickReply(
      replyToken,
      `${updatedImages.length}枚目を追加しました（現在 ${updatedImages.length}枚）\n\n続けて画像を送るか「完了」を押してください。`,
      [
        { type: 'action', action: { type: 'message', label: '✅ 完了', text: '完了' } },
        { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' } },
      ]
    );
  } catch (err) {
    console.error('[Image] カルーセル画像追加エラー:', err);
    await replyText(replyToken, '画像の追加に失敗しました。もう一度送ってください。');
  }
}
