import { replyText } from '../services/lineService.js';
import { askClaude } from '../services/claudeService.js';
import {
  getStore,
  getLatestPost,
  saveLearningData,
  savePostHistory,
} from '../services/supabaseService.js';
import { buildRevisionPrompt } from '../utils/promptBuilder.js';
import { aggregateLearningData } from '../utils/learningData.js';

/**
 * フィードバック処理: 最新投稿を修正 + 学習データとして蓄積
 */
export async function handleFeedback(user, feedback, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。先に店舗を登録してください。');
  }

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '選択中の店舗が見つかりません。');
    }

    // 最新の投稿を取得
    const latestPost = await getLatestPost(store.id);
    if (!latestPost) {
      return await replyText(replyToken, 'まだ投稿がありません。先に画像やテキストを送って投稿案を作成してください。');
    }

    // フィードバックを学習データとして保存
    await saveLearningData(
      store.id,
      'feedback',
      latestPost.content,
      feedback,
      extractLearningHints(feedback)
    );

    // 学習データを集約
    const learningData = await aggregateLearningData(store.id);

    // 修正版を生成
    const prompt = buildRevisionPrompt(store, learningData, latestPost.content, feedback);
    const revisedContent = await askClaude(prompt);

    // 修正版を投稿履歴に保存
    await savePostHistory(user.id, store.id, revisedContent);

    console.log(`[Feedback] 修正完了: store=${store.name}`);
    await replyText(replyToken, `✨ 修正しました！\n\n${revisedContent}`);
  } catch (err) {
    console.error('[Feedback] 処理エラー:', err.message);
    await replyText(replyToken, `修正中にエラーが発生しました: ${err.message}`);
  }
}

/**
 * フィードバックテキストから学習ヒントを簡易抽出
 */
function extractLearningHints(feedback) {
  const hints = {};
  const lower = feedback.toLowerCase();

  // カジュアル/フォーマル系のキーワード検出
  if (lower.includes('カジュアル') || lower.includes('くだけた')) {
    hints.preferredWords = ['カジュアル'];
  }
  if (lower.includes('丁寧') || lower.includes('フォーマル')) {
    hints.preferredWords = ['丁寧'];
  }

  // 絵文字に関するフィードバック
  if (lower.includes('絵文字') && (lower.includes('多') || lower.includes('増やし'))) {
    hints.topEmojis = ['✨', '🎉', '💕'];
  }
  if (lower.includes('絵文字') && (lower.includes('少な') || lower.includes('減らし') || lower.includes('なし'))) {
    hints.avoidWords = ['絵文字過多'];
  }

  return hints;
}
