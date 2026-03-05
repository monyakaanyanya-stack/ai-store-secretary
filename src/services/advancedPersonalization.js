import { supabase } from './supabaseService.js';
import { askClaude } from './claudeService.js';

// 思想ログの上限
const MAX_BELIEF_LOGS = 20;
// 人格要約の履歴上限
const MAX_PERSONA_HISTORY = 5;
// 人格要約生成の最低ログ数（早期に学習効果を実感させるため3件に設定）
const MIN_BELIEFS_FOR_PERSONA = 3;

/**
 * フィードバックから店主の思想・価値観を抽出（Claude APIを使用）
 * @param {string} feedback - フィードバック内容
 * @param {string} originalPost - 元の投稿
 * @param {string} revisedPost - 修正後の投稿（もしあれば）
 * @returns {Object|null} - 思想ログ用の分析結果
 */
export async function analyzeFeedbackWithClaude(feedback, originalPost, revisedPost = null) {
  const prompt = `以下のフィードバックを分析して、この店主の「文章に対する思想・価値観・好み」を抽出してください。

【元の投稿】
${originalPost}

${revisedPost ? `【修正後の投稿】\n${revisedPost}\n` : ''}

【フィードバック】
${feedback}

以下のJSON形式で出力してください（それ以外は何も出力しないこと）:
{
  "beliefs": [string],
  "writing_style": {
    "sentence_endings": [string],
    "catchphrases": [string],
    "line_break_style": "frequent" | "normal" | null
  },
  "avoided_words": [string],
  "preferred_words": [string],
  "human_readable_learnings": [string]
}

説明:
- beliefs: この店主の文章に対する思想・価値観を短い日本語文で1〜3件抽出（例: "売り込みは強くしたくない", "余韻を残す文章が好き", "カジュアルだけど安っぽくはしたくない"）。フィードバックの背景にある「なぜそう直したいのか」を読み取って言語化する
- writing_style.sentence_endings: 「〜だわ」「〜じゃん」「笑」「w」など語尾・文末表現をそのまま抽出
- writing_style.catchphrases: 「まじ」「やばい」など口癖となりうる表現
- avoided_words: 避けるべき表現・単語
- preferred_words: 好まれる表現・単語
- human_readable_learnings: ユーザーに見せる「今回学習したこと」を3件以内（例: ["余韻を残す表現を重視", "売り込み表現を控えめに"]）`;

  try {
    const response = await askClaude(prompt, {
      max_tokens: 800,
      temperature: 0.2,
    });

    let analysis;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON部分が見つかりません');
      }
      analysis = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.warn('[AdvancedPersonalization] JSON解析失敗（基本学習にフォールバック）:', parseErr.message);
      return null;
    }

    return analysis;
  } catch (err) {
    console.error('[AdvancedPersonalization] フィードバック分析エラー:', err.message);
    return null;
  }
}

/**
 * 思想ログベースのプロファイル更新
 * @param {string} storeId - 店舗ID
 * @param {Object} analysis - analyzeFeedbackWithClaude の結果
 * @param {string|null} feedbackText - 修正指示の原文（直近3件をプロンプトに反映するため保存）
 */
export async function updateAdvancedProfile(storeId, analysis, feedbackText = null) {
  if (!analysis) return;

  const { data: profile } = await supabase
    .from('learning_profiles')
    .select('*')
    .eq('store_id', storeId)
    .single();

  if (!profile) return;

  const profileData = profile.profile_data || {};

  // ── 1. 思想ログ（belief_logs）に追加 ──
  const beliefLogs = profileData.belief_logs || [];
  if (Array.isArray(analysis.beliefs)) {
    const now = new Date().toISOString();
    for (const belief of analysis.beliefs) {
      if (!belief || typeof belief !== 'string') continue;
      // 重複排除（完全一致）
      if (beliefLogs.some(b => b.text === belief)) continue;
      beliefLogs.push({ text: belief, source: 'feedback', created_at: now });
    }
    // 上限超過時は古いものから削除
    while (beliefLogs.length > MAX_BELIEF_LOGS) {
      beliefLogs.shift();
    }
  }
  profileData.belief_logs = beliefLogs;

  // ── 2. 語尾・口癖（writing_style）は既存ロジック維持 ──
  if (analysis.writing_style) {
    const writingStyle = profileData.writing_style || {};

    if (Array.isArray(analysis.writing_style.sentence_endings) && analysis.writing_style.sentence_endings.length > 0) {
      const currentEndings = writingStyle.sentence_endings || [];
      analysis.writing_style.sentence_endings.forEach(ending => {
        if (!currentEndings.includes(ending)) {
          currentEndings.push(ending);
        }
      });
      writingStyle.sentence_endings = currentEndings.slice(-5);
    }

    if (Array.isArray(analysis.writing_style.catchphrases) && analysis.writing_style.catchphrases.length > 0) {
      const currentPhrases = writingStyle.catchphrases || [];
      analysis.writing_style.catchphrases.forEach(phrase => {
        if (!currentPhrases.includes(phrase)) {
          currentPhrases.push(phrase);
        }
      });
      writingStyle.catchphrases = currentPhrases.slice(-10);
    }

    if (analysis.writing_style.line_break_style) {
      writingStyle.line_break_style = analysis.writing_style.line_break_style;
    }

    profileData.writing_style = writingStyle;
  }

  // ── 3. 避ける単語・好む単語 ──
  const MAX_AVOIDED_WORDS = 50;
  const avoidedWords = profileData.avoided_words || [];
  if (Array.isArray(analysis.avoided_words)) {
    analysis.avoided_words.forEach(word => {
      if (!avoidedWords.includes(word) && avoidedWords.length < MAX_AVOIDED_WORDS) {
        avoidedWords.push(word);
      }
    });
  }
  profileData.avoided_words = avoidedWords;

  const wordPrefs = profileData.word_preferences || {};
  if (Array.isArray(analysis.preferred_words)) {
    analysis.preferred_words.forEach(word => {
      wordPrefs[word] = (wordPrefs[word] || 0) + 5;
    });
  }
  profileData.word_preferences = wordPrefs;

  // ── 4. 人間に見せる学習サマリー ──
  if (Array.isArray(analysis.human_readable_learnings) && analysis.human_readable_learnings.length > 0) {
    profileData.latest_learnings = analysis.human_readable_learnings;
  }

  // ── 4.5. 直近の修正指示を保存（最新3件FIFO） ──
  if (feedbackText && typeof feedbackText === 'string' && feedbackText.length <= 500) {
    const recentFeedbacks = profileData.recent_feedbacks || [];
    recentFeedbacks.push({
      text: feedbackText,
      created_at: new Date().toISOString(),
    });
    while (recentFeedbacks.length > 3) {
      recentFeedbacks.shift();
    }
    profileData.recent_feedbacks = recentFeedbacks;
  }

  // ── 5. プロファイル更新 ──
  const newInteractionCount = profile.interaction_count + 1;
  await supabase
    .from('learning_profiles')
    .update({
      profile_data: profileData,
      interaction_count: newInteractionCount,
      last_feedback_at: new Date().toISOString(),
    })
    .eq('store_id', storeId);

  console.log(`[AdvancedPersonalization] 思想ログ更新: beliefs=${beliefLogs.length}件, interaction=${newInteractionCount}`);

  // ── 6. 人格要約の生成（条件付き） ──
  if (beliefLogs.length >= MIN_BELIEFS_FOR_PERSONA) {
    const prevBeliefCount = profileData._last_persona_belief_count || 0;
    const newBeliefsAdded = beliefLogs.length - prevBeliefCount;
    // 初回生成 or 前回から3件以上新規ログがあれば再生成
    if (!profileData.persona_definition || newBeliefsAdded >= 3) {
      try {
        await regeneratePersonaDefinition(storeId, profileData, beliefLogs);
      } catch (personaErr) {
        console.error('[AdvancedPersonalization] 人格要約生成エラー（学習は成功）:', personaErr.message);
      }
    }
  }
}

/**
 * 思想ログを直接追加（Claude API 呼び出しなし）
 * A/B/C選択や👍評価など、軽量な思想追加に使用
 * @param {string} storeId - 店舗ID
 * @param {string} beliefText - 思想テキスト
 * @param {string} source - ソース種別
 */
export async function addSimpleBelief(storeId, beliefText, source) {
  const { data: profile } = await supabase
    .from('learning_profiles')
    .select('profile_data')
    .eq('store_id', storeId)
    .single();

  if (!profile) return;

  const profileData = profile.profile_data || {};
  const beliefLogs = profileData.belief_logs || [];

  // 重複排除
  if (beliefLogs.some(b => b.text === beliefText)) return;

  beliefLogs.push({ text: beliefText, source, created_at: new Date().toISOString() });
  while (beliefLogs.length > MAX_BELIEF_LOGS) {
    beliefLogs.shift();
  }
  profileData.belief_logs = beliefLogs;

  await supabase
    .from('learning_profiles')
    .update({ profile_data: profileData })
    .eq('store_id', storeId);

  console.log(`[AdvancedPersonalization] 思想ログ追加: "${beliefText}" (${source})`);
}

/**
 * 人格要約を生成・更新
 */
async function regeneratePersonaDefinition(storeId, profileData, beliefLogs) {
  const prompt = `以下はある店主がInstagram投稿文に対して出したフィードバックから抽出した思想ログです。

${beliefLogs.map(b => `・${b.text}`).join('\n')}

この店主の「文章に対する人格」を箇条書きで簡潔に定義してください。
・で始まる箇条書き、5項目以内
・「この店主は〜」という主語は不要、特徴のみ書く
・矛盾するログがあれば新しいほう（下のほう）を優先
・抽象的すぎず、具体的な文体の好みが伝わるように`;

  const definition = await askClaude(prompt, {
    max_tokens: 300,
    temperature: 0.3,
  });

  if (!definition || definition.trim().length === 0) return;

  // バージョニング
  const history = profileData.persona_history || [];
  const newVersion = (profileData.persona_version || 0) + 1;
  history.push({
    version: newVersion,
    definition: definition.trim(),
    created_at: new Date().toISOString(),
    belief_count: beliefLogs.length,
  });
  while (history.length > MAX_PERSONA_HISTORY) {
    history.shift();
  }

  profileData.persona_definition = definition.trim();
  profileData.persona_version = newVersion;
  profileData.persona_history = history;
  profileData._last_persona_belief_count = beliefLogs.length;

  await supabase
    .from('learning_profiles')
    .update({ profile_data: profileData })
    .eq('store_id', storeId);

  console.log(`[AdvancedPersonalization] 人格要約 Ver.${newVersion} 生成完了`);
}

/**
 * エンゲージメントデータから投稿の成功要因を自動分析し belief_logs に追加
 * @param {string} storeId
 * @param {string} postContent - 投稿本文
 * @param {{ likes: number, saves: number, comments: number }} metrics
 * @param {number} avgSaveIntensity - この店舗の平均保存率
 * @returns {{ type: 'high'|'low', beliefs?: string[], saveIntensity: number }|null}
 */
export async function analyzeEngagementWithClaude(storeId, postContent, metrics, avgSaveIntensity) {
  const saveIntensity = metrics.likes > 0 ? metrics.saves / metrics.likes : 0;

  // 平均の1.5倍以上 or 保存率0.08以上 → 高パフォーマンス分析
  const isHighPerformer = saveIntensity >= Math.max(avgSaveIntensity * 1.5, 0.08);
  // 平均の0.5倍以下 → 低パフォーマンス記録（平均データがある場合のみ）
  const isLowPerformer = avgSaveIntensity > 0 && saveIntensity < avgSaveIntensity * 0.5;

  if (!isHighPerformer && !isLowPerformer) return null; // 平均的 → スキップ

  if (isHighPerformer) {
    const prompt = `以下の投稿が高い保存率（${(saveIntensity * 100).toFixed(1)}%、平均${(avgSaveIntensity * 100).toFixed(1)}%）を達成しました。

【投稿内容】
${postContent.slice(0, 500)}

【数値】いいね${metrics.likes} 保存${metrics.saves} コメント${metrics.comments}

この投稿が保存された理由を、文体・構成・表現の観点から箇条書きで1〜2項目だけ抽出してください。
・で始まる短い日本語文で。「この投稿は〜」という主語は不要。`;

    try {
      const result = await askClaude(prompt, { max_tokens: 100, temperature: 0.3 });
      const beliefs = result
        .split('\n')
        .map(l => l.replace(/^[・\-\*]\s*/, '').trim())
        .filter(l => l.length > 5 && l.length < 80);

      for (const belief of beliefs.slice(0, 2)) {
        await addSimpleBelief(storeId, belief, 'engagement_auto');
      }

      console.log(`[AutoLearn] 高パフォーマンス分析完了: saveIntensity=${saveIntensity.toFixed(2)}, beliefs=${beliefs.slice(0, 2).length}件`);
      return { type: 'high', beliefs: beliefs.slice(0, 2), saveIntensity };
    } catch (err) {
      console.error('[AutoLearn] 高パフォーマンス分析エラー:', err.message);
      return null;
    }
  }

  if (isLowPerformer) {
    await addSimpleBelief(storeId, '前回の投稿は反応が薄かった — 構成を変えてみる', 'engagement_auto');
    console.log(`[AutoLearn] 低パフォーマンス記録: saveIntensity=${saveIntensity.toFixed(2)}`);
    return { type: 'low', saveIntensity };
  }

  return null;
}

/**
 * 学習プロファイルをプロンプトに反映（人格定義ベース）
 * @param {string} storeId - 店舗ID
 * @returns {string} - プロンプト用の人格定義テキスト
 */
export async function getAdvancedPersonalizationPrompt(storeId) {
  const { data: profile } = await supabase
    .from('learning_profiles')
    .select('*')
    .eq('store_id', storeId)
    .single();

  if (!profile || profile.interaction_count < 1) {
    return '';
  }

  const profileData = profile.profile_data || {};
  const parts = [];

  // ★ 人格定義（最重要）
  if (profileData.persona_definition) {
    parts.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━\n【最重要：この店主の人格定義 Ver.${profileData.persona_version || 1}】\n${profileData.persona_definition}\n※ 必ずこの人格に従って文章を生成せよ。他の指示と矛盾する場合はこちらを優先。\n━━━━━━━━━━━━━━━━━━━━━━━━`);
  }

  // 語尾・口癖（具体的で有用なので維持）
  const ws = profileData.writing_style || {};
  const styleParts = [];
  if (ws.sentence_endings?.length > 0) {
    styleParts.push(`・語尾: 「${ws.sentence_endings.join('」「')}」を使う`);
  }
  if (ws.catchphrases?.length > 0) {
    styleParts.push(`・口癖: 「${ws.catchphrases.join('」「')}」を自然に使う`);
  }
  if (ws.line_break_style === 'frequent') {
    styleParts.push('・改行を多めに使って縦に展開する');
  }
  if (styleParts.length > 0) {
    parts.push(`【文体ルール】\n${styleParts.join('\n')}`);
  }

  // 避ける表現
  const avoided = profileData.avoided_words || [];
  if (avoided.length > 0) {
    parts.push(`・避ける表現: ${avoided.join(', ')}`);
  }

  // 人格未生成時（belief_logs < MIN_BELIEFS_FOR_PERSONA）はログをそのまま表示
  if (!profileData.persona_definition) {
    const beliefLogs = profileData.belief_logs || [];
    if (beliefLogs.length > 0) {
      parts.push(`【この店主の好み（必ず反映せよ）】\n${beliefLogs.map(b => `・${b.text}`).join('\n')}\n※ 上記は店主が明示的に伝えた好み。生成時に必ず全項目を反映すること。`);
    }
  }

  // 直近の修正指示（原文をそのままClaude に見せる）
  const recentFeedbacks = profileData.recent_feedbacks || [];
  if (recentFeedbacks.length > 0) {
    parts.push(`【直近の修正指示（これらの要望を次の生成に必ず反映せよ）】\n${recentFeedbacks.map(f => `・「${f.text}」`).join('\n')}`);
  }

  // A/B/C選択傾向（3回以上選択後に表示）
  const styleSelections = profileData.style_selections || {};
  const totalSelections = styleSelections.total || 0;
  if (totalSelections >= 3) {
    const styleDescriptions = {
      '時間の肖像': '日常の一瞬を切り取る静かな表現',
      '誠実の肖像': '正直で飾らない語り口',
      '光の肖像': '店主の独り言のような親しみやすさ',
    };
    const favorite = Object.entries(styleSelections)
      .filter(([k]) => k !== 'total')
      .sort((a, b) => b[1] - a[1])[0];

    if (favorite && favorite[1] >= 2) {
      parts.push(`【この店主が好む案の傾向】\n・${styleDescriptions[favorite[0]] || favorite[0]}を好む（${totalSelections}回中${favorite[1]}回選択）\n→ 3案すべてにこの傾向をベースとして反映しつつ、各案の個性は維持せよ`);
    }
  }

  return parts.length > 0 ? '\n' + parts.join('\n') : '';
}
