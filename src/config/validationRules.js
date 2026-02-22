/**
 * カテゴリー別のバリデーションルール
 * カテゴリー固有ルールは categoryDictionary.js (SSOT) に統合済み
 */

import { getValidationForCategory } from './categoryDictionary.js';

// 全カテゴリー共通のデフォルト基準値
export const DEFAULT_VALIDATION_RULES = {
  likes_count: { min: 0, max: 50000 },
  saves_count: { min: 0, max: 10000 },
  comments_count: { min: 0, max: 5000 },
  reach: { min: 0, max: 1000000 },
  engagement_rate: { min: 0, max: 100 },
  post_length: { min: 10, max: 3000 },
  emoji_count: { min: 0, max: 50 },
  hashtags_count: { min: 0, max: 30 },
};

/**
 * カテゴリーに応じたバリデーションルールを取得
 * @param {string} category - カテゴリー名
 * @returns {Object} - バリデーションルール
 */
export function getValidationRules(category) {
  const categoryRules = getValidationForCategory(category) || {};
  return {
    ...DEFAULT_VALIDATION_RULES,
    ...categoryRules,
  };
}

/**
 * エンゲージメントデータの異常値を検出
 * @param {Object} metrics - エンゲージメントメトリクス
 * @param {string} category - カテゴリー名
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
export function validateEngagementMetrics(metrics, category = null) {
  const rules = getValidationRules(category);
  const errors = [];

  // いいね数の検証
  if (metrics.likes_count != null) {
    if (metrics.likes_count < rules.likes_count.min || metrics.likes_count > rules.likes_count.max) {
      errors.push(`いいね数が異常値です: ${metrics.likes_count} (範囲: ${rules.likes_count.min}-${rules.likes_count.max})`);
    }
  }

  // 保存数の検証
  if (metrics.saves_count != null) {
    if (metrics.saves_count < rules.saves_count.min || metrics.saves_count > rules.saves_count.max) {
      errors.push(`保存数が異常値です: ${metrics.saves_count} (範囲: ${rules.saves_count.min}-${rules.saves_count.max})`);
    }
  }

  // コメント数の検証
  if (metrics.comments_count != null) {
    if (metrics.comments_count < rules.comments_count.min || metrics.comments_count > rules.comments_count.max) {
      errors.push(`コメント数が異常値です: ${metrics.comments_count} (範囲: ${rules.comments_count.min}-${rules.comments_count.max})`);
    }
  }

  // リーチ数の検証
  if (metrics.reach != null) {
    if (metrics.reach < rules.reach.min || metrics.reach > rules.reach.max) {
      errors.push(`リーチ数が異常値です: ${metrics.reach} (範囲: ${rules.reach.min}-${rules.reach.max})`);
    }
  }

  // エンゲージメント率の検証
  if (metrics.engagement_rate != null) {
    if (metrics.engagement_rate < rules.engagement_rate.min || metrics.engagement_rate > rules.engagement_rate.max) {
      errors.push(`エンゲージメント率が異常値です: ${metrics.engagement_rate}% (範囲: ${rules.engagement_rate.min}-${rules.engagement_rate.max}%)`);
    }
  }

  // 投稿文字数の検証
  if (metrics.post_length != null) {
    if (metrics.post_length < rules.post_length.min || metrics.post_length > rules.post_length.max) {
      errors.push(`投稿文字数が異常値です: ${metrics.post_length} (範囲: ${rules.post_length.min}-${rules.post_length.max})`);
    }
  }

  // 絵文字数の検証
  if (metrics.emoji_count != null) {
    if (metrics.emoji_count < rules.emoji_count.min || metrics.emoji_count > rules.emoji_count.max) {
      errors.push(`絵文字数が異常値です: ${metrics.emoji_count} (範囲: ${rules.emoji_count.min}-${rules.emoji_count.max})`);
    }
  }

  // ハッシュタグ数の検証
  if (metrics.hashtags && Array.isArray(metrics.hashtags)) {
    const hashtagCount = metrics.hashtags.length;
    if (hashtagCount < rules.hashtags_count.min || hashtagCount > rules.hashtags_count.max) {
      errors.push(`ハッシュタグ数が異常値です: ${hashtagCount} (範囲: ${rules.hashtags_count.min}-${rules.hashtags_count.max})`);
    }
  }

  // エンゲージメント率の整合性チェック
  if (metrics.engagement_rate != null && metrics.likes_count != null && metrics.reach != null && metrics.reach > 0) {
    const calculatedRate = ((metrics.likes_count + (metrics.saves_count || 0) + (metrics.comments_count || 0)) / metrics.reach) * 100;
    const diff = Math.abs(calculatedRate - metrics.engagement_rate);

    // 10%以上の誤差がある場合は警告
    if (diff > 10) {
      errors.push(`エンゲージメント率の計算が不整合です: 入力値=${metrics.engagement_rate}%, 計算値=${calculatedRate.toFixed(2)}%`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 統計的外れ値検出（平均±3σ）
 * @param {number[]} values - データ配列
 * @param {number} newValue - 新しい値
 * @returns {boolean} - 外れ値かどうか
 */
export function isStatisticalOutlier(values, newValue) {
  if (!values || values.length < 3) {
    return false; // データが少ない場合は外れ値判定しない
  }

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const zScore = Math.abs((newValue - mean) / stdDev);
  return zScore > 3; // 3σを超えたら外れ値
}
