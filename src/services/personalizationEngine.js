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
      // M11修正: 単語長が20文字以下のみ登録（攻撃的入力防止）
      if (word.length > 0 && word.length <= 20) {
        wordPrefs[word] = (wordPrefs[word] || 0) + 1;
      }
    });

    // M11修正: word_preferences のキー数を50件に制限（古い低スコアを削除）
    const keys = Object.keys(wordPrefs);
    if (keys.length > 50) {
      const sorted = keys.sort((a, b) => wordPrefs[a] - wordPrefs[b]);
      const toRemove = sorted.slice(0, keys.length - 50);
      toRemove.forEach(k => delete wordPrefs[k]);
    }
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

  console.log(`[Personalization] フィードバック学習完了: store=${storeId?.slice(0, 4)}…`);
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
  if (el.preferred_length) {
    additions.push(`・高エンゲージメント投稿の平均文字数: ${el.preferred_length}文字`);
  }
  if (el.preferred_emoji_count !== undefined) {
    additions.push(`・高エンゲージメント投稿の平均絵文字数: ${el.preferred_emoji_count}個`);
  }
  if (el.high_er_tone) {
    additions.push(`・高エンゲージメント時の傾向: ${el.high_er_tone}`);
  }

  // スタイル選好（案A/B/C の選択傾向）
  const styleSelections = profileData.style_selections;
  if (styleSelections && styleSelections.total >= 3) {
    const sorted = Object.entries(styleSelections)
      .filter(([k]) => k !== 'total')
      .sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] > 0) {
      const topStyle = sorted[0][0];
      const topPct = Math.round((sorted[0][1] / styleSelections.total) * 100);
      additions.push(`・好みの切り口: ${topStyle}（${topPct}%） → 3案のうち1案をこの傾向に寄せること`);
    }
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
  // C14修正: save_intensity ベースの学習も考慮（ERが0でもsave_intensityが高ければ学習対象）
  const si = metricsData.save_intensity || 0;
  const postLength = postContent.length;
  const emojiCount = (postContent.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;

  // ER 4% 以上 or 保存強度 0.15 以上を「高エンゲージメント」として学習
  const isHighEngagement = er >= 4 || si >= 0.15;

  if (isHighEngagement) {
    el.high_er_posts = (el.high_er_posts || 0) + 1;
    el.total_length = (el.total_length || 0) + postLength;
    el.total_emoji = (el.total_emoji || 0) + emojiCount;

    // C14修正: 指数移動平均（EMA）で新しいデータを重視
    // α = 0.3 → 直近のデータに30%の重みを与える
    const alpha = 0.3;
    if (el.high_er_posts === 1) {
      // 最初のデータはそのまま
      el.preferred_length = postLength;
      el.preferred_emoji_count = emojiCount;
    } else {
      // EMA: new = α * current + (1-α) * previous
      el.preferred_length = Math.round(alpha * postLength + (1 - alpha) * (el.preferred_length || postLength));
      el.preferred_emoji_count = Math.round(alpha * emojiCount + (1 - alpha) * (el.preferred_emoji_count || emojiCount));
    }

    // 文章が短めか長めかの傾向
    if (el.preferred_length < 100) {
      el.high_er_tone = '短文・テンポよい投稿';
    } else if (el.preferred_length > 250) {
      el.high_er_tone = '詳細な説明文';
    } else {
      el.high_er_tone = '中程度の文量';
    }
  } else if ((er > 0 && er < 2) || (si > 0 && si < 0.05)) {
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

  console.log(`[Personalization] エンゲージメント学習完了: store=${storeId?.slice(0, 4)}…, ER=${er}%, 高ER投稿=${el.high_er_posts}件`);
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
 * 学習状況を可視化用に整形して取得
 * @param {string} storeId - 店舗ID
 * @param {string} category - 店舗カテゴリー
 * @returns {string} - フォーマットされた学習状況
 */
export async function getLearningStatus(storeId, category) {
  const profile = await getOrCreateLearningProfile(storeId);

  if (!profile || profile.interaction_count === 0) {
    return `📊 学習状況

まだ学習データがありません。

フィードバックを送ると、あなたの好みに合わせた投稿を生成できるようになります！

使い方:
「学習: もっとカジュアルに」
「学習: 絵文字を少なめに」
など、投稿後にフィードバックを送ってください。`;
  }

  const profileData = profile.profile_data || {};
  const beliefLogs = profileData.belief_logs || [];
  let sections = [];

  // ── 人格定義セクション ──
  if (profileData.persona_definition) {
    sections.push(`【人格定義 Ver.${profileData.persona_version || 1}】\n${profileData.persona_definition}`);
  } else if (beliefLogs.length > 0) {
    // 人格未生成時はログをそのまま表示
    sections.push(`【学習中の好み】\n${beliefLogs.map(b => `・${b.text}`).join('\n')}\n\nあと${Math.max(0, 5 - beliefLogs.length)}回フィードバックすると人格定義が生成されます！`);
  }

  // ── 恒久ルールセクション ──
  const coreBeliefs = profileData.core_beliefs || [];
  if (coreBeliefs.length > 0) {
    const coreLines = coreBeliefs
      .sort((a, b) => (b.hit_count || 0) - (a.hit_count || 0))
      .map(cb => `・${cb.text}`)
      .join('\n');
    sections.push(`🔒【絶対ルール（${coreBeliefs.length}件）】\n${coreLines}`);
  }

  // ── 進化の軌跡セクション ──
  const history = profileData.persona_history || [];
  if (history.length > 0) {
    const historyLines = history.map(h => {
      const date = new Date(h.created_at);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      return `Ver.${h.version} (${dateStr})`;
    });
    sections.push(`【進化の軌跡】\n${historyLines.join('\n')}`);
  }

  // ── 学習データセクション ──
  let dataInfo = `【学習データ】\n・学習回数: ${profile.interaction_count}回`;
  if (beliefLogs.length > 0) {
    dataInfo += `\n・思想ログ: ${beliefLogs.length}件`;
  }

  // 語尾・口癖
  const ws = profileData.writing_style || {};
  if (ws.sentence_endings?.length > 0) {
    dataInfo += `\n・語尾: 「${ws.sentence_endings.join('」「')}」`;
  }
  if (ws.catchphrases?.length > 0) {
    dataInfo += `\n・口癖: 「${ws.catchphrases.join('」「')}」`;
  }

  // 避ける表現
  const avoided = profileData.avoided_words || [];
  if (avoided.length > 0) {
    dataInfo += `\n・避ける表現: ${avoided.slice(0, 5).join(', ')}${avoided.length > 5 ? '...' : ''}`;
  }

  sections.push(dataInfo);

  // ── 集合知データ ──
  if (category) {
    const { data: metrics } = await supabase
      .from('engagement_metrics')
      .select('*')
      .eq('category', category)
      .limit(100);

    if (metrics && metrics.length > 0) {
      let collectiveInfo = `【集合知データ】\n・同業種データ数: ${metrics.length}件`;

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
        collectiveInfo += `\n・人気ハッシュタグ: ${topHashtags.join(', ')}`;
      }
      sections.push(collectiveInfo);
    }
  }

  return `📊 学習状況

${sections.join('\n\n')}

💡 「学習: 〜」で修正するほど人格が育ちます`;
}

/**
 * 学習精度アップの進捗メモを返す（投稿メッセージ埋め込み用）
 *
 * マイルストーン:
 *   0〜2件 → 人格定義の初回生成まで（3件必要）
 *   3件〜  → 次の人格更新まで（3件刻み）
 *
 * @param {string} storeId - 店舗ID
 * @returns {Promise<string>} - 例: '\n📈 学習精度アップまであと2回'（進捗なし時は空文字）
 */
export async function getLearningProgressNote(storeId) {
  try {
    const profile = await getOrCreateLearningProfile(storeId);
    if (!profile) return '';

    const profileData = profile.profile_data || {};
    const beliefLogs = profileData.belief_logs || [];

    // feedback ソースのログ数をカウント
    const feedbackCount = beliefLogs.filter(b => b.source === 'feedback').length;

    // 人格定義が未生成の場合: 3件で初回生成
    if (!profileData.persona_definition) {
      const remaining = Math.max(0, 3 - feedbackCount);
      if (remaining > 0) {
        return `\n📈 学習精度アップまであと${remaining}回`;
      }
      // 3件あるが persona がまだ未生成（次の投稿で生成される予定）
      return '\n📈 まもなく学習精度がアップします！';
    }

    // 人格定義が生成済み: 次の精度アップまでの残り
    // 3件刻みで精度アップ（persona更新のトリガー）
    const nextMilestone = Math.ceil((feedbackCount + 1) / 3) * 3;
    const remaining = nextMilestone - feedbackCount;
    if (remaining > 0 && remaining <= 3) {
      return `\n📈 次の学習精度アップまであと${remaining}回`;
    }

    return '';
  } catch (err) {
    console.error('[Personalization] 学習進捗取得エラー:', err.message);
    return '';
  }
}
