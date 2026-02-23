import { askClaudeWithImage } from './claudeService.js';

/**
 * Instagram インサイト画面のスクリーンショットから指標を自動抽出
 *
 * 対応表記:
 *   1,234 / 1234 / 1.2K / 1.2万 / 12万
 *
 * @param {string} imageBase64 - Base64 エンコード済み画像
 * @returns {Promise<{isInsights: boolean, likes: number|null, saves: number|null, comments: number|null, reach: number|null}>}
 */
export async function extractInsightsFromScreenshot(imageBase64) {
  const prompt = `この画像を分析してください。

【判定基準】
Instagram のインサイト / 投稿分析 / 統計画面のスクリーンショットかどうかを判定します。
「いいね！」「保存」「コメント」「リーチ」などの指標と数値が並んでいれば該当します。
商品写真・料理写真・風景写真などは該当しません。

【出力形式】
必ず以下の JSON のみを返してください（前後に説明文は不要）:
{
  "is_insights": true または false,
  "likes": 数値またはnull,
  "saves": 数値またはnull,
  "comments": 数値またはnull,
  "reach": 数値またはnull
}

【数値の変換ルール】
- 「1,234」→ 1234
- 「1.2K」→ 1200
- 「1.2万」→ 12000
- 「12万」→ 120000
- 数値が画像に見当たらない項目は null`;

  let response;
  try {
    response = await askClaudeWithImage(prompt, imageBase64);
  } catch (err) {
    console.error('[InsightsOCR] Vision API エラー:', err.message);
    return { isInsights: false, likes: null, saves: null, comments: null, reach: null };
  }

  try {
    const jsonMatch = response.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return { isInsights: false, likes: null, saves: null, comments: null, reach: null };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // 数値変換（文字列・null・undefined を安全に処理）
    const toInt = (v) => {
      if (v === null || v === undefined) return null;
      const n = Number(String(v).replace(/,/g, ''));
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
    };

    return {
      isInsights: Boolean(parsed.is_insights),
      likes:    toInt(parsed.likes),
      saves:    toInt(parsed.saves),
      comments: toInt(parsed.comments),
      reach:    toInt(parsed.reach),
    };
  } catch {
    return { isInsights: false, likes: null, saves: null, comments: null, reach: null };
  }
}
