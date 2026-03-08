import { replyText, replyWithQuickReply, getImageAsBase64 } from '../services/lineService.js';
import { describeImage } from '../services/claudeService.js';
import { getStore, savePendingImageContext, uploadImageToStorage } from '../services/supabaseService.js';
import { getBlendedInsights, saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { getPersonalizationPromptAddition } from '../services/personalizationEngine.js';
import { getAdvancedPersonalizationPrompt } from '../services/advancedPersonalization.js';
import { getSeasonalMemoryPromptAddition } from '../services/seasonalMemoryService.js';
import { extractInsightsFromScreenshot } from '../services/insightsOCRService.js';
import { applyEngagementMetrics } from './reportHandler.js';
import { detectContentCategory } from '../utils/contentCategoryDetector.js';
import { checkGenerationLimit, isFeatureEnabled } from '../services/subscriptionService.js';
import { getCategoryGroup } from '../config/categoryDictionary.js';

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
 * バックグラウンドで画像分析+補助データ取得を行い、結果をDBに保存
 * ボタン表示後に非同期で実行される
 */
async function analyzeImageInBackground(userId, store, imageBase64, imageUrl, messageId) {
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
      return;
    }

    // 被写体カテゴリー検出 → 集合知取得
    const contentCategory = detectContentCategory(imageDescription);
    if (contentCategory && contentCategory !== store.category) {
      console.log(`[Image] 被写体カテゴリー検出: store=${store.category} → content=${contentCategory}`);
    }
    const blendedInsights = await safeResolve(
      store.category
        ? getBlendedInsights(store.id, store.category, contentCategory)
        : Promise.resolve(null),
      null, 'blendedInsights'
    );

    const personalization = (basicPersonalization || '') + (advancedPersonalization || '') + (seasonalMemory || '');

    // 分析完了 → DB更新
    await savePendingImageContext(userId, {
      messageId,
      imageDescription,
      storeId: store.id,
      blendedInsights: blendedInsights ?? null,
      personalization,
      imageUrl,
      hasLearning: (advancedPersonalization || '') !== '',
      analysisStatus: 'complete',
      createdAt: new Date().toISOString(),
    });

    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`[Image] バックグラウンド分析完了: store=${store.name} (${elapsed}s)`);
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
    } catch {
      // DB保存も失敗した場合は諦める
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
        const { supabase } = await import('../services/supabaseService.js');
        const { data: latestPost } = await supabase
          .from('post_history')
          .select('id, content')
          .eq('store_id', store.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!latestPost) {
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

        await applyEngagementMetrics(user, store, metrics, latestPost, replyToken);
        return; // 報告完了 → 投稿生成フローには進まない
      }

      console.warn('[Image] インサイト判定: 数値読み取り失敗 → 投稿生成フローへ');
    }

    // ── 生成回数チェック ──
    if (!genLimit.allowed) {
      return await replyText(replyToken,
        `⚠️ 今月の生成上限（${genLimit.limit}回）に達しました。\n\n現在: ${genLimit.used}回 / ${genLimit.limit}回\n\n「アップグレード」で上限を増やすことができます。\n\n次月（1日）にリセットされます。`
      );
    }

    // ── Phase 2: ボタン即表示 + バックグラウンド分析 ──
    // 「分析中」状態で pending context を保存
    await savePendingImageContext(user.id, {
      messageId,
      imageDescription: null,
      storeId: store.id,
      analysisStatus: 'pending',
      imageUrl,
      createdAt: new Date().toISOString(),
    });

    // ボタンを即表示（ユーザーはここで考え始める）
    await replyWithQuickReply(
      replyToken,
      `いい写真ですね！今日あったこと、思ったこと、一言もらえるとグッと「あなたらしい」投稿になります💡

${getHintExamples(store.category)}

ボタンで選んでも、自由に文章を送ってもOKです✏️`,
      [
        { type: 'action', action: { type: 'message', label: 'お知らせ', text: 'お知らせ' } },
        { type: 'action', action: { type: 'message', label: '日常感', text: '日常感' } },
        { type: 'action', action: { type: 'message', label: 'お役立ち', text: 'お役立ち情報' } },
        { type: 'action', action: { type: 'message', label: 'スキップ', text: 'スキップ' } },
      ]
    );

    // バックグラウンドで画像分析開始（awaitしない = ユーザーの操作と並列実行）
    analyzeImageInBackground(user.id, store, imageBase64, imageUrl, messageId)
      .catch(err => console.error('[Image] バックグラウンド分析未捕捉エラー:', err));

  } catch (err) {
    console.error('[Image] 画像投稿生成エラー:', err);
    await replyText(replyToken, 'うまくいきませんでした...もう一度試してみてください');
  }
}
