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
import { applyFeedbackToProfile } from '../services/personalizationEngine.js';
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

    let revisedContent;
    let learningMethod = 'basic'; // 'basic' or 'advanced'

    // フィードバックが詳細な場合は高度な分析を使用
    if (feedback.length > 10) {
      // 詳細なフィードバック（10文字以上）→ Claude API分析
      console.log(`[Feedback] 高度な学習を使用: "${feedback}"`);
      learningMethod = 'advanced';

      // Claude APIでフィードバックを分析
      const analysis = await analyzeFeedbackWithClaude(feedback, latestPost.content);

      if (analysis) {
        // 高度なプロファイルを更新
        await updateAdvancedProfile(store.id, analysis);
        console.log(`[Feedback] 高度な学習完了: ${analysis.summary}`);
      }

      // フィードバックを学習データとして保存
      await saveLearningData(
        store.id,
        'feedback',
        latestPost.content,
        feedback,
        analysis || extractLearningHints(feedback)
      );

      // 学習データを集約
      const learningData = await aggregateLearningData(store.id);

      // 高度な学習データ（語尾・文体スタイルなど）を取得
      const advancedPersonalization = await getAdvancedPersonalizationPrompt(store.id);

      // 修正版を生成
      const prompt = buildRevisionPrompt(store, learningData, latestPost.content, feedback, advancedPersonalization);
      revisedContent = await askClaude(prompt);

      // 修正版を投稿履歴に保存
      await savePostHistory(user.id, store.id, revisedContent);
    } else {
      // 簡易フィードバック（👍👎など）→ キーワードマッチ
      console.log(`[Feedback] 基本学習を使用: "${feedback}"`);
      learningMethod = 'basic';

      // 基本的なパーソナライゼーション（キーワードマッチ）
      await applyFeedbackToProfile(store.id, feedback, latestPost.content);

      // フィードバックを学習データとして保存
      await saveLearningData(
        store.id,
        'feedback',
        latestPost.content,
        feedback,
        extractLearningHints(feedback)
      );

      // 簡易フィードバックの場合は修正版を生成しない
      revisedContent = null;
    }

    console.log(`[Feedback] 修正完了: store=${store.name}, method=${learningMethod}`);

    // 学習プロファイルを取得して学習回数・学習内容を確認
    const { getOrCreateLearningProfile } = await import('../services/personalizationEngine.js');
    const profile = await getOrCreateLearningProfile(store.id);
    const profileData = profile?.profile_data || {};

    // 今回学習した具体的な内容を取得
    const latestLearnings = profileData.latest_learnings || [];

    // 応答メッセージ
    let message;
    if (revisedContent) {
      // 詳細フィードバックの場合（修正版あり）
      const learningList = latestLearnings.length > 0
        ? latestLearnings.map(l => `✅ ${l}`).join('\n')
        : `✅ ${feedback}`;

      message = `🧠 学習しました！

${learningList}

次回からずっと反映されます。

━━━━━━━━━━━
${revisedContent}
━━━━━━━━━━━

📚 累計学習回数: ${profile.interaction_count}回

「学習状況」で学習内容を確認できます。`;
    } else {
      // 簡易フィードバックの場合（修正版なし）
      message = `✅ 学習しました！

・${feedback}

📚 累計学習回数: ${profile.interaction_count}回
次回の投稿から反映されます。

より具体的に教えると精度が上がります
例: 「直し: 語尾を〜だわにして、もっと短く」`;
    }

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
