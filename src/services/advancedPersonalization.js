import { supabase } from './supabaseService.js';
import { askClaude } from './claudeService.js';

/**
 * 高度なフィードバック分析（Claude APIを使用）
 * @param {string} feedback - フィードバック内容
 * @param {string} originalPost - 元の投稿
 * @param {string} revisedPost - 修正後の投稿（もしあれば）
 * @returns {Object} - 構造化されたフィードバック分析
 */
export async function analyzeFeedbackWithClaude(feedback, originalPost, revisedPost = null) {
  const prompt = `以下のフィードバックを分析して、ユーザーの好みを構造化してください。

【元の投稿】
${originalPost}

${revisedPost ? `【修正後の投稿】\n${revisedPost}\n` : ''}

【フィードバック】
${feedback}

以下のJSON形式で出力してください（それ以外は何も出力しないこと）:
{
  "tone": {
    "casual": number (-5 〜 +5),
    "formal": number (-5 〜 +5),
    "friendly": number (-5 〜 +5),
    "professional": number (-5 〜 +5)
  },
  "emoji_preference": {
    "frequency": "minimal" | "moderate" | "rich",
    "change_degree": number (-5 〜 +5)
  },
  "length_preference": {
    "prefer_short": number (-5 〜 +5),
    "prefer_long": number (-5 〜 +5),
    "target_chars": number | null
  },
  "expression_patterns": {
    "avoided_words": [string],
    "preferred_words": [string],
    "avoided_phrases": [string],
    "preferred_phrases": [string]
  },
  "writing_style": {
    "sentence_endings": [string],
    "catchphrases": [string],
    "line_break_style": "frequent" | "normal" | null,
    "punctuation": string | null
  },
  "hashtag_preference": {
    "quantity": number (-5 〜 +5),
    "style": "trending" | "niche" | "mixed"
  },
  "call_to_action": {
    "strength": number (-5 〜 +5),
    "style": "direct" | "soft" | "none"
  },
  "summary": string,
  "human_readable_learnings": [string]
}

説明:
- 数値は-5（とても減らす）〜+5（とても増やす）のスケール
- 変化がない場合は0
- フィードバックから明確に読み取れる内容のみ記載
- writing_style.sentence_endings: 「〜だわ」「〜じゃん」「笑」「w」など語尾・文末表現をそのまま抽出
- writing_style.catchphrases: 「まじ」「やばい」など口癖となりうる表現
- human_readable_learnings: ユーザーに見せる「今回学習したこと」を箇条書きで3件以内（例: ["語尾を「〜だわ」スタイルに変更", "絵文字を減らす", "短文中心にする"]）`;

  try {
    const response = await askClaude(prompt, {
      max_tokens: 1000,
      temperature: 0.2,
    });

    const analysis = JSON.parse(response);
    return analysis;
  } catch (err) {
    console.error('[AdvancedPersonalization] フィードバック分析エラー:', err.message);
    return null;
  }
}

/**
 * 高度な学習プロファイルの更新
 * @param {string} storeId - 店舗ID
 * @param {Object} analysis - Claude APIによる分析結果
 */
export async function updateAdvancedProfile(storeId, analysis) {
  if (!analysis) return;

  const { data: profile } = await supabase
    .from('learning_profiles')
    .select('*')
    .eq('store_id', storeId)
    .single();

  if (!profile) return;

  const profileData = profile.profile_data || {};

  // 口調の累積学習（重み付け平均）
  const toneAdj = profileData.tone_adjustments || {};
  Object.entries(analysis.tone).forEach(([key, value]) => {
    if (value !== 0) {
      const current = toneAdj[key] || 0;
      // 新しい値を加重平均で反映（最近のフィードバックに重みを置く）
      toneAdj[key] = current * 0.7 + value * 0.3;
    }
  });

  // 絵文字の好み
  if (analysis.emoji_preference.frequency) {
    profileData.emoji_style = analysis.emoji_preference.frequency;
  }

  // 文章長の好み
  const lengthPrefs = profileData.length_preferences || {};
  if (analysis.length_preference.prefer_short !== 0) {
    lengthPrefs.prefer_short = (lengthPrefs.prefer_short || 0) + analysis.length_preference.prefer_short;
  }
  if (analysis.length_preference.prefer_long !== 0) {
    lengthPrefs.prefer_long = (lengthPrefs.prefer_long || 0) + analysis.length_preference.prefer_long;
  }
  if (analysis.length_preference.target_chars) {
    lengthPrefs.target_chars = analysis.length_preference.target_chars;
  }

  // 表現パターン
  const wordPrefs = profileData.word_preferences || {};

  // 避けるべき単語
  const avoidedWords = profileData.avoided_words || [];
  analysis.expression_patterns.avoided_words.forEach(word => {
    if (!avoidedWords.includes(word)) {
      avoidedWords.push(word);
    }
  });

  // 好まれる単語
  analysis.expression_patterns.preferred_words.forEach(word => {
    wordPrefs[word] = (wordPrefs[word] || 0) + 5;
  });

  // 語尾・文体スタイル（最重要：次回投稿に直接反映される）
  if (analysis.writing_style) {
    const writingStyle = profileData.writing_style || {};

    // 語尾パターン（上書きではなく蓄積）
    if (analysis.writing_style.sentence_endings && analysis.writing_style.sentence_endings.length > 0) {
      const currentEndings = writingStyle.sentence_endings || [];
      analysis.writing_style.sentence_endings.forEach(ending => {
        if (!currentEndings.includes(ending)) {
          currentEndings.push(ending);
        }
      });
      // 最新5件のみ保持
      writingStyle.sentence_endings = currentEndings.slice(-5);
    }

    // 口癖・フレーズ
    if (analysis.writing_style.catchphrases && analysis.writing_style.catchphrases.length > 0) {
      const currentPhrases = writingStyle.catchphrases || [];
      analysis.writing_style.catchphrases.forEach(phrase => {
        if (!currentPhrases.includes(phrase)) {
          currentPhrases.push(phrase);
        }
      });
      writingStyle.catchphrases = currentPhrases.slice(-10);
    }

    // 改行スタイル
    if (analysis.writing_style.line_break_style) {
      writingStyle.line_break_style = analysis.writing_style.line_break_style;
    }

    // 句読点スタイル
    if (analysis.writing_style.punctuation) {
      writingStyle.punctuation = analysis.writing_style.punctuation;
    }

    profileData.writing_style = writingStyle;
  }

  // 人間に見せる学習サマリー
  if (analysis.human_readable_learnings && analysis.human_readable_learnings.length > 0) {
    profileData.latest_learnings = analysis.human_readable_learnings;
  }

  // ハッシュタグスタイル
  const hashtagPrefs = profileData.hashtag_preferences || {};
  if (analysis.hashtag_preference.quantity !== 0) {
    hashtagPrefs.quantity_adjustment = (hashtagPrefs.quantity_adjustment || 0) + analysis.hashtag_preference.quantity;
  }
  if (analysis.hashtag_preference.style) {
    hashtagPrefs.style = analysis.hashtag_preference.style;
  }

  // CTAの好み
  const ctaPrefs = profileData.cta_preferences || {};
  if (analysis.call_to_action.strength !== 0) {
    ctaPrefs.strength = (ctaPrefs.strength || 0) + analysis.call_to_action.strength;
  }
  if (analysis.call_to_action.style) {
    ctaPrefs.style = analysis.call_to_action.style;
  }

  // 学習サマリーを保存
  const learningSummaries = profileData.learning_summaries || [];
  learningSummaries.push({
    timestamp: new Date().toISOString(),
    summary: analysis.summary,
  });

  // 最新10件のみ保持
  if (learningSummaries.length > 10) {
    learningSummaries.shift();
  }

  // プロファイルを更新
  await supabase
    .from('learning_profiles')
    .update({
      profile_data: {
        ...profileData,
        tone_adjustments: toneAdj,
        length_preferences: lengthPrefs,
        word_preferences: wordPrefs,
        avoided_words: avoidedWords,
        hashtag_preferences: hashtagPrefs,
        cta_preferences: ctaPrefs,
        learning_summaries: learningSummaries,
      },
      interaction_count: profile.interaction_count + 1,
      last_feedback_at: new Date().toISOString(),
    })
    .eq('store_id', storeId);

  console.log(`[AdvancedPersonalization] 高度な学習完了: ${analysis.summary}`);
}

/**
 * 高度な学習プロファイルをプロンプトに反映
 * @param {string} storeId - 店舗ID
 * @returns {string} - プロンプト用の詳細な学習情報
 */
export async function getAdvancedPersonalizationPrompt(storeId) {
  const { data: profile } = await supabase
    .from('learning_profiles')
    .select('*')
    .eq('store_id', storeId)
    .single();

  if (!profile || profile.interaction_count === 0) {
    return '';
  }

  const profileData = profile.profile_data || {};
  const additions = [];

  // 口調の詳細な調整
  const toneAdj = profileData.tone_adjustments || {};
  Object.entries(toneAdj).forEach(([key, value]) => {
    if (Math.abs(value) > 0.5) {
      const direction = value > 0 ? 'より' : 'やや控えめに';
      const intensity = Math.abs(value) > 3 ? '強く' : '';
      additions.push(`・${key}な表現を${intensity}${direction}使う`);
    }
  });

  // 絵文字の好み
  if (profileData.emoji_style === 'minimal') {
    additions.push('・絵文字は最小限（1-2個程度）');
  } else if (profileData.emoji_style === 'rich') {
    additions.push('・絵文字を豊富に使う（5個以上）');
  }

  // 文章長
  const lengthPrefs = profileData.length_preferences || {};
  if (lengthPrefs.target_chars) {
    additions.push(`・目標文字数: 約${lengthPrefs.target_chars}文字`);
  } else {
    if (lengthPrefs.prefer_short > 2) {
      additions.push('・簡潔な表現を強く好む');
    } else if (lengthPrefs.prefer_long > 2) {
      additions.push('・詳細な説明を好む');
    }
  }

  // 避けるべき表現
  const avoidedWords = profileData.avoided_words || [];
  if (avoidedWords.length > 0) {
    additions.push(`・避ける表現: ${avoidedWords.join(', ')}`);
  }

  // 好まれる表現
  const wordPrefs = profileData.word_preferences || {};
  const topWords = Object.entries(wordPrefs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
  if (topWords.length > 0) {
    additions.push(`・好む表現: ${topWords.join(', ')}`);
  }

  // ハッシュタグスタイル
  const hashtagPrefs = profileData.hashtag_preferences || {};
  if (hashtagPrefs.style) {
    const styleDesc = {
      trending: 'トレンド重視',
      niche: 'ニッチなタグ重視',
      mixed: 'バランス型',
    };
    additions.push(`・ハッシュタグ: ${styleDesc[hashtagPrefs.style]}`);
  }

  // CTA
  const ctaPrefs = profileData.cta_preferences || {};
  if (ctaPrefs.style) {
    const styleDesc = {
      direct: '直接的な行動喚起',
      soft: '柔らかい誘導',
      none: '行動喚起なし',
    };
    additions.push(`・CTA: ${styleDesc[ctaPrefs.style]}`);
  }

  // 語尾・文体スタイル（最重要：最初に記載して優先度を上げる）
  const writingStyle = profileData.writing_style || {};
  const writingAdditions = [];

  if (writingStyle.sentence_endings && writingStyle.sentence_endings.length > 0) {
    writingAdditions.push(`語尾は「${writingStyle.sentence_endings.join('」「')}」のスタイルを使う（厳守）`);
  }
  if (writingStyle.catchphrases && writingStyle.catchphrases.length > 0) {
    writingAdditions.push(`「${writingStyle.catchphrases.join('」「')}」などの口癖を自然に使う`);
  }
  if (writingStyle.line_break_style === 'frequent') {
    writingAdditions.push('改行を多めに使って縦に展開する');
  }

  // 最近の学習サマリー
  const summaries = profileData.learning_summaries || [];
  if (summaries.length > 0) {
    const recentSummaries = summaries.slice(-3).map(s => s.summary);
    additions.push(`・最近の学習: ${recentSummaries.join(' / ')}`);
  }

  if (writingAdditions.length === 0 && additions.length === 0) return '';

  const writingSection = writingAdditions.length > 0
    ? `\n【この人の文体（最優先で反映）】\n${writingAdditions.map(a => `・${a}`).join('\n')}`
    : '';

  const generalSection = additions.length > 0
    ? `\n【高度なパーソナライゼーション（${profile.interaction_count}回の学習）】\n${additions.join('\n')}`
    : '';

  return writingSection + generalSection;
}

/**
 * 学習精度スコアを計算
 * @param {string} storeId - 店舗ID
 * @returns {number} - 精度スコア (0-100)
 */
export async function calculateLearningAccuracy(storeId) {
  const { data: profile } = await supabase
    .from('learning_profiles')
    .select('*')
    .eq('store_id', storeId)
    .single();

  if (!profile || profile.interaction_count === 0) {
    return 0;
  }

  const profileData = profile.profile_data || {};
  let score = 0;

  // 基本スコア（インタラクション回数ベース）
  score += Math.min(profile.interaction_count * 2, 50); // 最大50点

  // データの充実度ボーナス
  if (Object.keys(profileData.tone_adjustments || {}).length > 0) score += 10;
  if ((profileData.word_preferences || {}).length > 3) score += 10;
  if ((profileData.avoided_words || []).length > 0) score += 5;
  if (profileData.emoji_style) score += 5;
  if (profileData.length_preferences?.target_chars) score += 10;
  if (profileData.hashtag_preferences?.style) score += 5;
  if (profileData.cta_preferences?.style) score += 5;

  return Math.min(score, 100);
}
