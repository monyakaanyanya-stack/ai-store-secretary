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
  getAdvancedPersonalizationPrompt,
} from '../services/advancedPersonalization.js';

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
      console.log(`[Feedback] 思想ログ学習完了: beliefs=${analysis.beliefs?.length || 0}件`);
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
    const advancedPersonalization = await getAdvancedPersonalizationPrompt(store.id);
    const prompt = buildRevisionPrompt(store, latestPost.content, feedback, advancedPersonalization);
    const revisedContent = await askClaude(prompt);

    // 修正版で既存の投稿履歴を更新（新レコードを作らない）
    // → エンゲージメント報告時にlatestPostが修正版に誤紐付けされるのを防止
    await updatePostContent(latestPost.id, revisedContent);

    console.log(`[Feedback] 修正完了: store=${store.name}`);

    // 学習プロファイルを取得して学習回数・学習内容を確認
    const profile = await getOrCreateLearningProfile(store.id);
    const profileData = profile?.profile_data || {};

    // 今回学習した具体的な内容を取得
    const latestLearnings = profileData.latest_learnings || [];

    // 応答メッセージ（進化ログUI）
    const learningList = latestLearnings.length > 0
      ? latestLearnings.map(l => `✅ ${l}`).join('\n')
      : `✅ ${feedback}`;

    // 人格定義セクション（あれば表示）
    let personaSection = '';
    if (profileData.persona_definition) {
      personaSection = `\n【現在の人格定義 Ver.${profileData.persona_version || 1}】\n${profileData.persona_definition}\n`;
    }

    const message = `覚えました！修正版はこちら👇
━━━━━━━━━━━
${revisedContent}
━━━━━━━━━━━

【学んだこと】
${learningList}
${personaSection}
📚 ${profile.interaction_count}回目の学習${profileData.persona_version ? `（人格 Ver.${profileData.persona_version}）` : ''}`;

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

    // AI生成版とユーザー書き直し版の差分を分析
    // revisedPost に userRewrite を渡すことで「2つの版の差分分析」として機能させる
    const analysis = await analyzeFeedbackWithClaude(
      'ユーザーが書き直したバージョンとAI生成版を比較し、ユーザーの好む文体・語尾・口癖・表現の特徴を抽出してください。',
      latestPost.content,
      userRewrite
    );

    if (analysis) {
      await updateAdvancedProfile(store.id, analysis);
      console.log(`[StyleLearning] 見本学習完了: beliefs=${analysis.beliefs?.length || 0}件`);
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

    let personaSection = '';
    if (profileData.persona_definition) {
      personaSection = `\n【現在の人格定義 Ver.${profileData.persona_version || 1}】\n${profileData.persona_definition}\n`;
    }

    await replyText(replyToken, `見本から学習しました！

【学んだこと】
${learningList}
${personaSection}
📚 ${profile.interaction_count}回目の学習${profileData.persona_version ? `（人格 Ver.${profileData.persona_version}）` : ''}`);
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
