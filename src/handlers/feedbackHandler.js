import { replyText } from '../services/lineService.js';
import { askClaude } from '../services/claudeService.js';
import {
  getStore,
  getLatestPost,
  saveLearningData,
  updatePostContent,
} from '../services/supabaseService.js';
import { buildRevisionPrompt } from '../utils/promptBuilder.js';
import { aggregateLearningData } from '../utils/learningData.js';
import { applyFeedbackToProfile, getOrCreateLearningProfile } from '../services/personalizationEngine.js';
import {
  analyzeFeedbackWithClaude,
  updateAdvancedProfile,
  getAdvancedPersonalizationPrompt,
} from '../services/advancedPersonalization.js';

/**
 * フィードバック処理: 最新投稿を修正 + 学習データとして蓄積
 */
export async function handleFeedback(user, feedback, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。先に店舗を登録してください。');
  }

  // S14修正: フィードバックの長さ制限（Claude APIトークン浪費防止）
  if (feedback.length > 500) {
    return await replyText(replyToken, '修正指示が長すぎます。500文字以内でお願いします。');
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

    // ========== ハイブリッド学習方式 ==========
    // 「直し:」の詳細フィードバック → Claude API分析（高精度）
    // それ以外（👍👎など） → キーワードマッチ（無料）

    // ── 学習フェーズ ──────────────────────────────────────
    // 「直し:」は明示的な指示なので短くても常に Claude API 分析で永続学習させる
    // （長さによる分岐をなくし「ギャル風」など短い指示も必ず writing_style に保存）
    // S17修正: ユーザー入力をログにそのまま出力しない（PII混入防止）
    console.log(`[Feedback] 高度な学習を使用: len=${feedback.length}`);

    const analysis = await analyzeFeedbackWithClaude(feedback, latestPost.content);

    if (analysis) {
      await updateAdvancedProfile(store.id, analysis);
      console.log(`[Feedback] 高度な学習完了: ${analysis.summary}`);
    }

    await saveLearningData(
      store.id,
      'feedback',
      latestPost.content,
      feedback,
      analysis || extractLearningHints(feedback)
    );

    // ── 修正生成フェーズ ──────────────────────────────────
    // 「直し:」コマンドなので長短問わず常に修正案を返す
    const learningData = await aggregateLearningData(store.id);
    const advancedPersonalization = await getAdvancedPersonalizationPrompt(store.id);
    const prompt = buildRevisionPrompt(store, learningData, latestPost.content, feedback, advancedPersonalization);
    const revisedContent = await askClaude(prompt);

    // 修正版で既存の投稿履歴を更新（新レコードを作らない）
    // → エンゲージメント報告時にlatestPostが修正版に誤紐付けされるのを防止
    await updatePostContent(latestPost.id, revisedContent);

    console.log(`[Feedback] 修正完了: store=${store.name}`);

    // M8: 学習プロファイルを取得して学習回数・学習内容を確認（static import済み）
    const profile = await getOrCreateLearningProfile(store.id);
    const profileData = profile?.profile_data || {};

    // 今回学習した具体的な内容を取得
    const latestLearnings = profileData.latest_learnings || [];

    // 応答メッセージ
    const learningList = latestLearnings.length > 0
      ? latestLearnings.map(l => `✅ ${l}`).join('\n')
      : `✅ ${feedback}`;

    const message = `🧠 学習しました！

${learningList}

次回からずっと反映されます。

━━━━━━━━━━━
${revisedContent}
━━━━━━━━━━━

📚 累計学習回数: ${profile.interaction_count}回

「学習状況」で学習内容を確認できます。`;

    await replyText(replyToken, message);
  } catch (err) {
    console.error('[Feedback] 処理エラー:', err);
    await replyText(replyToken, '修正中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}

/**
 * フィードバックテキストから学習ヒントを簡易抽出
 */
function extractLearningHints(feedback) {
  const hints = {};
  if (!feedback) return hints;
  const lower = feedback.toLowerCase();

  // カジュアル/フォーマル系のキーワード検出
  // 両方含まれる場合に上書きされないよう push で追加
  const toneWords = [];
  if (lower.includes('カジュアル') || lower.includes('くだけた')) {
    toneWords.push('カジュアル');
  }
  if (lower.includes('丁寧') || lower.includes('フォーマル')) {
    toneWords.push('丁寧');
  }
  if (toneWords.length > 0) {
    hints.preferredWords = toneWords;
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
