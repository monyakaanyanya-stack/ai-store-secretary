import { replyText, getImageAsBase64 } from '../services/lineService.js';
import { askClaude, describeImage } from '../services/claudeService.js';
import { getStore, savePostHistory, savePendingImageContext, clearPendingImageContext } from '../services/supabaseService.js';
import { buildImagePostPrompt, appendTemplateFooter } from '../utils/promptBuilder.js';
import { aggregateLearningData } from '../utils/learningData.js';
import { getBlendedInsights, saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { getPersonalizationPromptAddition, getPersonalizationLevel } from '../services/personalizationEngine.js';
import { getAdvancedPersonalizationPrompt } from '../services/advancedPersonalization.js';
import { getSeasonalMemoryPromptAddition } from '../services/seasonalMemoryService.js';
import { extractInsightsFromScreenshot } from '../services/insightsOCRService.js';
import { applyEngagementMetrics } from './reportHandler.js';

/**
 * 画像メッセージ処理: 画像取得 → 画像分析 → 投稿生成 → 返信 → 履歴保存
 */
export async function handleImageMessage(user, messageId, replyToken) {
  // 店舗が未設定の場合
  if (!user.current_store_id) {
    return await replyText(replyToken,
      '店舗が選択されていません。\n\nまず店舗を登録してください:\n1: 店名,こだわり,口調\n\n例: 1: ベーカリー幸福堂,天然酵母の手作りパン,friendly'
    );
  }

  try {
    // 店舗情報を取得
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '選択中の店舗が見つかりません。店舗一覧 で確認してください。');
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
            'スクショを読み取りましたが、まだ投稿履歴がありません。\n先に投稿を生成してから送ってください。'
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

    // H17修正: 画像分析（必須）と補助データ取得（任意）を分けて並列実行
    // 補助データの1つが失敗しても投稿生成は続行する
    console.log(`[Image] 画像分析・データ取得を並列実行中: store=${store.name}`);

    // 補助データを個別にキャッチ（失敗してもデフォルト値で続行）
    const safeResolve = (promise, defaultVal, label) =>
      promise.catch(err => {
        console.warn(`[Image] ${label} 取得失敗（続行）:`, err.message);
        return defaultVal;
      });

    // S9修正: describeImage の失敗を safeResolve ではなく明示的にハンドリング
    // describeImage はエラー時 throw するようになったため、Promise.all が失敗する
    // → catch ブロックでユーザーに適切なエラーメッセージを返せる
    const [
      imageDescription,
      learningData,
      blendedInsights,
      basicPersonalization,
      advancedPersonalization,
      seasonalMemory,
    ] = await Promise.all([
      describeImage(imageBase64), // 必須: 失敗時はcatchブロックへ（S9で throw に変更済み）
      safeResolve(aggregateLearningData(store.id), {}, 'learningData'),
      safeResolve(
        store.category ? getBlendedInsights(store.id, store.category) : Promise.resolve(null),
        null, 'blendedInsights'
      ),
      safeResolve(getPersonalizationPromptAddition(store.id), '', 'personalization'),
      safeResolve(getAdvancedPersonalizationPrompt(store.id), '', 'advancedPersonalization'),
      safeResolve(getSeasonalMemoryPromptAddition(store.id), '', 'seasonalMemory'),
    ]);
    console.log(`[Image] 画像分析結果: ${imageDescription?.slice(0, 100)}...`);

    const personalization = (basicPersonalization || '') + (advancedPersonalization || '') + (seasonalMemory || '');

    // S9修正: imageDescription が万が一 null/undefined の場合のガード
    if (!imageDescription) {
      return await replyText(replyToken, '画像の分析に失敗しました。別の画像で再度お試しください。');
    }

    // ── 一言ヒント機能: 画像分析後に1つだけ質問して待機 ──
    // pending_image_context に状態を保存し、テキスト返信を待つ
    await savePendingImageContext(user.id, {
      messageId,
      imageDescription,
      storeId: store.id,
      learningData,
      blendedInsights: blendedInsights ?? null,
      personalization,
      createdAt: new Date().toISOString(),
    });

    await replyText(replyToken, `📸 写真を受け取りました！

この写真の「伝えたいこと」を一言だけ教えてください👇

例）
・イチゴパフェ 本日限定10食
・新メニュー追加しました
・3周年記念セール開催中
・今日のおすすめランチ

スキップしてすぐ生成する場合は
「スキップ」と送ってください`);
  } catch (err) {
    console.error('[Image] 画像投稿生成エラー:', err);
    await replyText(replyToken, '投稿生成中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}
