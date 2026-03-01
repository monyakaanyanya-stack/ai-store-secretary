import { replyText, replyWithQuickReply, getImageAsBase64 } from '../services/lineService.js';
import { askClaude, describeImage } from '../services/claudeService.js';
import { getStore, savePostHistory, savePendingImageContext, clearPendingImageContext } from '../services/supabaseService.js';
import { buildImagePostPrompt, appendTemplateFooter } from '../utils/promptBuilder.js';
import { getBlendedInsights, saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { getPersonalizationPromptAddition, getPersonalizationLevel } from '../services/personalizationEngine.js';
import { getAdvancedPersonalizationPrompt } from '../services/advancedPersonalization.js';
import { getSeasonalMemoryPromptAddition } from '../services/seasonalMemoryService.js';
import { extractInsightsFromScreenshot } from '../services/insightsOCRService.js';
import { applyEngagementMetrics } from './reportHandler.js';
import { detectContentCategory } from '../utils/contentCategoryDetector.js';

/**
 * 画像メッセージ処理: 画像取得 → 画像分析 → 投稿生成 → 返信 → 履歴保存
 */
export async function handleImageMessage(user, messageId, replyToken) {
  // 店舗が未設定の場合
  if (!user.current_store_id) {
    return await replyText(replyToken,
      'まだ店舗が登録されていないみたいです。「登録」で始められます！'
    );
  }

  try {
    // 店舗情報を取得
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '店舗が見つかりません。「店舗一覧」で確認してみてください');
    }

    // 画像をBase64で取得
    console.log(`[Image] 画像取得中: messageId=${messageId}`);
    const imageBase64 = await getImageAsBase64(messageId);

    // ──────────────────────────────────────────────
    // インサイトスクショ判定
    // 朝のリマインダーに「スクショを送ってください」と案内しているため、
    // 投稿生成の前に Instagram インサイト画像かどうかを先にチェックする
    // ──────────────────────────────────────────────
    const insights = await extractInsightsFromScreenshot(imageBase64);
    if (insights.isInsights) {
      console.log(`[Image] インサイトスクショ検出: store=${store.name}, likes=${insights.likes}, saves=${insights.saves}`);

      // 少なくとも1指標が読み取れていれば自動報告
      if (insights.likes !== null || insights.saves !== null || insights.comments !== null) {
        // 最新の投稿を取得
        const { data: latestPost } = await (await import('../services/supabaseService.js'))
          .supabase
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

      // 数値が1つも読み取れなかった場合は通常フローへ（商品写真として処理）
      console.warn('[Image] インサイト判定: 数値読み取り失敗 → 投稿生成フローへ');
    }

    // 補助データを個別にキャッチ（失敗してもデフォルト値で続行）
    const safeResolve = (promise, defaultVal, label) =>
      promise.catch(err => {
        console.warn(`[Image] ${label} 取得失敗（続行）:`, err.message);
        return defaultVal;
      });

    // Phase 1: describeImage（必須）とパーソナライゼーションデータを並列取得
    // describeImage は throw するので失敗時は catch ブロックへ
    console.log(`[Image] Phase1: 画像分析・パーソナライゼーション並列取得中: store=${store.name}`);
    const [
      imageDescription,
      basicPersonalization,
      advancedPersonalization,
      seasonalMemory,
    ] = await Promise.all([
      describeImage(imageBase64),
      safeResolve(getPersonalizationPromptAddition(store.id), '', 'personalization'),
      safeResolve(getAdvancedPersonalizationPrompt(store.id), '', 'advancedPersonalization'),
      safeResolve(getSeasonalMemoryPromptAddition(store.id), '', 'seasonalMemory'),
    ]);
    console.log(`[Image] 画像分析結果: ${imageDescription?.slice(0, 100)}...`);

    // Phase 2: 被写体カテゴリー検出（同期）→ 集合知取得
    // imageDescription が確定してからでないと contentCategory を渡せないため直列
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

    // S9修正: imageDescription が万が一 null/undefined の場合のガード
    if (!imageDescription) {
      return await replyText(replyToken, '画像がうまく読み取れませんでした。別の画像で試してみてください');
    }

    // ── 一言ヒント機能: 画像分析後に1つだけ質問して待機 ──
    // pending_image_context に状態を保存し、テキスト返信を待つ
    await savePendingImageContext(user.id, {
      messageId,
      imageDescription,
      storeId: store.id,
      blendedInsights: blendedInsights ?? null,
      personalization,
      createdAt: new Date().toISOString(),
    });

    await replyWithQuickReply(
      replyToken,
      `写真見ました！この写真で何を伝えたいですか？

例：今週末限定メニュー
例：朝の光が綺麗だった
例：常連さんへの感謝`,
      [
        { type: 'action', action: { type: 'message', label: 'お知らせ', text: 'お知らせ' } },
        { type: 'action', action: { type: 'message', label: '日常感', text: '日常感' } },
        { type: 'action', action: { type: 'message', label: 'お役立ち', text: 'お役立ち情報' } },
        { type: 'action', action: { type: 'message', label: 'スキップ', text: 'スキップ' } },
      ]
    );
  } catch (err) {
    console.error('[Image] 画像投稿生成エラー:', err);
    await replyText(replyToken, 'うまくいきませんでした...もう一度試してみてください');
  }
}
