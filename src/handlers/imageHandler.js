import { replyText, replyWithQuickReply, getImageAsBase64, pushMessage } from '../services/lineService.js';
import { describeImage, askClaude } from '../services/claudeService.js';
import { getStore, savePendingImageContext, clearPendingImageContext, uploadImageToStorage, setPendingCommand, clearPendingCommand, savePostHistory, getLatestPost, updatePostContent, savePostFeatures } from '../services/supabaseService.js';
import { getBlendedInsights, saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { getPersonalizationPromptAddition } from '../services/personalizationEngine.js';
import { getAdvancedPersonalizationPrompt, autoRegeneratePersonaIfNeeded } from '../services/advancedPersonalization.js';
import { getSeasonalMemoryPromptAddition } from '../services/seasonalMemoryService.js';
import { extractInsightsFromScreenshot } from '../services/insightsOCRService.js';
import { applyEngagementMetrics, getRecentPostHistory } from './reportHandler.js';
import { detectContentCategory } from '../utils/contentCategoryDetector.js';
import { checkGenerationLimit, isFeatureEnabled } from '../services/subscriptionService.js';
import { isDevTestStore } from './adminHandler.js';
import { buildBodyPrompt, buildSupplementPrompt, buildStrategicAdvice } from '../utils/promptBuilder.js';
import { getGlobalPromptRules } from '../services/promptTuningService.js';
import { getInstagramAccount } from '../services/instagramService.js';


/**
 * describeImage出力（JSON or 旧テキスト）をパースして構造化データを返す
 * @param {string} imageDescription - describeImageの出力テキスト（JSON形式を想定）
 * @returns {{ cleanDescription: string, viewpoints: string[], viewpointLabels: string[], mainSubject: string|null, supportingElements: string[] }}
 */
export function parseCharmViewpoints(imageDescription) {
  if (!imageDescription) return { cleanDescription: '', viewpoints: [], viewpointLabels: [], mainSubject: null, supportingElements: [], features: null };

  // ── JSON形式を試みる（新フォーマット） ──
  try {
    // JSONブロックを抽出（```json ... ``` or 直接JSON）
    const jsonMatch = imageDescription.match(/```json\s*([\s\S]*?)```/) || imageDescription.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      const mainSubject = parsed.main_subject || null;
      const supportingElements = Array.isArray(parsed.supporting_elements) ? parsed.supporting_elements : [];
      const description = parsed.description || '';
      const observations = Array.isArray(parsed.observations) ? parsed.observations : [];
      const viewpoints = Array.isArray(parsed.viewpoints) ? parsed.viewpoints : [];

      // cleanDescription = description + observations（投稿生成プロンプトに渡す用）
      const obsText = observations.length > 0 ? '\n観察:\n' + observations.map(o => `- ${o}`).join('\n') : '';
      const cleanDescription = `主役: ${mainSubject || '不明'}\n${description}${obsText}`;

      // 構造化特徴タグ（Premium分析AI用）
      const features = {
        main_subject_tag: parsed.main_subject_tag || 'other',
        scene_type: parsed.scene_type || 'other',
        has_person: parsed.has_person === true,
        action_type: parsed.action_type || 'none',
        lighting_type: parsed.lighting_type || 'natural_soft',
        camera_angle: parsed.camera_angle || 'eye_level',
        color_tone: parsed.color_tone || 'neutral',
        subject_density: parsed.subject_density || 'single',
        composition_type: parsed.composition_type || 'center',
      };

      return {
        cleanDescription,
        viewpoints: viewpoints.length >= 3 ? viewpoints.slice(0, 3) : viewpoints,
        viewpointLabels: [],
        mainSubject,
        supportingElements,
        features,
      };
    }
  } catch {
    // JSONパース失敗 → 旧フォーマットにフォールバック
    console.log('[Image] JSON解析失敗、旧フォーマットで処理');
  }

  // ── 旧フォーマットフォールバック ──
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

  // Observation・Detectionセクション除去
  const cleanDescription = imageDescription
    .replace(/\n*6\.\s*(?:【?Observation|写真の観察|投稿の切り口)[\s\S]*$/m, '')
    .replace(/\[(?:[①②③]\s*.+?|視点[ABC])\]\s*.+\n?/g, '')
    .trim();

  return {
    cleanDescription: cleanDescription || imageDescription,
    viewpoints: viewpoints.length === 3 ? viewpoints : [],
    viewpointLabels: viewpointLabels.length === 3 ? viewpointLabels : [],
    mainSubject: null,
    supportingElements: [],
    features: null, // 旧フォーマットでは特徴タグなし
  };
}

/**
 * Instagram連携済みの場合にIG系ボタンを追加したクイックリプライを構築
 */
async function buildQuickReplyItems(storeId, hasImageUrl) {
  const igAccount = await getInstagramAccount(storeId).catch(() => null);

  if (igAccount && hasImageUrl) {
    // IG連携済み: 投稿系ボタン + 別案 + 学習（「これで決定」は不要）
    return [
      { type: 'action', action: { type: 'message', label: '📸 Instagram投稿', text: 'instagram投稿' } },
      { type: 'action', action: { type: 'message', label: '📸 複数枚投稿', text: '複数枚投稿' } },
      { type: 'action', action: { type: 'message', label: '⏰ 予約投稿', text: '予約投稿' } },
      { type: 'action', action: { type: 'message', label: '💾 ストック', text: 'ストック保存' } },
      { type: 'action', action: { type: 'message', label: '🔄 別案', text: '別案' } },
      { type: 'action', action: { type: 'message', label: '📝 学習', text: '学習:' } },
    ];
  }

  // IG未連携: コピー + 別案 + 学習
  return [
    { type: 'action', action: { type: 'message', label: '📋 コピーして使う', text: 'コピー' } },
    { type: 'action', action: { type: 'message', label: '🔄 別案', text: '別案' } },
    { type: 'action', action: { type: 'message', label: '📝 学習', text: '学習:' } },
  ];
}

/**
 * 本文生成後にfire-and-forgetで実行: Photo Advice を生成してDB更新
 * ※ハッシュタグは本文と一緒に生成済み
 */
async function generateSupplements(postId, bodyText, store, blendedInsights, imageDescription, userId, lineUserId, isPremium, hasImageUrl = false, mainSubject = null) {
  try {
    const prompt = buildSupplementPrompt(bodyText, store, blendedInsights, imageDescription, { isPremium, mainSubject });
    const supplementRaw = await askClaude(prompt, { max_tokens: 512 });

    // DB更新: 本文（タグ含む） + Photo Advice
    const advicePart = supplementRaw.trim();
    if (advicePart) {
      await updatePostContent(postId, bodyText + '\n\n' + advicePart);

      // Photo AdviceをLINEにPush通知（本文とは別メッセージ・クイックリプライ付き）
      const qrItems = await buildQuickReplyItems(store.id, hasImageUrl);
      await pushMessage(lineUserId, [{
        type: 'text',
        text: `━━━━━━━━━━━\n${advicePart}`,
        quickReply: { items: qrItems },
      }]);
    }
    console.log(`[Image] Supplement生成完了: postId=${postId}`);
  } catch (err) {
    console.error('[Image] Supplement生成エラー（本文は保存済み）:', err.message);
  }
}

// pending_image_context の有効期限（10分）
const CONTEXT_TTL_MS = 10 * 60 * 1000;

/**
 * pending_image_context が有効期限内かチェック
 */
export function isContextValid(ctx) {
  if (!ctx || !ctx.createdAt) return false;
  const elapsed = Date.now() - new Date(ctx.createdAt).getTime();
  return elapsed < CONTEXT_TTL_MS;
}

/**
 * 「別案」用: pending_image_context から再生成（variation_mode で差を出す）
 */
export async function regenerateBody(user, store, ctx, lineUserId) {
  try {
    const isPremium = await isFeatureEnabled(user.id, 'enhancedPhotoAdvice');
    const storeForPrompt = isDevTestStore(store) && ctx.effectiveCategory
      ? { ...store, category: ctx.effectiveCategory }
      : store;

    const globalRules = await getGlobalPromptRules();

    // variation_mode: さっきと違う切り口を指示
    const variationInstruction = `\n【重要】さっきの投稿とは違う切り口で書いてください。別の観察ポイントから始め、違うフックを使ってください。\n`;

    const prompt = buildBodyPrompt(storeForPrompt, ctx.personalization || '', ctx.imageDescription, {
      detections: ctx.charmViewpoints || [],
      globalRules: (globalRules || '') + variationInstruction,
      mainSubject: ctx.mainSubject || null,
      supportingElements: ctx.supportingElements || [],
      blendedInsights: ctx.blendedInsights || null,
    });

    const bodyText = await askClaude(prompt, { max_tokens: 768 });
    const savedPost = await savePostHistory(user.id, store.id, bodyText, null, ctx.imageUrl || null);

    // 前回と同じ写真特徴を新しいpostIdに保存
    if (ctx.features) {
      savePostFeatures(store.id, savedPost.id, ctx.features)
        .catch(e => console.error('[Image] 再生成PostFeatures保存エラー:', e.message));
    }

    const hasLearning = (ctx.personalization || '') !== '';
    const learningNote = hasLearning ? '\n🧠 これまでの学習を反映しています' : '';

    const hasImageUrl = !!(ctx.imageUrl || savedPost.image_url);
    const regenQrItems = await buildQuickReplyItems(store.id, hasImageUrl);
    await pushMessage(lineUserId, [{
      type: 'text',
      text: `別の案です！${learningNote}\n━━━━━━━━━━━\n${bodyText}\n━━━━━━━━━━━\n\n📝「学習: 書き直した文章」で文体を学習`,
      quickReply: { items: regenQrItems },
    }]);

    // fire-and-forget: Supplement生成
    generateSupplements(savedPost.id, bodyText, store, ctx.blendedInsights, ctx.imageDescription, user.id, lineUserId, isPremium, hasImageUrl, ctx.mainSubject)
      .catch(e => console.error('[Image] 再生成Supplement エラー:', e.message));

  } catch (err) {
    console.error('[Image] 再生成エラー:', err.message);
    await pushMessage(lineUserId, [{
      type: 'text',
      text: 'うまくいきませんでした...もう一度お試しください',
    }]);
  }
}

/**
 * バックグラウンドで画像分析→本文生成→Push通知、その後タグ+Adviceを非同期生成
 * 2ステップフロー: ①本文のみ即Push ②ハッシュタグ+Adviceは裏で生成
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
      imageDescriptionRaw,
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

    if (!imageDescriptionRaw) {
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

    // 構造化パース（JSON形式 or 旧テキスト形式）
    const { cleanDescription, viewpoints, mainSubject, supportingElements, features } = parseCharmViewpoints(imageDescriptionRaw);
    if (features) {
      console.log(`[Image] 写真特徴: subject=${features.main_subject_tag}, scene=${features.scene_type}, person=${features.has_person}, angle=${features.camera_angle}, color=${features.color_tone}, density=${features.subject_density}, comp=${features.composition_type}`);
    }
    if (mainSubject) {
      console.log(`[Image] main_subject: "${mainSubject}", supporting: [${supportingElements.join(', ')}]`);
    }
    if (viewpoints.length > 0) {
      console.log(`[Image] 観察視点抽出成功: ${viewpoints.map((v, i) => `${i + 1}="${v}"`).join(', ')}`);
    } else {
      console.log('[Image] 観察視点パース失敗（ヒントなしで生成続行）');
    }

    // 被写体カテゴリー検出 → 集合知取得
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

    // ── 分析完了 → 本文生成へ ──
    await savePendingImageContext(userId, {
      messageId,
      imageDescription: cleanDescription,
      charmViewpoints: viewpoints,
      mainSubject: mainSubject || null,
      supportingElements: supportingElements || [],
      features: features || null,
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
    console.log(`[Image] 分析完了 (${analysisElapsed}s) → 本文生成開始: store=${store.name}`);

    // ── Step 1: 本文のみ生成（スリムプロンプト） ──
    const isPremium = await isFeatureEnabled(userId, 'enhancedPhotoAdvice');
    const storeForPrompt = isDevTestStore(store) && effectiveCategory
      ? { ...store, category: effectiveCategory }
      : store;

    const globalRules = await getGlobalPromptRules();
    const prompt = buildBodyPrompt(storeForPrompt, personalization, cleanDescription, {
      detections: viewpoints,
      globalRules,
      mainSubject,
      supportingElements,
      blendedInsights,
    });

    const bodyText = await askClaude(prompt, { max_tokens: 768 });
    const savedPost = await savePostHistory(userId, store.id, bodyText, null, imageUrl || null);

    // 写真特徴を保存（Premium分析AI Phase 1）
    if (features) {
      savePostFeatures(store.id, savedPost.id, features)
        .catch(e => console.error('[Image] PostFeatures保存エラー（投稿は成功）:', e.message));
    }

    // pending context を 'complete' に更新（クリアしない → 「別案」で再利用）
    await savePendingImageContext(userId, {
      messageId,
      imageDescription: cleanDescription,
      charmViewpoints: viewpoints,
      mainSubject: mainSubject || null,
      supportingElements: supportingElements || [],
      features: features || null,
      storeId: store.id,
      blendedInsights: blendedInsights ?? null,
      personalization,
      imageUrl,
      hasLearning,
      effectiveCategory: effectiveCategory || null,
      analysisStatus: 'complete',
      createdAt: new Date().toISOString(),
    });

    // persona自動更新チェック（fire-and-forget）
    autoRegeneratePersonaIfNeeded(store.id).catch(e =>
      console.error('[AutoPersona] エラー:', e.message));

    // 集合知保存（開発者テスト店舗は除外）
    if (store.category && !isDevTestStore(store)) {
      try {
        await saveEngagementMetrics(store.id, store.category, {
          post_id: savedPost.id,
          content: bodyText,
        });
      } catch (metricsErr) {
        console.error('[Image] メトリクス初期保存エラー（投稿は成功）:', metricsErr.message);
      }
    }

    const totalElapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`[Image] 本文生成完了: store=${store.name} (${totalElapsed}s)`);

    // ── Push通知: 本文のみ即表示 ──
    const genLimit = await checkGenerationLimit(userId);
    const learningNote = hasLearning ? '\n🧠 これまでの学習を反映しています' : '';
    const remaining = Number.isFinite(genLimit.limit) ? genLimit.limit - (genLimit.used + 1) : null;
    const remainingNote = remaining !== null && remaining <= 3 ? `\n📊 今月の残り: ${remaining}回` : '';

    const initialQrItems = await buildQuickReplyItems(store.id, !!imageUrl);
    await pushMessage(lineUserId, [{
      type: 'text',
      text: `投稿ができました！👇${learningNote}\n━━━━━━━━━━━\n${bodyText}\n━━━━━━━━━━━\n\n📝「学習: 書き直した文章」で文体を学習${remainingNote}`,
      quickReply: { items: initialQrItems },
    }]);

    // ── Step 2: ハッシュタグ + Photo Advice（fire-and-forget） ──
    generateSupplements(savedPost.id, bodyText, store, blendedInsights, cleanDescription, userId, lineUserId, isPremium, !!imageUrl, mainSubject)
      .catch(e => console.error('[Image] Supplement生成エラー:', e.message));

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
      'まだアカウントが登録されていないみたいです。「登録」で始められます！'
    );
  }

  // 予約投稿やストック操作中の pending_command をクリア（新しい画像フローを優先）
  if (user.pending_command) {
    await clearPendingCommand(user.id);
  }

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, 'アカウントが見つかりません。「アカウント一覧」で確認してみてください');
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
