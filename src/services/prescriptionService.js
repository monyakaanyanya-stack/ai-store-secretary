/**
 * 処方箋サービス（分析結果の中身）
 *
 * Standard プラン以上で利用可能（engagementPrescription フラグ）
 * reportHandler.js の applyEngagementMetrics() から呼び出す
 *
 * 3つの分析:
 *   1. 因果分析（前回比較） — ルールベース（Claude API 不使用）
 *   2. 業界比較（パーセンタイル） — engagement_metrics の同カテゴリーデータ
 *   3. 信条ブレンド — belief_logs から1つピックアップ
 */

import { supabase } from './supabaseService.js';
import { normalizeCategory } from '../config/categoryDictionary.js';

// ============================================================
// 1. 因果分析（前回比較）
// ============================================================

/**
 * 前回の報告と今回の指標を比較して因果仮説を生成
 * @param {string} storeId - 店舗ID
 * @param {number} currentSaveIntensity - 今回の保存強度
 * @param {number} currentReactionIndex - 今回の反応指数
 * @returns {Promise<string|null>} - 分析テキスト（投稿が1件のみの場合はnull）
 */
export async function getCausalAnalysis(storeId, currentSaveIntensity, currentReactionIndex) {
  // 直近5件の報告済みメトリクスを取得（今回分は最新の1件目）
  const { data, error } = await supabase
    .from('engagement_metrics')
    .select('save_intensity, reaction_index, post_length, created_at')
    .eq('store_id', storeId)
    .eq('status', '報告済')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error || !data || data.length < 2) {
    return null; // 比較対象がないのでスキップ
  }

  // 今回 = data[0], 前回 = data[1]
  const prev = data[1];
  const prevSI = prev.save_intensity || 0;

  if (prevSI === 0 && currentSaveIntensity === 0) {
    return null; // 両方ゼロなら比較の意味がない
  }

  let trend = '';
  let detail = '';

  if (prevSI > 0) {
    const changeRate = ((currentSaveIntensity - prevSI) / prevSI * 100).toFixed(0);

    if (currentSaveIntensity >= prevSI * 1.5) {
      trend = `前回 ${prevSI.toFixed(2)} → 今回 ${currentSaveIntensity.toFixed(2)}（+${changeRate}%）`;
      detail = '保存率が大きく上昇しています';
    } else if (currentSaveIntensity <= prevSI * 0.5) {
      trend = `前回 ${prevSI.toFixed(2)} → 今回 ${currentSaveIntensity.toFixed(2)}（${changeRate}%）`;
      detail = '保存率が低下しています。投稿の構成を変えてみるのも手です';
    } else if (currentSaveIntensity > prevSI) {
      trend = `前回 ${prevSI.toFixed(2)} → 今回 ${currentSaveIntensity.toFixed(2)}（+${changeRate}%）`;
      detail = '安定して上昇傾向です';
    } else if (currentSaveIntensity < prevSI) {
      trend = `前回 ${prevSI.toFixed(2)} → 今回 ${currentSaveIntensity.toFixed(2)}（${changeRate}%）`;
      detail = 'やや下降。前回と何が違ったか振り返ってみましょう';
    } else {
      trend = `前回 ${prevSI.toFixed(2)} → 今回 ${currentSaveIntensity.toFixed(2)}（変化なし）`;
      detail = '安定しています';
    }
  } else {
    trend = `前回 0 → 今回 ${currentSaveIntensity.toFixed(2)}`;
    detail = '保存がつき始めました';
  }

  return `📉 前回比較:\n${trend}\n${detail}`;
}

// ============================================================
// 2. 業界比較（パーセンタイル）
// ============================================================

/**
 * 同カテゴリーの全データと比較してパーセンタイルを算出
 * @param {string} category - 店舗カテゴリー
 * @param {number} currentSaveIntensity - 今回の保存強度
 * @returns {Promise<string|null>} - 業界比較テキスト（データ不足時はnull）
 */
export async function getIndustryBenchmark(category, currentSaveIntensity) {
  if (!category) return null;

  const normalizedCategory = normalizeCategory(category) || category;

  const { data, error } = await supabase
    .from('engagement_metrics')
    .select('save_intensity')
    .eq('category', normalizedCategory)
    .eq('status', '報告済')
    .not('save_intensity', 'is', null);

  if (error || !data || data.length < 3) {
    return null; // データ不足
  }

  const intensities = data.map(d => d.save_intensity).sort((a, b) => a - b);
  const avg = intensities.reduce((s, v) => s + v, 0) / intensities.length;

  // パーセンタイル計算（現在値より低いデータの割合）
  const belowCount = intensities.filter(v => v < currentSaveIntensity).length;
  const percentile = Math.round((belowCount / intensities.length) * 100);
  const topPercent = 100 - percentile;

  let positionLabel = '';
  if (topPercent <= 5) positionLabel = '上位5%';
  else if (topPercent <= 10) positionLabel = '上位10%';
  else if (topPercent <= 25) positionLabel = '上位25%';
  else if (topPercent <= 50) positionLabel = '上位50%';
  else positionLabel = `上位${topPercent}%`;

  return `📈 業界比較:\n同カテゴリー平均 ${avg.toFixed(2)} → あなた ${currentSaveIntensity.toFixed(2)}（${positionLabel}・${data.length}件中）`;
}

// ============================================================
// 3. 信条ブレンド
// ============================================================

/**
 * belief_logs から直近の信条を1つピックアップして表示
 * @param {string} storeId - 店舗ID
 * @returns {Promise<string|null>} - 信条テキスト（ログがない場合はnull）
 */
export async function getBeliefBlendedTip(storeId) {
  const { data, error } = await supabase
    .from('learning_profiles')
    .select('profile_data')
    .eq('store_id', storeId)
    .single();

  if (error || !data?.profile_data?.belief_logs) {
    return null;
  }

  const beliefs = data.profile_data.belief_logs;
  if (!Array.isArray(beliefs) || beliefs.length === 0) {
    return null;
  }

  // 直近の信条を1つ取得
  const latest = beliefs[beliefs.length - 1];
  const text = typeof latest === 'string' ? latest : latest?.text;
  if (!text) return null;

  return `💭 あなたの信条「${text}」が活きているかも`;
}

// ============================================================
// 統合: 処方箋テキスト生成
// ============================================================

/**
 * 3つの分析を統合して処方箋テキストを生成
 * @param {Object} store - 店舗オブジェクト
 * @param {number} saveIntensity - 保存強度
 * @param {number} reactionIndex - 反応指数
 * @returns {Promise<string>} - 分析結果テキスト（feedbackMessage に追加用）
 */
export async function generatePrescription(store, saveIntensity, reactionIndex) {
  // 保存率コメント
  let saveComment = '';
  if (saveIntensity >= 0.3) saveComment = '🔥 かなり高い！アルゴリズム評価◎';
  else if (saveIntensity >= 0.15) saveComment = '✨ 良好です';
  else if (saveIntensity >= 0.05) saveComment = '👍 標準的';
  else saveComment = '💡 保存を増やすと伸びやすくなります';

  let result = `\n\n【分析結果】\n📊 保存率: ${saveComment}（${saveIntensity.toFixed(2)}）`;

  // 因果分析
  const causal = await getCausalAnalysis(store.id, saveIntensity, reactionIndex);
  if (causal) {
    result += `\n\n${causal}`;
  }

  // 業界比較
  const benchmark = await getIndustryBenchmark(store.category, saveIntensity);
  if (benchmark) {
    result += `\n\n${benchmark}`;
  }

  // 信条ブレンド
  const belief = await getBeliefBlendedTip(store.id);
  if (belief) {
    result += `\n\n${belief}`;
  }

  return result;
}
