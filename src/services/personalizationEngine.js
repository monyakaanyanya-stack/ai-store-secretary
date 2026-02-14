import { supabase } from './supabaseService.js';

/**
 * 学習プロファイルを取得または作成
 * @param {string} storeId - 店舗ID
 * @returns {Object} - 学習プロファイル
 */
export async function getOrCreateLearningProfile(storeId) {
  // 既存プロファイルを検索
  const { data: existing } = await supabase
    .from('learning_profiles')
    .select('*')
    .eq('store_id', storeId)
    .single();

  if (existing) return existing;

  // 新規作成
  const { data: newProfile, error } = await supabase
    .from('learning_profiles')
    .insert({
      store_id: storeId,
      profile_data: {
        word_preferences: {},
        emoji_style: 'moderate',
        tone_adjustments: {},
        hashtag_patterns: [],
        length_preferences: {},
        topic_themes: [],
      },
      interaction_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('[Personalization] プロファイル作成エラー:', error.message);
    return null;
  }

  return newProfile;
}

/**
 * フィードバックを学習プロファイルに反映
 * @param {string} storeId - 店舗ID
 * @param {string} feedback - フィードバック内容
 * @param {string} originalPost - 元の投稿
 */
export async function applyFeedbackToProfile(storeId, feedback, originalPost) {
  const profile = await getOrCreateLearningProfile(storeId);
  if (!profile) return;

  const profileData = profile.profile_data || {};
  const wordPrefs = profileData.word_preferences || {};

  // フィードバックから学習
  // 例: "もっとカジュアルに" → tone_adjustments.casual += 1
  const feedbackLower = feedback.toLowerCase();

  // 口調の調整
  const toneAdjustments = profileData.tone_adjustments || {};
  if (feedbackLower.includes('カジュアル')) {
    toneAdjustments.casual = (toneAdjustments.casual || 0) + 1;
  }
  if (feedbackLower.includes('丁寧') || feedbackLower.includes('フォーマル')) {
    toneAdjustments.formal = (toneAdjustments.formal || 0) + 1;
  }
  if (feedbackLower.includes('短く') || feedbackLower.includes('簡潔')) {
    const lengthPrefs = profileData.length_preferences || {};
    lengthPrefs.prefer_short = (lengthPrefs.prefer_short || 0) + 1;
    profileData.length_preferences = lengthPrefs;
  }
  if (feedbackLower.includes('長く') || feedbackLower.includes('詳しく')) {
    const lengthPrefs = profileData.length_preferences || {};
    lengthPrefs.prefer_long = (lengthPrefs.prefer_long || 0) + 1;
    profileData.length_preferences = lengthPrefs;
  }

  // 絵文字スタイル
  if (feedbackLower.includes('絵文字') && feedbackLower.includes('少な')) {
    profileData.emoji_style = 'minimal';
  }
  if (feedbackLower.includes('絵文字') && feedbackLower.includes('多')) {
    profileData.emoji_style = 'rich';
  }

  // 特定の単語の好み
  // 例: "「新鮮な」という表現を使って" → word_preferences.新鮮な = +1
  const wordMatches = feedback.match(/「(.+?)」/g);
  if (wordMatches) {
    wordMatches.forEach(match => {
      const word = match.replace(/「|」/g, '');
      wordPrefs[word] = (wordPrefs[word] || 0) + 1;
    });
  }

  profileData.word_preferences = wordPrefs;
  profileData.tone_adjustments = toneAdjustments;

  // プロファイルを更新
  await supabase
    .from('learning_profiles')
    .update({
      profile_data: profileData,
      interaction_count: profile.interaction_count + 1,
      last_feedback_at: new Date().toISOString(),
    })
    .eq('store_id', storeId);

  console.log(`[Personalization] フィードバック学習完了: store=${storeId}`);
}

/**
 * 学習プロファイルをプロンプトに反映
 * @param {string} storeId - 店舗ID
 * @returns {string} - プロンプト用の追加情報
 */
export async function getPersonalizationPromptAddition(storeId) {
  const profile = await getOrCreateLearningProfile(storeId);
  if (!profile || profile.interaction_count === 0) {
    return '';
  }

  const profileData = profile.profile_data || {};
  const additions = [];

  // 口調の調整
  const toneAdj = profileData.tone_adjustments || {};
  if (toneAdj.casual > 0) {
    additions.push(`・よりカジュアルな表現を好む（学習回数: ${toneAdj.casual}回）`);
  }
  if (toneAdj.formal > 0) {
    additions.push(`・よりフォーマルな表現を好む（学習回数: ${toneAdj.formal}回）`);
  }

  // 文章長の好み
  const lengthPrefs = profileData.length_preferences || {};
  if (lengthPrefs.prefer_short > 0) {
    additions.push(`・簡潔な表現を好む（学習回数: ${lengthPrefs.prefer_short}回）`);
  }
  if (lengthPrefs.prefer_long > 0) {
    additions.push(`・詳細な説明を好む（学習回数: ${lengthPrefs.prefer_long}回）`);
  }

  // 絵文字スタイル
  if (profileData.emoji_style === 'minimal') {
    additions.push('・絵文字は控えめに使用');
  } else if (profileData.emoji_style === 'rich') {
    additions.push('・絵文字を豊富に使用');
  }

  // 好まれる単語
  const wordPrefs = profileData.word_preferences || {};
  const topWords = Object.entries(wordPrefs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  if (topWords.length > 0) {
    additions.push(`・好まれる表現: ${topWords.join(', ')}`);
  }

  if (additions.length === 0) return '';

  return `\n【パーソナライゼーション（${profile.interaction_count}回の学習データ）】\n${additions.join('\n')}`;
}

/**
 * パーソナライゼーションレベルを計算
 * @param {number} interactionCount - インタラクション回数
 * @returns {number} - レベル (0-5)
 */
export function getPersonalizationLevel(interactionCount) {
  if (interactionCount === 0) return 0;
  if (interactionCount < 5) return 1;
  if (interactionCount < 15) return 2;
  if (interactionCount < 30) return 3;
  if (interactionCount < 50) return 4;
  return 5;
}

/**
 * 投稿履歴にパーソナライゼーション適用フラグを保存
 * @param {string} postId - 投稿ID
 * @param {Object} appliedLearning - 適用した学習データ
 */
export async function markLearningApplied(postId, appliedLearning) {
  await supabase
    .from('post_history')
    .update({
      learning_applied: {
        own_learning: appliedLearning.ownLearning || false,
        category_insights: appliedLearning.categoryInsights || false,
        group_insights: appliedLearning.groupInsights || false,
        personalization_level: appliedLearning.personalizationLevel || 0,
      },
    })
    .eq('id', postId);
}
