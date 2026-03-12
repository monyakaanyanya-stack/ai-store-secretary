import { replyText, replyWithQuickReply, getImageAsBase64, pushMessage } from '../services/lineService.js';
import { describeImage } from '../services/claudeService.js';
import { getStore, savePendingImageContext, uploadImageToStorage, setPendingCommand } from '../services/supabaseService.js';
import { getBlendedInsights, saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { getPersonalizationPromptAddition } from '../services/personalizationEngine.js';
import { getAdvancedPersonalizationPrompt } from '../services/advancedPersonalization.js';
import { getSeasonalMemoryPromptAddition } from '../services/seasonalMemoryService.js';
import { extractInsightsFromScreenshot } from '../services/insightsOCRService.js';
import { applyEngagementMetrics, getRecentPostHistory } from './reportHandler.js';
import { detectContentCategory } from '../utils/contentCategoryDetector.js';
import { checkGenerationLimit, isFeatureEnabled } from '../services/subscriptionService.js';
import { getCategoryGroup } from '../config/categoryDictionary.js';
import { isDevTestStore } from './adminHandler.js';

/**
 * カテゴリに応じたヒント例文を返す
 */
function getHintExamples(category) {
  const group = getCategoryGroup(category);
  switch (group) {
    case '美容系':
      return '例：ブリーチからのアッシュグレー\n例：縮毛矯正でツヤツヤになった\n例：新色、自信ある';
    case '飲食系':
      return '例：今朝これ焼けたとき嬉しかった\n例：常連さんが褒めてくれた\n例：新作、自信ある';
    case '小売系':
      return '例：入荷したとき思わず自分用に欲しくなった\n例：お客さんが迷わず手に取ってくれた\n例：この色、今の季節にぴったり';
    case 'サービス系':
      return '例：今日のお客さん、すごく喜んでくれた\n例：この空間が一番好きな時間帯\n例：新しいメニュー、手応えあり';
    default:
      return '例：今日あったこと、嬉しかったこと\n例：お客さんに褒めてもらえた\n例：新作、自信ある';
  }
}

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
 * バックグラウンドで画像分析+補助データ取得を行い、結果をDBに保存
 * 分析完了後、Push通知で投稿視点ボタンを送信
 */
async function analyzeImageInBackground(userId, lineUserId, store, imageBase64, imageUrl, messageId) {
  try {
    console.log(`[Image] バックグラウンド分析開始: store=${store.name}`);
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
      // フォールバック: 汎用ヒントボタンをPush
      await sendFallbackHintPush(lineUserId, store.category);
      return;
    }

    // 観察視点をパース（5項目観察と分離）
    const { cleanDescription, viewpoints, viewpointLabels } = parseCharmViewpoints(imageDescription);
    if (viewpoints.length === 3) {
      const labelInfo = viewpointLabels.length === 3 ? viewpointLabels.join('/') : 'ラベルなし';
      console.log(`[Image] 観察視点抽出成功: [${labelInfo}] ${viewpoints.map((v, i) => `${i + 1}="${v}"`).join(', ')}`);
    } else {
      console.log('[Image] 観察視点パース失敗 → フォールバックヒントボタン');
    }

    // 被写体カテゴリー検出 → 集合知取得（cleanDescriptionで検出）
    const contentCategory = detectContentCategory(cleanDescription);
    // 開発者テスト店舗: 検出カテゴリーを store.category の代わりに使用
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

    // 分析完了 → DB更新（cleanDescriptionで保存 = 5項目のみ）
    await savePendingImageContext(userId, {
      messageId,
      imageDescription: cleanDescription,
      charmViewpoints: viewpoints,
      storeId: store.id,
      blendedInsights: blendedInsights ?? null,
      personalization,
      imageUrl,
      hasLearning: (advancedPersonalization || '') !== '',
      effectiveCategory: effectiveCategory || null,
      analysisStatus: 'complete',
      createdAt: new Date().toISOString(),
    });

    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`[Image] バックグラウンド分析完了: store=${store.name} (${elapsed}s)`);

    // Push通知で観察視点ボタン or フォールバックヒントを送信
    if (viewpoints.length === 3) {
      await pushMessage(lineUserId, [{
        type: 'text',
        text: `この写真、ここがいいなと思いました👀\n\n① ${viewpoints[0]}\n② ${viewpoints[1]}\n③ ${viewpoints[2]}\n\n気になるのありますか？`,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: truncateLabel(viewpoints[0]), text: viewpoints[0] } },
            { type: 'action', action: { type: 'message', label: truncateLabel(viewpoints[1]), text: viewpoints[1] } },
            { type: 'action', action: { type: 'message', label: truncateLabel(viewpoints[2]), text: viewpoints[2] } },
            { type: 'action', action: { type: 'message', label: 'スキップ', text: 'スキップ' } },
          ],
        },
      }]);
    } else {
      await sendFallbackHintPush(lineUserId, store.category);
    }
  } catch (err) {
    console.error(`[Image] バックグラウンド分析エラー (store=${store.name}):`, err.message);
    try {
      await savePendingImageContext(userId, {
        messageId,
        imageDescription: null,
        storeId: store.id,
        analysisStatus: 'error',
        imageUrl,
        createdAt: new Date().toISOString(),
      });
      // エラー時もPushでフォールバックボタンを送る（ユーザーがボタンなしで放置されない）
      await sendFallbackHintPush(lineUserId, store.category);
    } catch {
      // DB保存も失敗した場合は諦める
    }
  }
}

/**
 * LINE Quick Reply label の20文字制限に合わせてトランケーション
 */
function truncateLabel(text) {
  if (!text || text.length <= 20) return text;
  return text.slice(0, 18) + '…';
}

/**
 * フォールバック: 汎用ヒントボタンをPush通知で送信
 */
async function sendFallbackHintPush(lineUserId, category) {
  try {
    await pushMessage(lineUserId, [{
      type: 'text',
      text: `分析できました！一言もらえるとグッと「あなたらしい」投稿になります💡\n\n${getHintExamples(category)}\n\nボタンで選んでも、自由に文章を送ってもOKです✏️`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: 'お知らせ', text: 'お知らせ' } },
          { type: 'action', action: { type: 'message', label: '日常感', text: '日常感' } },
          { type: 'action', action: { type: 'message', label: 'お役立ち', text: 'お役立ち情報' } },
          { type: 'action', action: { type: 'message', label: 'スキップ', text: 'スキップ' } },
        ],
      },
    }]);
  } catch (pushErr) {
    console.error('[Image] フォールバックPush送信失敗:', pushErr.message);
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

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '店舗が見つかりません。「店舗一覧」で確認してみてください');
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

    // 即応答（ボタンはバックグラウンド分析完了後にPush通知で送る）
    await replyText(replyToken, 'この写真を観察しています...📸');

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
