/**
 * カテゴリーグループマッピング
 * 詳細業種 → 大カテゴリー（グループ）への分類
 */

export const CATEGORY_GROUPS = {
  // 美容系
  '美容系': [
    'ネイルサロン',
    '美容室',
    'ヘアサロン',
    'エステサロン',
    'まつげエクステ',
    'アイラッシュサロン',
    'リラクゼーションサロン',
    'マッサージサロン',
  ],

  // 飲食系
  '飲食系': [
    'カフェ',
    'レストラン',
    'ベーカリー',
    'パン屋',
    'スイーツ店',
    'ケーキ屋',
    'バー',
    '居酒屋',
    'ラーメン店',
    '和食店',
    'イタリアン',
    'フレンチ',
  ],

  // 小売系
  '小売系': [
    'アパレル',
    '雑貨店',
    'セレクトショップ',
    '古着屋',
    'アクセサリーショップ',
    '家具店',
    'インテリアショップ',
    '書店',
    '花屋',
  ],

  // サービス系
  'サービス系': [
    '写真スタジオ',
    'フォトグラファー',
    'デザイン事務所',
    'コワーキングスペース',
    '学習塾',
    'ヨガスタジオ',
    'フィットネスジム',
    'ダンススクール',
  ],

  // 専門職系
  '専門職系': [
    '士業',
    'コンサルタント',
    '税理士',
    '行政書士',
    '社労士',
    '弁護士',
    '不動産',
    '保険代理店',
  ],

  // クリエイティブ系
  'クリエイティブ系': [
    'ハンドメイド作家',
    'アーティスト',
    'イラストレーター',
    '音楽教室',
    '工房',
    'アトリエ',
  ],
};

/**
 * 詳細カテゴリーから大カテゴリーグループを取得
 * @param {string} category - 詳細カテゴリー名
 * @returns {string|null} - 大カテゴリーグループ名
 */
export function getCategoryGroup(category) {
  if (!category) return null;

  for (const [group, categories] of Object.entries(CATEGORY_GROUPS)) {
    if (categories.some(cat => category.includes(cat) || cat.includes(category))) {
      return group;
    }
  }

  return null; // マッチしない場合は null
}

/**
 * すべての詳細カテゴリーをフラットな配列で取得
 * @returns {string[]} - すべての詳細カテゴリー
 */
export function getAllCategories() {
  return Object.values(CATEGORY_GROUPS).flat();
}

/**
 * カテゴリーグループ一覧を取得
 * @returns {string[]} - グループ名の配列
 */
export function getCategoryGroupNames() {
  return Object.keys(CATEGORY_GROUPS);
}
