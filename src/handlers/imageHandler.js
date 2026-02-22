import { replyText, getImageAsBase64 } from '../services/lineService.js';
import { askClaude, describeImage } from '../services/claudeService.js';
import { getStore, savePostHistory } from '../services/supabaseService.js';
import { buildImagePostPrompt, appendTemplateFooter } from '../utils/promptBuilder.js';
import { aggregateLearningData } from '../utils/learningData.js';
import { getBlendedInsights, saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { getPersonalizationPromptAddition, getPersonalizationLevel } from '../services/personalizationEngine.js';
import { getAdvancedPersonalizationPrompt } from '../services/advancedPersonalization.js';
import { getSeasonalMemoryPromptAddition } from '../services/seasonalMemoryService.js';

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

    // ステップ2: 画像分析結果を使ってテキストのみで投稿生成（画像への依存をなくす）
    const prompt = buildImagePostPrompt(store, learningData, null, blendedInsights, personalization, imageDescription);
    const rawContent = await askClaude(prompt);

    // テンプレートの住所・営業時間などを末尾に固定追記（AIにアレンジさせない）
    const postContent = appendTemplateFooter(rawContent, store);

    // 投稿履歴に保存
    const savedPost = await savePostHistory(user.id, store.id, postContent);

    // エンゲージメントメトリクスを保存（初期値）
    // C17修正: fire-and-forget にせずエラーをキャッチ（投稿自体は成功させる）
    if (store.category) {
      try {
        await saveEngagementMetrics(store.id, store.category, {
          post_id: savedPost.id,
          content: postContent,
        });
      } catch (metricsErr) {
        console.error('[Image] メトリクス初期保存エラー（投稿は成功）:', metricsErr.message);
      }
    }

    console.log(`[Image] 画像投稿生成完了: store=${store.name}`);

    // コピペしやすい形式でフォーマット
    const formattedReply = `✨ 投稿案ができました！

以下をコピーしてInstagramに貼り付けてください↓
━━━━━━━━━━━
${postContent}
━━━━━━━━━━━

この投稿は良かったですか？
👍 良い（「👍」と送信）
👎 イマイチ（「👎」と送信）
✏️ 修正する（「直し: 〜」で指示してください）

※ 評価を送ると自動的に学習します！
※ 「学習状況」と送ると学習内容を確認できます`;

    await replyText(replyToken, formattedReply);
  } catch (err) {
    console.error('[Image] 画像投稿生成エラー:', err);
    await replyText(replyToken, '投稿生成中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}
