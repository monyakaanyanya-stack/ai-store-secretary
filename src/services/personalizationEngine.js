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
  if (!profile) return '';

  const profileData = profile.profile_data || {};
  // interaction_count が 0 でも、エンゲージメント学習データがあれば反映する
  const el = profileData.engagement_learning || {};
  const hasEngagementLearning = (el.high_er_posts || 0) > 0 || (el.low_er_posts || 0) > 0;
  if (profile.interaction_count === 0 && !hasEngagementLearning) {
    return '';
  }

  const additions = [];

  // 口調の調整
  const toneAdj = profileData.tone_adjustments || {};
  if (toneAdj.casual > 0) {
    additions.push('・よりカジュアルな表現を好む');
  }
  if (toneAdj.formal > 0) {
    additions.push('・よりフォーマルな表現を好む');
  }

  // 文章長の好み
  const lengthPrefs = profileData.length_preferences || {};
  if (lengthPrefs.prefer_short > 0) {
    additions.push('・簡潔な表現を好む');
  }
  if (lengthPrefs.prefer_long > 0) {
    additions.push('・詳細な説明を好む');
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

  // エンゲージメント学習（実績から得た傾向）
  const el = profileData.engagement_learning || {};
  if (el.preferred_length) {
    additions.push(`・高エンゲージメント投稿の平均文字数: ${el.preferred_length}文字`);
  }
  if (el.preferred_emoji_count !== undefined) {
    additions.push(`・高エンゲージメント投稿の平均絵文字数: ${el.preferred_emoji_count}個`);
  }
  if (el.high_er_tone) {
    additions.push(`・高エンゲージメント時の傾向: ${el.high_er_tone}`);
  }

  if (additions.length === 0) return '';

  return `\n【パーソナライゼーション】\n${additions.join('\n')}`;
}

/**
 * エンゲージメント実績を学習プロファイルに反映
 * @param {string} storeId - 店舗ID
 * @param {string} postContent - 投稿内容
 * @param {Object} metricsData - エンゲージメント指標
 */
export async function applyEngagementToProfile(storeId, postContent, metricsData) {
  if (!storeId || !postContent) return;

  const profile = await getOrCreateLearningProfile(storeId);
  if (!profile) return;

  const profileData = profile.profile_data || {};
  const el = profileData.engagement_learning || {
    high_er_posts: 0,
    low_er_posts: 0,
    total_length: 0,
    total_emoji: 0,
  };

  const er = metricsData.engagement_rate || 0;
  const postLength = postContent.length;
  const emojiCount = (postContent.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;

  // ER 4% 以上を「高エンゲージメント」として学習
  if (er >= 4) {
    el.high_er_posts = (el.high_er_posts || 0) + 1;
    el.total_length = (el.total_length || 0) + postLength;
    el.total_emoji = (el.total_emoji || 0) + emojiCount;

    // 高ER投稿の平均的な特徴を計算
    el.preferred_length = Math.round(el.total_length / el.high_er_posts);
    el.preferred_emoji_count = Math.round(el.total_emoji / el.high_er_posts);

    // 文章が短めか長めかの傾向
    if (el.preferred_length < 100) {
      el.high_er_tone = '短文・テンポよい投稿';
    } else if (el.preferred_length > 250) {
      el.high_er_tone = '詳細な説明文';
    } else {
      el.high_er_tone = '中程度の文量';
    }
  } else if (er > 0 && er < 2) {
    el.low_er_posts = (el.low_er_posts || 0) + 1;
  }

  profileData.engagement_learning = el;

  await supabase
    .from('learning_profiles')
    .update({
      profile_data: profileData,
      updated_at: new Date().toISOString(),
    })
    .eq('store_id', storeId);

  console.log(`[Personalization] エンゲージメント学習完了: store=${storeId}, ER=${er}%, 高ER投稿=${el.high_er_posts}件`);
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

/**
 * 学習状況を可視化用に整形して取得
 * @param {string} storeId - 店舗ID
 * @param {string} category - 店舗カテゴリー
 * @returns {string} - フォーマットされた学習状況
 */
export async function getLearningStatus(storeId, category) {
  const profile = await getOrCreateLearningProfile(storeId);

  if (!profile || profile.interaction_count === 0) {
    return `📊 学習状況

【パーソナライゼーション】
まだ学習データがありません。

フィードバックを送ると、あなたの好みに合わせた投稿を生成できるようになります！

使い方:
「直し: もっとカジュアルに」
「直し: 絵文字を少なめに」
など、投稿後にフィードバックを送ってください。`;
  }

  const profileData = profile.profile_data || {};

  // パーソナライゼーション情報（レベル表示を削除し、学習回数のみ表示）
  let personalizationInfo = `【パーソナライゼーション】\n・学習回数: ${profile.interaction_count}回\n・フィードバックを重ねるほど精度が向上します\n`;

  // 口調の好み
  const toneAdj = profileData.tone_adjustments || {};
  if (toneAdj.casual > 0) {
    personalizationInfo += `・カジュアル好み: ${'⭐'.repeat(Math.min(toneAdj.casual, 5))}\n`;
  }
  if (toneAdj.formal > 0) {
    personalizationInfo += `・フォーマル好み: ${'⭐'.repeat(Math.min(toneAdj.formal, 5))}\n`;
  }

  // 絵文字スタイル
  if (profileData.emoji_style === 'minimal') {
    personalizationInfo += '・絵文字: 控えめ 🔇\n';
  } else if (profileData.emoji_style === 'rich') {
    personalizationInfo += '・絵文字: 豊富 🎉\n';
  }

  // 文章長の好み
  const lengthPrefs = profileData.length_preferences || {};
  if (lengthPrefs.prefer_short > 0) {
    personalizationInfo += '・文章: 簡潔派 📝\n';
  }
  if (lengthPrefs.prefer_long > 0) {
    personalizationInfo += '・文章: 詳細派 📖\n';
  }

  // 好まれる表現
  const wordPrefs = profileData.word_preferences || {};
  const topWords = Object.entries(wordPrefs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  if (topWords.length > 0) {
    personalizationInfo += `・好まれる表現: ${topWords.join(', ')}\n`;
  }

  // 集合知データ
  let collectiveInfo = '';
  if (category) {
    const { data: metrics } = await supabase
      .from('engagement_metrics')
      .select('*')
      .eq('category', category)
      .limit(100);

    if (metrics && metrics.length > 0) {
      collectiveInfo = `\n【集合知データ】\n・同業種データ数: ${metrics.length}件\n`;

      // 人気ハッシュタグ（使用回数ではなくエンゲージメント率で判定）
      const hashtagMetrics = {};
      metrics.forEach(m => {
        if (m.hashtags && m.engagement_rate != null) {
          m.hashtags.forEach(tag => {
            if (!hashtagMetrics[tag]) hashtagMetrics[tag] = { rates: [], count: 0 };
            hashtagMetrics[tag].rates.push(m.engagement_rate);
            hashtagMetrics[tag].count++;
          });
        }
      });

      const topHashtags = Object.entries(hashtagMetrics)
        .filter(([, d]) => d.count >= 2)
        .map(([tag, d]) => ({
          tag,
          avgEngagementRate: d.rates.reduce((a, b) => a + b, 0) / d.rates.length,
        }))
        .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
        .slice(0, 5)
        .map(item => item.tag);

      if (topHashtags.length > 0) {
        collectiveInfo += `・人気ハッシュタグ: ${topHashtags.join(', ')}\n`;
      }
    } else {
      collectiveInfo = `\n【集合知データ】\nまだ同業種のデータがありません。\n投稿を重ねることで、業界のトレンドを学習していきます。\n`;
    }
  }

  return `📊 学習状況

${personalizationInfo}${collectiveInfo}

💡 ヒント:
・フィードバックを送るほど、あなた好みの投稿になります
・「直し: 〜」で投稿を修正すると自動で学習します`;
}
