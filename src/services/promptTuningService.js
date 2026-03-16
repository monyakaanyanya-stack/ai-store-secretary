import { supabase } from './supabaseService.js';
import { askClaude } from './claudeService.js';

// キャッシュ（1時間有効）
let _cachedRules = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1時間

/**
 * 全ユーザーのbelief_logsを集計し、共通パターンを抽出してDBに保存
 * 毎週日曜 22:00 JST に cron で実行
 */
export async function analyzeGlobalFeedbackPatterns() {
  try {
    console.log('[PromptTuning] グローバルフィードバック分析を開始...');

    // 1. 全店舗のlearning_profilesを取得
    const { data: profiles, error } = await supabase
      .from('learning_profiles')
      .select('store_id, profile_data')
      .gt('interaction_count', 0);

    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      console.log('[PromptTuning] 学習データなし。スキップ');
      return;
    }

    // 2. belief_logsが3件以上ある店舗のみ対象
    const qualifiedProfiles = profiles.filter(p => {
      const beliefs = p.profile_data?.belief_logs;
      return Array.isArray(beliefs) && beliefs.length >= 3;
    });

    if (qualifiedProfiles.length < 2) {
      console.log(`[PromptTuning] 対象店舗が${qualifiedProfiles.length}件のみ。最低2店舗必要。スキップ`);
      return;
    }

    // 3. 全beliefsを収集（店舗IDごとにグループ化）
    const allBeliefsByStore = {};
    let totalBeliefCount = 0;
    for (const profile of qualifiedProfiles) {
      const beliefs = profile.profile_data.belief_logs || [];
      allBeliefsByStore[profile.store_id] = beliefs.map(b => b.text);
      totalBeliefCount += beliefs.length;
    }

    // 4. Claude APIで共通パターンを分析
    const storeCount = Object.keys(allBeliefsByStore).length;
    const beliefsSummary = Object.entries(allBeliefsByStore)
      .map(([storeId, beliefs], i) => `店舗${i + 1}: ${beliefs.join(' / ')}`)
      .join('\n');

    const analysisPrompt = `以下は${storeCount}店舗のSNS投稿AIに対するフィードバックから抽出されたライティングルールです。

${beliefsSummary}

タスク:
1. 2店舗以上に共通するパターンを見つけてください
2. 共通パターンをプロンプトルールとして言語化してください
3. 最大5件まで。重要度順に並べてください

出力形式（JSONのみ、説明不要）:
{
  "rules": ["ルール1", "ルール2", ...],
  "summary": "分析の要約（1-2文）"
}

注意:
- 1店舗だけの特殊な好みは除外する
- 「短くして」「カジュアルに」等の共通傾向を優先
- ルールは具体的で実行可能な指示にする（例: 「本文は150字以下を目安に」）`;

    const result = await askClaude(analysisPrompt, {
      max_tokens: 500,
      temperature: 0,
      system: 'あなたはSNS投稿AIのプロンプトを最適化するアナリストです。JSONのみ出力してください。',
    });

    // 5. レスポンスをパース
    let analysis;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON not found');
      analysis = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[PromptTuning] レスポンスのパースに失敗:', parseErr.message);
      console.error('[PromptTuning] 生レスポンス:', result.slice(0, 200));
      return;
    }

    if (!Array.isArray(analysis.rules) || analysis.rules.length === 0) {
      console.log('[PromptTuning] 共通パターンなし');
      return;
    }

    // 最大5件に制限
    const rules = analysis.rules.slice(0, 5);

    // 6. DBに保存（INSERT — 履歴として残す）
    const { error: insertError } = await supabase
      .from('global_prompt_rules')
      .insert({
        rules,
        analysis_summary: analysis.summary || null,
        analyzed_store_count: storeCount,
        analyzed_belief_count: totalBeliefCount,
      });

    if (insertError) throw insertError;

    // キャッシュをクリア
    _cachedRules = null;
    _cacheTimestamp = 0;

    console.log(`[PromptTuning] 分析完了: ${storeCount}店舗, ${totalBeliefCount}件のbelief → ${rules.length}件のルール抽出`);
    console.log(`[PromptTuning] ルール: ${rules.join(' / ')}`);
    if (analysis.summary) {
      console.log(`[PromptTuning] 要約: ${analysis.summary}`);
    }
  } catch (err) {
    console.error('[PromptTuning] 分析エラー:', err.message);
  }
}

/**
 * 最新のグローバルプロンプトルールを取得（キャッシュ付き）
 * @returns {Promise<string>} プロンプト注入用文字列（ルールがなければ空文字列）
 */
export async function getGlobalPromptRules() {
  try {
    // キャッシュチェック
    const now = Date.now();
    if (_cachedRules !== null && (now - _cacheTimestamp) < CACHE_TTL_MS) {
      return _cachedRules;
    }

    const { data, error } = await supabase
      .from('global_prompt_rules')
      .select('rules')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data || !Array.isArray(data.rules) || data.rules.length === 0) {
      _cachedRules = '';
      _cacheTimestamp = now;
      return '';
    }

    const rulesText = data.rules.map(r => `・${r}`).join('\n');
    const formatted = `\n【全体の傾向（自動学習）】\n${rulesText}\n※ 上記は多くのユーザーの修正傾向から自動学習したルール。個別のあなたの好みが優先される。`;

    _cachedRules = formatted;
    _cacheTimestamp = now;
    return formatted;
  } catch (err) {
    console.error('[PromptTuning] ルール取得エラー:', err.message);
    return '';
  }
}
