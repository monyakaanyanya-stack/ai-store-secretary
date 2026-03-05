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
export async function analyzeFeedbackWithClaude(feedback, originalPost, revisedPost = null, profileContext = null) {
  const diffSection = revisedPost
    ? `【元の投稿】\n${originalPost}\n\n【修正後の投稿】\n${revisedPost}\n\n【店主の修正指示】\n${feedback}`
    : `【元の投稿】\n${originalPost}\n\n【店主のフィードバック】\n${feedback}`;

  // profileContext がある場合、現在の指示集+蓄積ログを含めて persona_definition_next も生成させる
  let profileSection = '';
  let personaOutputInstruction = '';
  if (profileContext) {
    const logs = profileContext.beliefLogs || [];
    const ws = profileContext.writingStyle || {};
    const styleParts = [];
    if (ws.sentence_endings?.length > 0) styleParts.push(`語尾: ${ws.sentence_endings.join(', ')}`);
    if (ws.catchphrases?.length > 0) styleParts.push(`口癖: ${ws.catchphrases.join(', ')}`);

    profileSection = `

【現在のライティング指示集】
${profileContext.personaDefinition || 'まだありません'}

【蓄積済みの思想ログ（古い順）】
${logs.length > 0 ? logs.map(b => `・${b.text}`).join('\n') : 'なし'}
${styleParts.length > 0 ? `\n【蓄積済みの文体パターン】\n${styleParts.join('\n')}` : ''}`;

    personaOutputInstruction = `,
  "persona_definition_next": string`;
  }

  const prompt = `${diffSection}

上記の「元の投稿」と「修正後の投稿」の具体的な差分を分析して、この店主のライティングルールを抽出してください。
${revisedPost ? '修正指示は「なぜ直したか」の文脈として参照し、実際に何が変わったかを重視してください。' : 'フィードバックから、この店主が次回以降どう書いてほしいかを具体的に読み取ってください。'}${profileSection}

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
  "human_readable_learnings": [string]${personaOutputInstruction}
}

説明:
- beliefs: 元と修正後の差分から読み取れる具体的なライティングルールを1〜3件抽出。${revisedPost ? '「何を消したか」「何を足したか」「語尾がどう変わったか」「構成がどう変わったか」を具体的に。' : ''}例: "語尾を「〜です」から「〜だな」に変える", "最後の一文のCTAを削って余韻で終わる", "商品名を先頭に置く"。抽象的な表現（"カジュアルを好む"等）は禁止、必ず「〜する/〜しない」の行動指示にする
- writing_style.sentence_endings: 修正後の投稿で使われている語尾・文末表現をそのまま抽出（例: 「〜だな」「〜かも」）
- writing_style.catchphrases: 修正後に追加された口癖となりうる表現
- avoided_words: 元の投稿にあって修正後に消された表現・単語
- preferred_words: 修正後に新たに使われた表現・単語
- human_readable_learnings: ユーザーに見せる「今回学習したこと」を3件以内。具体的な変化を書く（例: ["語尾を「〜だな」に統一", "最後のCTAを削除"]）${profileContext ? `
- persona_definition_next: 今回の学習結果を反映した更新版ライティング指示集。「・」で始まる箇条書き7項目以内。「この店主は〜を好む」のような抽象的な性格描写は禁止。「〜する」「〜しない」「〜を使う」という具体的な行動指示にする。矛盾するログがあれば新しいほうを優先。語尾・口癖・避ける言葉がある場合は具体例を必ず含める` : ''}`;

  try {
    const response = await askClaude(prompt, {
      max_tokens: profileContext ? 1200 : 800,
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

  // ── 5. ライティング指示集の即時更新（persona_definition_next がある場合はDB保存前に適用）──
  let personaUpdated = false;
  if (analysis.persona_definition_next) {
    try {
      const history = profileData.persona_history || [];
      const newVersion = (profileData.persona_version || 0) + 1;
      history.push({
        version: newVersion,
        definition: analysis.persona_definition_next.trim(),
        created_at: new Date().toISOString(),
        belief_count: beliefLogs.length,
      });
      while (history.length > MAX_PERSONA_HISTORY) {
        history.shift();
      }
      profileData.persona_definition = analysis.persona_definition_next.trim();
      profileData.persona_version = newVersion;
      profileData.persona_history = history;
      profileData._last_persona_belief_count = beliefLogs.length;
      personaUpdated = true;
      console.log(`[AdvancedPersonalization] 人格要約 Ver.${newVersion} 生成完了（統合モード）`);
    } catch (personaErr) {
      console.error('[AdvancedPersonalization] ライティング指示集更新エラー（学習は成功）:', personaErr.message);
    }
  }

  // ── 6. プロファイル更新（DB 1回で全データ保存）──
  const newInteractionCount = profile.interaction_count + 1;
  await supabase
    .from('learning_profiles')
    .update({
      profile_data: profileData,
      interaction_count: newInteractionCount,
      last_feedback_at: new Date().toISOString(),
    })
    .eq('store_id', storeId);

  console.log(`[AdvancedPersonalization] 思想ログ更新: beliefs=${beliefLogs.length}件, interaction=${newInteractionCount}${personaUpdated ? ', persona=統合更新' : ''}`);

  // ── 7. フォールバック: profileContext未渡し時は従来通り別APIコールで指示集再生成 ──
  if (!analysis.persona_definition_next && beliefLogs.length >= 1) {
    // フォールバック: profileContext未渡し時は従来通り別APIコールで指示集再生成
    try {
      await regeneratePersonaDefinition(storeId, profileData, beliefLogs);
    } catch (personaErr) {
      console.error('[AdvancedPersonalization] ライティング指示集更新エラー（学習は成功）:', personaErr.message);
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
 * 抽象的な「人格」ではなく、具体的な「ライティング指示集」を生成する
 */
async function regeneratePersonaDefinition(storeId, profileData, beliefLogs) {
  // writing_style も材料に含める
  const ws = profileData.writing_style || {};
  const styleSection = [];
  if (ws.sentence_endings?.length > 0) {
    styleSection.push(`語尾: ${ws.sentence_endings.join(', ')}`);
  }
  if (ws.catchphrases?.length > 0) {
    styleSection.push(`口癖: ${ws.catchphrases.join(', ')}`);
  }
  const styleMaterial = styleSection.length > 0
    ? `\n\n【抽出済みの文体パターン】\n${styleSection.join('\n')}`
    : '';

  const prompt = `以下はある店主がInstagram投稿文に対して出したフィードバックから抽出した思想ログです。

【思想ログ（古い順）】
${beliefLogs.map(b => `・${b.text}`).join('\n')}${styleMaterial}

これらの情報を元に、この店主の「具体的なライティング指示集」を作ってください。

## ルール
・で始まる箇条書き、7項目以内
・「この店主は〜を好む」のような抽象的な性格描写は禁止
・代わりに「〜する」「〜しない」「〜を使う」という具体的な行動指示にする
・矛盾するログがあれば新しいほう（下のほう）を優先
・語尾・口癖・避ける言葉がある場合は具体例を必ず含める

## 良い例（具体的で実行可能）
・語尾は「〜だな」「〜かも」「〜だよね」を中心に使う。「です・ます」は避ける
・最後の一文はCTA（来てね・見てね）で閉じず、余韻や問いかけで終わる
・「素敵」「魅力的」「おすすめ」は使わない。商品の具体的な特徴（手触り・温度・音）で伝える
・1文は短く（15〜25字）。体言止めや倒置を混ぜてリズムを出す

## 悪い例（抽象的で使えない）
・カジュアルだが安っぽくはしない
・余韻を大切にする
・自然体な表現を好む`;

  const definition = await askClaude(prompt, {
    max_tokens: 500,
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

  // ★ ライティング指示集（最重要）
  if (profileData.persona_definition) {
    parts.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━\n【最重要：この店主専用ライティング指示 Ver.${profileData.persona_version || 1}】\n${profileData.persona_definition}\n※ 上記は店主のフィードバックから構築した具体的なルール。生成時に全項目を厳守せよ。\n━━━━━━━━━━━━━━━━━━━━━━━━`);
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

  // ライティング指示集がまだ生成されていない場合、belief_logsをそのまま表示
  if (!profileData.persona_definition) {
    const beliefLogs = profileData.belief_logs || [];
    if (beliefLogs.length > 0) {
      parts.push(`【この店主のライティングルール（必ず反映せよ）】\n${beliefLogs.map(b => `・${b.text}`).join('\n')}\n※ 上記は店主の修正から抽出した具体的なルール。生成時に全項目を厳守すること。`);
    }
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

/**
 * プロンプト注入用文字列 + analyzeFeedbackWithClaude用のプロファイルコンテキストを一括取得
 * DB読み取り1回で両方を返す（getAdvancedPersonalizationPrompt との重複クエリ防止）
 */
export async function getProfileAndPrompt(storeId) {
  const { data: profile } = await supabase
    .from('learning_profiles')
    .select('*')
    .eq('store_id', storeId)
    .single();

  const profileData = profile?.profile_data || {};
  const beliefLogs = profileData.belief_logs || [];
  const ws = profileData.writing_style || {};

  // analyzeFeedbackWithClaude に渡す profileContext
  const profileContext = {
    beliefLogs,
    personaDefinition: profileData.persona_definition || null,
    writingStyle: {
      sentence_endings: ws.sentence_endings || [],
      catchphrases: ws.catchphrases || [],
      line_break_style: ws.line_break_style || null,
    },
  };

  // プロンプト注入用文字列（getAdvancedPersonalizationPrompt と同じロジック）
  if (!profile || profile.interaction_count < 1) {
    return { profileContext, advancedPersonalization: '' };
  }

  const parts = [];

  if (profileData.persona_definition) {
    parts.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━\n【最重要：この店主専用ライティング指示 Ver.${profileData.persona_version || 1}】\n${profileData.persona_definition}\n※ 上記は店主のフィードバックから構築した具体的なルール。生成時に全項目を厳守せよ。\n━━━━━━━━━━━━━━━━━━━━━━━━`);
  }

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

  const avoided = profileData.avoided_words || [];
  if (avoided.length > 0) {
    parts.push(`・避ける表現: ${avoided.join(', ')}`);
  }

  if (!profileData.persona_definition && beliefLogs.length > 0) {
    parts.push(`【この店主のライティングルール（必ず反映せよ）】\n${beliefLogs.map(b => `・${b.text}`).join('\n')}\n※ 上記は店主の修正から抽出した具体的なルール。生成時に全項目を厳守すること。`);
  }

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

  const advancedPersonalization = parts.length > 0 ? '\n' + parts.join('\n') : '';
  return { profileContext, advancedPersonalization };
}
