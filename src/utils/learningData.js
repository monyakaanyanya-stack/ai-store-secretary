import { getLearningDataByStore } from '../services/supabaseService.js';

/**
 * 店舗の学習データを集約して、プロンプトで使える形に整形する
 */
export async function aggregateLearningData(storeId) {
  const records = await getLearningDataByStore(storeId);

  const result = {
    preferredWords: [],
    avoidWords: [],
    topEmojis: [],
  };

  if (records.length === 0) return result;

  // フィードバックから傾向を抽出
  for (const record of records) {
    const data = record.data || {};

    if (data.preferredWords) {
      result.preferredWords.push(...data.preferredWords);
    }
    if (data.avoidWords) {
      result.avoidWords.push(...data.avoidWords);
    }
    if (data.topEmojis) {
      result.topEmojis.push(...data.topEmojis);
    }
  }

  // 重複を除去して最大10件に制限
  result.preferredWords = [...new Set(result.preferredWords)].slice(0, 10);
  result.avoidWords = [...new Set(result.avoidWords)].slice(0, 10);
  result.topEmojis = [...new Set(result.topEmojis)].slice(0, 5);

  return result;
}
