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

/**
 * 番号から大カテゴリーグループを取得
 * @param {number} number - 1-6の番号
 * @returns {string|null} - 大カテゴリーグループ名
 */
export function getCategoryGroupByNumber(number) {
  const groups = ['美容系', '飲食系', '小売系', 'サービス系', '専門職系', 'クリエイティブ系'];
  return groups[number - 1] || null;
}

/**
 * 大カテゴリー名から詳細カテゴリーリストを取得
 * @param {string} groupName - 大カテゴリー名
 * @returns {string[]} - 詳細カテゴリーの配列
 */
export function getCategoriesByGroup(groupName) {
  return CATEGORY_GROUPS[groupName] || [];
}

/**
 * グループ内の番号から詳細カテゴリーを取得
 * @param {string} groupName - 大カテゴリー名
 * @param {number} number - グループ内の番号
 * @returns {string|null} - 詳細カテゴリー名
 */
export function getCategoryByNumber(groupName, number) {
  const categories = getCategoriesByGroup(groupName);
  return categories[number - 1] || null;
}

/**
 * 大カテゴリー選択メニューの生成
 * @returns {string} - LINEメッセージ用のテキスト
 */
export function generateGroupSelectionMessage() {
  return `【業種を選択してください】

1. 美容系（ネイル、美容室、エステなど）
2. 飲食系（カフェ、レストラン、ベーカリーなど）
3. 小売系（アパレル、雑貨、セレクトショップなど）
4. サービス系（ヨガ、フィットネス、写真スタジオなど）
5. 専門職系（士業、コンサル、不動産など）
6. クリエイティブ系（ハンドメイド、アート、音楽など）

番号を送ってください（例: 2）`;
}

/**
 * 詳細カテゴリー選択メニューの生成
 * @param {string} groupName - 大カテゴリー名
 * @returns {string} - LINEメッセージ用のテキスト
 */
export function generateDetailCategoryMessage(groupName) {
  const categories = getCategoriesByGroup(groupName);
  const menu = categories.map((cat, index) => `${index + 1}. ${cat}`).join('\n');

  return `【${groupName}の詳細業種を選択してください】

${menu}

番号を送ってください（例: 1）`;
}
