import { getLearningDataByStore } from '../services/supabaseService.js';

/**
 * 店舗の学習データを集約して、プロンプトで使える形に整形する
 */
export async function aggregateLearningData(storeId) {
  // M6修正: DB呼び出しにtry-catchを追加（一部の呼び出し元にエラーハンドリングがない）
  let records;
  try {
    records = await getLearningDataByStore(storeId);
  } catch (err) {
    console.warn('[LearningData] 学習データ取得失敗（デフォルト値で続行）:', err.message);
    return { preferredWords: [], avoidWords: [], topEmojis: [] };
  }

  const result = {
    preferredWords: [],
    avoidWords: [],
    topEmojis: [],
  };

  if (!records || records.length === 0) return result;

  // フィードバックから傾向を抽出
  for (const record of records) {
    const data = record.data || {};

    // M5修正: Array.isArrayチェック（DBの値が壊れている場合のガード）
    if (Array.isArray(data.preferredWords)) {
      result.preferredWords.push(...data.preferredWords);
    }
    if (Array.isArray(data.avoidWords)) {
      result.avoidWords.push(...data.avoidWords);
    }
    if (Array.isArray(data.topEmojis)) {
      result.topEmojis.push(...data.topEmojis);
    }
  }

  // 重複を除去して最大10件に制限
  result.preferredWords = [...new Set(result.preferredWords)].slice(0, 10);
  result.avoidWords = [...new Set(result.avoidWords)].slice(0, 10);
  result.topEmojis = [...new Set(result.topEmojis)].slice(0, 5);

  return result;
}
