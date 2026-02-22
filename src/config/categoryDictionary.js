/**
 * カテゴリー辞書 (Single Source of Truth)
 *
 * すべてのカテゴリー情報をここに集約。
 * グループ分類・ハッシュタグ・バリデーションルール・同義語を一元管理。
 */

// ==================== グループ定義 ====================

export const CATEGORY_GROUPS = [
  {
    id: 'beauty',
    label: '美容系',
    description: 'ネイル、美容室、エステなど',
    order: 1,
    hashtags: [
      '#美容', '#ビューティー', '#beauty', '#美意識',
      '#自分磨き', '#美容好きさんと繋がりたい',
    ],
  },
  {
    id: 'food',
    label: '飲食系',
    description: 'カフェ、レストラン、ベーカリーなど',
    order: 2,
    hashtags: [
      '#グルメ', '#おいしい', '#食べスタグラム',
      '#foodstagram', '#instafood', '#飲食店',
    ],
  },
  {
    id: 'retail',
    label: '小売系',
    description: 'アパレル、雑貨、セレクトショップなど',
    order: 3,
    hashtags: [
      '#ショッピング', '#お買い物', '#新入荷',
      '#おしゃれさんと繋がりたい', '#セレクト',
    ],
  },
  {
    id: 'service',
    label: 'サービス系',
    description: 'ヨガ、フィットネス、写真スタジオなど',
    order: 4,
    hashtags: [
      '#サービス', '#体験', '#レッスン',
      '#習い事', '#スクール',
    ],
  },
  {
    id: 'professional',
    label: '専門職系',
    description: '士業、コンサル、不動産など',
    order: 5,
    hashtags: [
      '#専門家', '#プロフェッショナル', '#ビジネス',
      '#相談', '#サポート',
    ],
  },
  {
    id: 'creative',
    label: 'クリエイティブ系',
    description: 'ハンドメイド、アート、音楽など',
    order: 6,
    hashtags: [
      '#クリエイティブ', '#ものづくり', '#ハンドメイド',
      '#アート', '#作品', '#handmade',
    ],
  },
];

// ==================== カテゴリー定義 ====================

export const CATEGORIES = [
  // ─── 美容系 ───
  {
    id: 'nail_salon',
    label: 'ネイルサロン',
    groupId: 'beauty',
    synonyms: ['ネイル'],
    hashtags: [
      '#ネイル', '#ネイルデザイン', '#ジェルネイル', '#ネイルアート',
      '#ネイルサロン', '#nails', '#naildesign', '#gelnails', '#nailart',
      '#ネイル好きな人と繋がりたい', '#セルフネイル', '#春ネイル', '#秋ネイル',
      '#冬ネイル', '#夏ネイル', '#ワンカラーネイル', '#フレンチネイル',
    ],
    validation: { likes_count: { min: 0, max: 10000 }, engagement_rate: { min: 0, max: 50 } },
  },
  {
    id: 'beauty_salon',
    label: '美容室',
    groupId: 'beauty',
    synonyms: ['ヘアサロン'],
    hashtags: [
      '#美容室', '#ヘアスタイル', '#ヘアアレンジ', '#hair', '#hairstyle',
      '#ヘアカラー', '#haircolor', '#ショートヘア', '#ボブ', '#ロングヘア',
      '#美容師', '#hairstylist', '#ヘアケア', '#ヘアセット', '#トリートメント',
    ],
    validation: { likes_count: { min: 0, max: 10000 }, engagement_rate: { min: 0, max: 50 } },
  },
  {
    id: 'esthetic_salon',
    label: 'エステサロン',
    groupId: 'beauty',
    synonyms: ['エステ'],
    hashtags: [
      '#小顔矯正', '#肌質改善', '#自分磨き', '#ハーブピーリング',
      '#毛穴ケア', '#美白ケア', '#痩身エステ', '#ブライダルエステ',
      '#美意識向上', '#アンチエイジング', '#美容好きさんと繋がりたい',
    ],
    validation: { likes_count: { min: 0, max: 8000 }, engagement_rate: { min: 0, max: 40 } },
  },
  {
    id: 'eyelash_salon',
    label: 'まつげエクステ',
    groupId: 'beauty',
    synonyms: ['まつエク', 'アイラッシュサロン', 'マツエク'],
    hashtags: [
      '#まつげエクステ', '#まつエク', '#マツエク', '#まつ毛パーマ',
      '#ラッシュリフト', '#パリジェンヌラッシュリフト', '#アイラッシュ',
      '#マツパ', '#フラットラッシュ', '#ボリュームラッシュ',
    ],
    validation: null,
  },
  {
    id: 'relaxation_salon',
    label: 'リラクゼーションサロン',
    groupId: 'beauty',
    synonyms: ['マッサージサロン', 'マッサージ'],
    hashtags: [
      '#リラクゼーション', '#マッサージ', '#癒し', '#疲労回復',
      '#もみほぐし', '#アロママッサージ', '#リフレッシュ',
      '#リラックス', '#整体', '#ボディケア',
    ],
    validation: null,
  },

  // ─── 飲食系 ───
  {
    id: 'cafe',
    label: 'カフェ',
    groupId: 'food',
    synonyms: ['喫茶店', 'coffee shop', 'cafe'],
    hashtags: [
      '#カフェ', '#カフェ巡り', '#おしゃれカフェ', '#カフェスタグラム',
      '#cafe', '#cafestagram', '#カフェ好きな人と繋がりたい',
      '#コーヒー', '#スイーツ', '#ランチ', '#coffee', '#sweets',
      '#カフェタイム', '#カフェ好き', '#おうちカフェ',
    ],
    validation: { likes_count: { min: 0, max: 15000 }, engagement_rate: { min: 0, max: 60 } },
  },
  {
    id: 'restaurant',
    label: 'レストラン',
    groupId: 'food',
    synonyms: ['バー', '居酒屋'],
    hashtags: [
      '#レストラン', '#グルメ', '#ランチ', '#ディナー', '#foodstagram',
      '#instafood', '#food', '#料理', '#美味しい', '#foodie',
      '#食べスタグラム', '#グルメ好きな人と繋がりたい', '#お店', '#飲食店',
    ],
    validation: { likes_count: { min: 0, max: 15000 }, engagement_rate: { min: 0, max: 60 } },
  },
  {
    id: 'bakery',
    label: 'ベーカリー',
    groupId: 'food',
    synonyms: ['パン屋'],
    hashtags: [
      '#パン', '#ベーカリー', '#パン屋', '#bakery', '#bread', '#パン好き',
      '#パン屋さん', '#手作りパン', '#天然酵母', '#パン屋さん巡り',
      '#パンスタグラム', '#パン好きな人と繋がりたい',
    ],
    validation: { likes_count: { min: 0, max: 12000 }, engagement_rate: { min: 0, max: 50 } },
  },
  {
    id: 'sweets_shop',
    label: 'スイーツ店',
    groupId: 'food',
    synonyms: ['ケーキ屋'],
    hashtags: [
      '#スイーツ部', '#映えスイーツ', '#ご褒美スイーツ', '#今日のおやつ',
      '#デパ地下スイーツ', '#期間限定スイーツ', '#手土産スイーツ',
      '#自分へのご褒美', '#断面萌え', '#ケーキ屋さん',
    ],
    validation: null,
  },
  {
    id: 'ramen',
    label: 'ラーメン店',
    groupId: 'food',
    synonyms: ['ラーメン'],
    hashtags: [
      '#ラーメン', '#ramen', '#ラーメン好き', '#ラーメン部',
      '#麺スタグラム', '#ラーメン巡り', '#つけ麺', '#中華そば',
    ],
    validation: null,
  },
  {
    id: 'japanese_restaurant',
    label: '和食店',
    groupId: 'food',
    synonyms: ['和食', '日本料理店'],
    hashtags: [
      '#和食', '#日本料理', '#japanesefood', '#和食ごはん',
      '#割烹', '#懐石', '#旬の味', '#季節の料理',
    ],
    validation: null,
  },
  {
    id: 'italian',
    label: 'イタリアン',
    groupId: 'food',
    synonyms: ['イタリア料理', 'イタリア料理店'],
    hashtags: [
      '#イタリアン', '#パスタ', '#ピザ', '#Italian',
      '#イタリア料理', '#ワイン', '#トラットリア',
    ],
    validation: null,
  },
  {
    id: 'french',
    label: 'フレンチ',
    groupId: 'food',
    synonyms: ['フランス料理', 'フランス料理店', 'ビストロ'],
    hashtags: [
      '#フレンチ', '#フランス料理', '#ビストロ', '#French',
      '#コース料理', '#ワインペアリング', '#記念日ディナー',
    ],
    validation: null,
  },

  // ─── 小売系 ───
  {
    id: 'fashion',
    label: 'アパレル',
    groupId: 'retail',
    synonyms: ['セレクトショップ'],
    hashtags: [
      '#ファッション', '#コーデ', '#今日のコーデ', '#ootd', '#fashion',
      '#coordinate', '#おしゃれさんと繋がりたい', '#お洒落',
      '#春コーデ', '#秋コーデ', '#プチプラコーデ', '#カジュアルコーデ',
    ],
    validation: null,
  },
  {
    id: 'zakka',
    label: '雑貨店',
    groupId: 'retail',
    synonyms: ['雑貨屋'],
    hashtags: [
      '#雑貨', '#雑貨屋', '#雑貨好き', '#インテリア雑貨',
      '#暮らしの道具', '#生活雑貨', '#おしゃれ雑貨',
    ],
    validation: null,
  },
  {
    id: 'vintage_clothing',
    label: '古着屋',
    groupId: 'retail',
    synonyms: ['古着'],
    hashtags: [
      '#古着', '#古着コーデ', '#古着屋', '#ヴィンテージ', '#vintage',
      '#古着好きな人と繋がりたい', '#古着女子', '#古着男子', '#古着ファッション',
    ],
    validation: null,
  },
  {
    id: 'accessory_shop',
    label: 'アクセサリーショップ',
    groupId: 'retail',
    synonyms: ['アクセサリー'],
    hashtags: [
      '#アクセサリー', '#ハンドメイドアクセサリー', '#ピアス', '#イヤリング',
      '#ネックレス', '#リング', '#韓国アクセサリー', '#天然石アクセサリー',
    ],
    validation: null,
  },
  {
    id: 'furniture',
    label: '家具店',
    groupId: 'retail',
    synonyms: ['インテリアショップ', '家具屋'],
    hashtags: [
      '#家具', '#インテリア', '#家具屋', '#暮らし',
      '#模様替え', '#インテリアコーディネート', '#北欧インテリア',
    ],
    validation: null,
  },
  {
    id: 'bookstore',
    label: '書店',
    groupId: 'retail',
    synonyms: ['本屋'],
    hashtags: [
      '#本', '#読書', '#書店', '#本屋', '#bookstagram',
      '#読書好きな人と繋がりたい', '#おすすめの本',
    ],
    validation: null,
  },
  {
    id: 'flower_shop',
    label: '花屋',
    groupId: 'retail',
    synonyms: ['フラワーショップ'],
    hashtags: [
      '#花屋', '#花のある暮らし', '#フラワーアレンジメント',
      '#ブーケ', '#花束', '#生花', '#ドライフラワー',
      '#花好きな人と繋がりたい', '#季節の花',
    ],
    validation: null,
  },

  // ─── サービス系 ───
  {
    id: 'photographer',
    label: 'フォトグラファー',
    groupId: 'service',
    synonyms: ['写真スタジオ', 'カメラマン'],
    hashtags: [
      '#ポートレート', '#写真好きな人と繋がりたい', '#ファインダー越しの私の世界',
      '#出張撮影', '#家族写真', '#ウェディングフォト',
      '#宣材写真', '#撮影依頼受付中', '#キリトリセカイ',
    ],
    validation: { likes_count: { min: 0, max: 20000 }, saves_count: { min: 0, max: 5000 }, engagement_rate: { min: 0, max: 70 } },
  },
  {
    id: 'design_office',
    label: 'デザイン事務所',
    groupId: 'service',
    synonyms: ['デザイナー'],
    hashtags: [
      '#デザイン', '#グラフィックデザイン', '#design', '#ロゴデザイン',
      '#ブランディング', '#クリエイティブ', '#デザイナー',
    ],
    validation: { likes_count: { min: 0, max: 15000 }, engagement_rate: { min: 0, max: 60 } },
  },
  {
    id: 'coworking',
    label: 'コワーキングスペース',
    groupId: 'service',
    synonyms: ['シェアオフィス'],
    hashtags: [
      '#コワーキング', '#コワーキングスペース', '#リモートワーク',
      '#フリーランス', '#ノマド', '#シェアオフィス',
    ],
    validation: null,
  },
  {
    id: 'cram_school',
    label: '学習塾',
    groupId: 'service',
    synonyms: ['塾'],
    hashtags: [
      '#塾', '#学習塾', '#受験', '#勉強垢',
      '#教育', '#個別指導', '#成績アップ',
    ],
    validation: null,
  },
  {
    id: 'yoga_fitness',
    label: 'ヨガスタジオ',
    groupId: 'service',
    synonyms: ['フィットネスジム', 'ダンススクール', 'ヨガ', 'フィットネス'],
    hashtags: [
      '#ヨガライフ', '#ヨガジョ', '#宅トレ', '#ボディメイク',
      '#ヘルシーライフ', '#朝ヨガ', '#夜ヨガ',
      '#マインドフルネス', '#瞑想', '#ダイエット記録',
    ],
    validation: null,
  },

  // ─── 専門職系 ───
  {
    id: 'legal',
    label: '士業',
    groupId: 'professional',
    synonyms: ['税理士', '行政書士', '社労士', '弁護士'],
    hashtags: [
      '#士業', '#専門家', '#法律相談', '#税務',
      '#起業支援', '#経営サポート', '#ビジネス相談',
    ],
    validation: null,
  },
  {
    id: 'consultant',
    label: 'コンサルタント',
    groupId: 'professional',
    synonyms: ['コンサル'],
    hashtags: [
      '#コンサル', '#コンサルタント', '#経営', '#ビジネス',
      '#課題解決', '#戦略', '#マーケティング',
    ],
    validation: null,
  },
  {
    id: 'real_estate',
    label: '不動産',
    groupId: 'professional',
    synonyms: ['保険代理店'],
    hashtags: [
      '#不動産', '#物件', '#マイホーム', '#住まい',
      '#引っ越し', '#賃貸', '#不動産投資',
    ],
    validation: null,
  },

  // ─── クリエイティブ系 ───
  {
    id: 'handmade',
    label: 'ハンドメイド作家',
    groupId: 'creative',
    synonyms: ['工房', 'アトリエ', 'ハンドメイド'],
    hashtags: [
      '#ハンドメイド', '#handmade', '#手作り', '#ハンドメイド作家',
      '#minne', '#creema', '#ハンドメイド好きさんと繋がりたい',
    ],
    validation: null,
  },
  {
    id: 'artist',
    label: 'アーティスト',
    groupId: 'creative',
    synonyms: ['イラストレーター'],
    hashtags: [
      '#アート', '#art', '#イラスト', '#illustration',
      '#絵描きさんと繋がりたい', '#作品', '#現代アート',
    ],
    validation: null,
  },
  {
    id: 'music_school',
    label: '音楽教室',
    groupId: 'creative',
    synonyms: ['ピアノ教室'],
    hashtags: [
      '#音楽教室', '#ピアノ', '#音楽', '#レッスン',
      '#ピアノ教室', '#音楽のある暮らし', '#習い事',
    ],
    validation: null,
  },
];

// ==================== general フォールバックハッシュタグ ====================

export const GENERAL_HASHTAGS = [
  '#instagood', '#photooftheday', '#instagram', '#いいね',
  '#フォロー', '#follow', '#like', '#japan', '#japanese',
  '#日本', '#おすすめ', '#新作', '#お知らせ',
];

// ==================== 高速ルックアップ用インデックス ====================

const _labelIndex = new Map();
CATEGORIES.forEach(cat => {
  _labelIndex.set(cat.label, cat);
  cat.synonyms.forEach(syn => _labelIndex.set(syn, cat));
});

const _groupIndex = new Map();
CATEGORY_GROUPS.forEach(g => _groupIndex.set(g.id, g));

// ==================== 公開API ====================

/**
 * DB のラベル文字列からカテゴリーを引く
 * 完全一致 → synonym一致 → 部分一致 の3段マッチ
 */
export function findCategoryByLabel(label) {
  if (!label) return null;
  const trimmed = label.trim();
  // 完全一致（label / synonym）
  if (_labelIndex.has(trimmed)) return _labelIndex.get(trimmed);
  // 部分一致フォールバック（旧 getCategoryGroup の includes ロジックを維持）
  for (const cat of CATEGORIES) {
    if (trimmed.includes(cat.label) || cat.label.includes(trimmed)) return cat;
    for (const syn of cat.synonyms) {
      if (trimmed.includes(syn) || syn.includes(trimmed)) return cat;
    }
  }
  return null;
}

/** グループ id からグループを取得 */
export function findGroupById(groupId) {
  return _groupIndex.get(groupId) || null;
}

/** ラベルからグループ名を取得（旧 getCategoryGroup の代替） */
export function getCategoryGroup(label) {
  const cat = findCategoryByLabel(label);
  if (!cat) return null;
  const group = findGroupById(cat.groupId);
  return group ? group.label : null;
}

/** 3段フォールバック付きハッシュタグ取得 */
export function getHashtagsForCategory(label) {
  const cat = findCategoryByLabel(label);
  if (cat && cat.hashtags.length > 0) return cat.hashtags;
  if (cat) {
    const group = findGroupById(cat.groupId);
    if (group && group.hashtags.length > 0) return group.hashtags;
  }
  return GENERAL_HASHTAGS;
}

/** ラベルからバリデーションルールを取得 */
export function getValidationForCategory(label) {
  const cat = findCategoryByLabel(label);
  return cat?.validation || null;
}

/** ラベルを正規化（表記ゆれ吸収） */
export function normalizeCategory(label) {
  if (!label) return null;
  const trimmed = label.trim();
  const cat = findCategoryByLabel(trimmed);
  return cat ? cat.label : trimmed;
}

// ==================== onboarding 用関数（旧 categoryGroups.js と同シグネチャ） ====================

export function getCategoryGroupNames() {
  return CATEGORY_GROUPS.map(g => g.label);
}

export function getCategoryGroupByNumber(number) {
  const group = CATEGORY_GROUPS[number - 1];
  return group ? group.label : null;
}

export function getCategoriesByGroup(groupLabel) {
  const group = CATEGORY_GROUPS.find(g => g.label === groupLabel);
  if (!group) return [];
  return CATEGORIES.filter(c => c.groupId === group.id).map(c => c.label);
}

export function getCategoryByNumber(groupLabel, number) {
  const cats = getCategoriesByGroup(groupLabel);
  return cats[number - 1] || null;
}

export function getAllCategories() {
  return CATEGORIES.map(c => c.label);
}

export function generateGroupSelectionMessage() {
  const lines = CATEGORY_GROUPS.map(g =>
    `${g.order}. ${g.label}（${g.description}）`
  ).join('\n');
  return `【業種を選択してください】\n\n${lines}\n\n番号を送ってください（例: 2）`;
}

export function generateDetailCategoryMessage(groupLabel) {
  const cats = getCategoriesByGroup(groupLabel);
  const menu = cats.map((cat, i) => `${i + 1}. ${cat}`).join('\n');
  return `【${groupLabel}の詳細業種を選択してください】\n\n${menu}\n0. その他（リストにない業種）\n\n番号を送ってください（例: 1）`;
}
