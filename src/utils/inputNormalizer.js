/**
 * 入力正規化ユーティリティ
 * 全角→半角変換、数値パースのガード等
 */

/**
 * 全角数字を半角に変換
 * @param {string} str - 入力文字列
 * @returns {string} - 半角数字に変換された文字列
 */
export function normalizeFullWidthNumbers(str) {
  if (!str) return str;
  return str.replace(/[０-９]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  );
}

/**
 * 全角コロン「：」を半角「:」に変換
 * @param {string} str - 入力文字列
 * @returns {string} - 半角コロンに変換された文字列
 */
export function normalizeFullWidthColon(str) {
  if (!str) return str;
  return str.replace(/：/g, ':');
}

/**
 * 入力テキストを正規化（全角コロン + 全角数字）
 * @param {string} str - 入力文字列
 * @returns {string} - 正規化された文字列
 */
export function normalizeInput(str) {
  if (!str) return str;
  return normalizeFullWidthColon(normalizeFullWidthNumbers(str));
}

/**
 * 安全な整数パース（NaN防止）
 * @param {string} str - パース対象
 * @param {number} defaultValue - NaN時のデフォルト値
 * @returns {number} - パース結果（NaN時はdefaultValue）
 */
export function safeParseInt(str, defaultValue = 0) {
  if (str == null) return defaultValue;
  const normalized = normalizeFullWidthNumbers(String(str).trim());
  const parsed = parseInt(normalized, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// L1修正: isValidMetricNumber削除（未使用 — collectiveIntelligenceではNumber.isFiniteで検証済み）
