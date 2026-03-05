import { replyText } from '../services/lineService.js';
import { askClaude } from '../services/claudeService.js';
import {
  getStore,
  getLatestPost,
  saveLearningData,
  updatePostContent,
} from '../services/supabaseService.js';
import { buildRevisionPrompt } from '../utils/promptBuilder.js';
import { applyFeedbackToProfile, getOrCreateLearningProfile } from '../services/personalizationEngine.js';
import {
  analyzeFeedbackWithClaude,
  updateAdvancedProfile,
  getProfileAndPrompt,
} from '../services/advancedPersonalization.js';
import { checkGenerationLimit } from '../services/subscriptionService.js';

/**
 * フィードバック処理: 最新投稿を修正 + 学習データとして蓄積
 */
export async function handleFeedback(user, feedback, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, 'まだ店舗が登録されていないみたいです。「登録」で始められます！');
  }

  // S14修正: フィードバックの長さ制限（Claude APIトークン浪費防止）
  if (feedback.length > 500) {
    return await replyText(replyToken, 'ちょっと長すぎるかも...500文字以内でお願いします！');
  }

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '店舗が見つかりません。「店舗一覧」で確認してみてください');
    }

    // 最新の投稿を取得
    const latestPost = await getLatestPost(store.id);
    if (!latestPost) {
      return await replyText(replyToken, 'まだ投稿がないみたいです。先に画像やテキストを送ってください！');
    }

    // S17修正: ユーザー入力をログにそのまま出力しない（PII混入防止）
    console.log(`[Feedback] 高度な学習を使用: len=${feedback.length}`);

    // ── 修正生成フェーズ ──────────────────────────────────
    // 生成上限チェック（修正も1生成としてカウント）
    const genLimit = await checkGenerationLimit(user.id);
    if (!genLimit.allowed) {
      return await replyText(replyToken, `⚠️ 今月の生成上限（${genLimit.limit}回）に達しました。\n\n「アップグレード」で上限を増やせます。`);
    }

    // 「直し:」コマンドなので長短問わず常に修正案を返す
    // プロンプト注入用文字列 + diff分析用プロファイルを一括取得（DB1回）
    const { profileContext, advancedPersonalization } = await getProfileAndPrompt(store.id);
    const prompt = buildRevisionPrompt(store, latestPost.content, feedback, advancedPersonalization);
    const revisedContent = await askClaude(prompt);

    // 修正版で既存の投稿履歴を更新（新レコードを作らない）
    // → エンゲージメント報告時にlatestPostが修正版に誤紐付けされるのを防止
    await updatePostContent(latestPost.id, revisedContent);

    console.log(`[Feedback] 修正完了: store=${store.name}`);

    // ── diff学習フェーズ（統合モード: 分析+指示集更新を1回のAPIで）──
    // profileContext を渡すことで persona_definition_next も同時生成（API 3→2回に圧縮）
    const analysis = await analyzeFeedbackWithClaude(feedback, latestPost.content, revisedContent, profileContext);

    if (analysis) {
      await updateAdvancedProfile(store.id, analysis);
      console.log(`[Feedback] diff学習完了: beliefs=${analysis.beliefs?.length || 0}件, persona=${analysis.persona_definition_next ? '統合更新' : 'フォールバック'}`);
    }

    await saveLearningData(
      store.id,
      'feedback',
      latestPost.content,
      feedback,
      analysis || extractLearningHints(feedback)
    );

    // 学習プロファイルを取得して学習回数・学習内容を確認
    const profile = await getOrCreateLearningProfile(store.id);
    const profileData = profile?.profile_data || {};

    // 今回学習した具体的な内容を取得
    const latestLearnings = profileData.latest_learnings || [];

    // 応答メッセージ（進化ログUI）
    const learningList = latestLearnings.length > 0
      ? latestLearnings.map(l => `✅ ${l}`).join('\n')
      : `✅ ${feedback}`;

    const message = `覚えました！修正版はこちら👇
━━━━━━━━━━━
${revisedContent}
━━━━━━━━━━━

【学んだこと】
${learningList}
📚 ${profile.interaction_count}回目の学習`;

    await replyText(replyToken, message);
  } catch (err) {
    console.error('[Feedback] 処理エラー:', err);
    await replyText(replyToken, 'うまくいきませんでした...もう一度試してみてください');
  }
}

/**
 * 見本学習: ユーザーが自分で書き直したバージョンと AI 生成版を比較して学習
 * 「学習:〇〇」コマンドから呼ばれる
 */
export async function handleStyleLearning(user, userRewrite, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, 'まだ店舗が登録されていないみたいです。「登録」で始められます！');
  }

  if (!userRewrite.trim()) {
    return await replyText(replyToken, '「学習:」の後に書き直した文章を入れてください！\n\n例: 学習: α7C来たよ！まじ持ちやすくてやばい💫');
  }

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '店舗が見つかりません。「店舗一覧」で確認してみてください');
    }

    const latestPost = await getLatestPost(store.id);
    if (!latestPost) {
      return await replyText(replyToken, 'まだ投稿がないみたいです。先に投稿案を作ってから送ってください！');
    }

    console.log(`[StyleLearning] 見本学習開始: store=${store.name}, len=${userRewrite.length}`);

    // AI生成版とユーザー書き直し版の差分を分析（統合モード: 指示集も同時更新）
    const { profileContext } = await getProfileAndPrompt(store.id);
    const analysis = await analyzeFeedbackWithClaude(
      'ユーザーが書き直したバージョンとAI生成版を比較し、ユーザーの好む文体・語尾・口癖・表現の特徴を抽出してください。',
      latestPost.content,
      userRewrite,
      profileContext
    );

    if (analysis) {
      await updateAdvancedProfile(store.id, analysis);
      console.log(`[StyleLearning] 見本学習完了: beliefs=${analysis.beliefs?.length || 0}件, persona=${analysis.persona_definition_next ? '統合更新' : 'フォールバック'}`);
    }

    await saveLearningData(
      store.id,
      'style_sample',
      latestPost.content,
      userRewrite,
      analysis || {}
    );

    const profile = await getOrCreateLearningProfile(store.id);
    const profileData = profile?.profile_data || {};
    const latestLearnings = profileData.latest_learnings || [];

    const learningList = latestLearnings.length > 0
      ? latestLearnings.map(l => `✅ ${l}`).join('\n')
      : '✅ 文体パターンを学習しました';

    await replyText(replyToken, `見本から学習しました！

【学んだこと】
${learningList}
📚 ${profile.interaction_count}回目の学習`);
  } catch (err) {
    console.error('[StyleLearning] エラー:', err);
    await replyText(replyToken, 'うまくいきませんでした...もう一度試してみてください');
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
