import { replyText, getImageAsBase64 } from '../services/lineService.js';
import { askClaudeWithImage } from '../services/claudeService.js';
import { getStore, savePostHistory } from '../services/supabaseService.js';
import { buildImagePostPrompt } from '../utils/promptBuilder.js';
import { aggregateLearningData } from '../utils/learningData.js';
import { getBlendedInsights, saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { getPersonalizationPromptAddition, getPersonalizationLevel } from '../services/personalizationEngine.js';

/**
 * 画像メッセージ処理: 画像取得 → 投稿生成 → 返信 → 履歴保存
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

    // 学習データを集約
    const learningData = await aggregateLearningData(store.id);

    // 集合知を取得（カテゴリーが設定されている場合のみ）
    let blendedInsights = null;
    if (store.category) {
      blendedInsights = await getBlendedInsights(store.id, store.category);
      console.log(`[Image] 集合知取得: category=${store.category}, group=${blendedInsights.categoryGroup}`);
    }

    // パーソナライゼーション情報を取得
    const personalization = await getPersonalizationPromptAddition(store.id);

    // プロンプト構築 → Claude API で投稿生成（lengthOverride なし = デフォルト設定を使用）
    const prompt = buildImagePostPrompt(store, learningData, null, blendedInsights, personalization);
    const postContent = await askClaudeWithImage(prompt, imageBase64);

    // 投稿履歴に保存（画像のBase64は大きいのでURLのみ or 保存しない）
    const savedPost = await savePostHistory(user.id, store.id, postContent);

    // エンゲージメントメトリクスを保存（初期値）
    if (store.category) {
      await saveEngagementMetrics(store.id, store.category, {
        post_id: savedPost.id,
        content: postContent,
      });
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

※ 評価を送ると自動的に学習します！`;

    await replyText(replyToken, formattedReply);
  } catch (err) {
    console.error('[Image] 画像投稿生成エラー:', err.message);
    await replyText(replyToken, `投稿生成中にエラーが発生しました: ${err.message}`);
  }
}
