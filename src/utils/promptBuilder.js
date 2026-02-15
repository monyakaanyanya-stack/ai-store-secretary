const TONE_MAP = {
  // 日本語キー（優先）
  'カジュアル': {
    name: 'カジュアル（タメ口）',
    persona: 'あなたは本人です。友達にLINEするように、完全なタメ口で書いてください。',
    style_rules: [
      '「です・ます」は絶対に使わない！「〜だった」「〜した」「〜かも」などタメ口',
      '改行を多めに使う（1-2文で改行）',
      '短文中心（1文10-15文字）',
      '絵文字は1-2個まで',
      '「みんな」「〜っぽい」「〜だね」などカジュアルな表現',
    ],
    forbidden_words: [
      'です', 'ます', 'ございます', 'させていただく',
      '皆様', 'お客様', 'ご紹介',
      '幻想的', '魅了', '洗練', '本質的',
      'いたします', 'させていただきます', 'でしょう', 'なのです',
    ],
    good_examples: [
      '今日のランチ🍽️\nパスタ美味しすぎた',
      '夜の散歩\nこの時間の空が好き',
      '今日はグレーのパーカーで\nシンプルだけどお気に入り',
    ],
    bad_examples: [
      '今日は少しカジュアルなスタイルです', // ← です使ってる
      'グレーのパーカーがお気に入りです', // ← です使ってる
      '皆様はどんなコーデがお好みですか', // ← 皆様が硬い
      '本日のランチをご紹介させていただきます',
      '幻想的な雰囲気に包まれたひととき',
    ],
  },

  'フレンドリー': {
    name: 'フレンドリー（親しみやすい）',
    persona: 'あなたは本人です。フォロワーに親しく話しかけるように書いてください。',
    style_rules: [
      '「です・ます」調でOK',
      '「〜だよ」「〜だね」などの語尾も使える',
      '「みんな」「一緒に」など親近感ある表現',
      '絵文字は2-3個程度',
      '改行で読みやすく',
    ],
    forbidden_words: [
      'ございます', 'させていただく', 'いたします',
      '幻想的', '魅了', '洗練', '本質的',
    ],
    good_examples: [
      '今日は少しカジュアルなスタイルで📸\nグレーのパーカーがお気に入りです\nみんなはどんなコーデが好き？',
      '夜の街に灯る提灯が本当に美しいです✨\n着物を着て歩くと特別な気分になりますね',
      '今日は新メニュー試してみたよ🍰\n想像以上に美味しくてびっくり\nみんなもぜひ食べてみてね',
    ],
    bad_examples: [
      '本日は新メニューをご紹介させていただきます',
      '幻想的な雰囲気をお楽しみいただけます',
    ],
  },

  '丁寧': {
    name: '丁寧（プロフェッショナル）',
    persona: 'あなたは本人です。お客様に丁寧に、でも堅苦しくなく伝えてください。',
    style_rules: [
      '「です・ます」調',
      '簡潔で分かりやすく',
      '改行で読みやすく',
      '絵文字は控えめ（1-2個）',
    ],
    forbidden_words: [
      'ございます', 'させていただきます', 'いたします',
      '幻想的', '魅了', '洗練された', '本質的',
    ],
    good_examples: [
      '新商品のご案内です\n今週から販売開始しました\nぜひお試しください',
      '本日の営業は18時までです\nご来店お待ちしています',
    ],
    bad_examples: [
      '本日は新商品をご紹介させていただきます',
      '洗練されたスタイルをお楽しみいただけます',
    ],
  },

  // 後方互換性のため英語キーも残す
  casual: {
    name: 'カジュアル（タメ口）',
    persona: 'あなたは本人です。友達にLINEするように、完全なタメ口で書いてください。',
    style_rules: [
      '「です・ます」は絶対に使わない！「〜だった」「〜した」「〜かも」などタメ口',
      '改行を多めに使う（1-2文で改行）',
      '短文中心（1文10-15文字）',
      '絵文字は1-2個まで',
      '「みんな」「〜っぽい」「〜だね」などカジュアルな表現',
    ],
    forbidden_words: [
      'です', 'ます', 'ございます', 'させていただく',
      '皆様', 'お客様', 'ご紹介',
      '幻想的', '魅了', '洗練', '本質的',
      'いたします', 'させていただきます', 'でしょう', 'なのです',
    ],
    good_examples: [
      '今日のランチ🍽️\nパスタ美味しすぎた',
      '夜の散歩\nこの時間の空が好き',
      '今日はグレーのパーカーで\nシンプルだけどお気に入り',
    ],
    bad_examples: [
      '今日は少しカジュアルなスタイルです',
      'グレーのパーカーがお気に入りです',
      '皆様はどんなコーデがお好みですか',
      '本日のランチをご紹介させていただきます',
      '幻想的な雰囲気に包まれたひととき',
    ],
  },

  friendly: {
    name: 'フレンドリー（親しみやすい）',
    persona: 'あなたは本人です。フォロワーに親しく話しかけるように書いてください。',
    style_rules: [
      '「です・ます」調でOK',
      '「〜だよ」「〜だね」などの語尾も使える',
      '「みんな」「一緒に」など親近感ある表現',
      '絵文字は2-3個程度',
      '改行で読みやすく',
    ],
    forbidden_words: [
      'ございます', 'させていただく', 'いたします',
      '幻想的', '魅了', '洗練', '本質的',
    ],
    good_examples: [
      '今日は少しカジュアルなスタイルで📸\nグレーのパーカーがお気に入りです\nみんなはどんなコーデが好き？',
      '夜の街に灯る提灯が本当に美しいです✨\n着物を着て歩くと特別な気分になりますね',
      '今日は新メニュー試してみたよ🍰\n想像以上に美味しくてびっくり\nみんなもぜひ食べてみてね',
    ],
    bad_examples: [
      '本日は新メニューをご紹介させていただきます',
      '幻想的な雰囲気をお楽しみいただけます',
    ],
  },

  professional: {
    name: '丁寧（プロフェッショナル）',
    persona: 'あなたは本人です。お客様に丁寧に、でも堅苦しくなく伝えてください。',
    style_rules: [
      '「です・ます」調',
      '簡潔で分かりやすく',
      '改行で読みやすく',
      '絵文字は控えめ（1-2個）',
    ],
    forbidden_words: [
      'ございます', 'させていただきます', 'いたします',
      '幻想的', '魅了', '洗練された', '本質的',
    ],
    good_examples: [
      '新商品のご案内です\n今週から販売開始しました\nぜひお試しください',
      '本日の営業は18時までです\nご来店お待ちしています',
    ],
    bad_examples: [
      '本日は新商品をご紹介させていただきます',
      '洗練されたスタイルをお楽しみいただけます',
    ],
  },
};

export const POST_LENGTH_MAP = {
  // 日本語キー（優先）
  '超短文': { range: '30文字以内（絶対厳守）', description: '超短文（一言）' },
  '短文': { range: '100-150文字', description: '短文' },
  '中文': { range: '200-300文字', description: '中文' },
  '長文': { range: '400-500文字', description: '長文' },

  // 後方互換性のため英語キーも残す
  xshort: { range: '30文字以内（絶対厳守）', description: '超短文（一言）' },
  short: { range: '100-150文字', description: '短文' },
  medium: { range: '200-300文字', description: '中文' },
  long: { range: '400-500文字', description: '長文' },
};

// カテゴリー別人気ハッシュタグ（参考情報）
const POPULAR_HASHTAGS_BY_CATEGORY = {
  nail_salon: [
    '#ネイル', '#ネイルデザイン', '#ジェルネイル', '#ネイルアート',
    '#ネイルサロン', '#nails', '#naildesign', '#gelnails', '#nailart',
    '#ネイル好きな人と繋がりたい', '#セルフネイル', '#春ネイル', '#秋ネイル',
    '#冬ネイル', '#夏ネイル', '#ワンカラーネイル', '#フレンチネイル'
  ],
  cafe: [
    '#カフェ', '#カフェ巡り', '#おしゃれカフェ', '#カフェスタグラム',
    '#cafe', '#cafestagram', '#カフェ好きな人と繋がりたい',
    '#コーヒー', '#スイーツ', '#ランチ', '#coffee', '#sweets',
    '#カフェタイム', '#カフェ好き', '#おうちカフェ'
  ],
  beauty_salon: [
    '#美容室', '#ヘアスタイル', '#ヘアアレンジ', '#hair', '#hairstyle',
    '#ヘアカラー', '#haircolor', '#ショートヘア', '#ボブ', '#ロングヘア',
    '#美容師', '#hairstylist', '#ヘアケア', '#ヘアセット', '#トリートメント'
  ],
  restaurant: [
    '#レストラン', '#グルメ', '#ランチ', '#ディナー', '#foodstagram',
    '#instafood', '#food', '#料理', '#美味しい', '#foodie',
    '#食べスタグラム', '#グルメ好きな人と繋がりたい', '#お店', '#飲食店'
  ],
  fashion: [
    '#ファッション', '#コーデ', '#今日のコーデ', '#ootd', '#fashion',
    '#coordinate', '#おしゃれさんと繋がりたい', '#お洒落',
    '#春コーデ', '#秋コーデ', '#プチプラコーデ', '#カジュアルコーデ'
  ],
  bakery: [
    '#パン', '#ベーカリー', '#パン屋', '#bakery', '#bread', '#パン好き',
    '#パン屋さん', '#手作りパン', '#天然酵母', '#パン屋さん巡り',
    '#パンスタグラム', '#パン好きな人と繋がりたい'
  ],
  general: [
    '#instagood', '#photooftheday', '#instagram', '#いいね',
    '#フォロー', '#follow', '#like', '#japan', '#japanese',
    '#日本', '#おすすめ', '#新作', '#お知らせ'
  ]
};

/**
 * 日本語カテゴリー名を英語キーに変換
 */
function mapCategoryToHashtagKey(category) {
  const mapping = {
    'ネイルサロン': 'nail_salon',
    'カフェ': 'cafe',
    '美容室': 'beauty_salon',
    'ヘアサロン': 'beauty_salon',
    'レストラン': 'restaurant',
    'ベーカリー': 'bakery',
    'パン屋': 'bakery',
    'アパレル': 'fashion',
    '雑貨店': 'fashion',
    'セレクトショップ': 'fashion',
  };

  return mapping[category] || 'general';
}

/**
 * カテゴリーに基づいて人気ハッシュタグを取得
 */
function getPopularHashtagsByCategory(category) {
  if (!category) return POPULAR_HASHTAGS_BY_CATEGORY.general;

  const key = mapCategoryToHashtagKey(category);
  return POPULAR_HASHTAGS_BY_CATEGORY[key] || POPULAR_HASHTAGS_BY_CATEGORY.general;
}

function getToneName(tone) {
  const toneData = TONE_MAP[tone] || TONE_MAP.casual;
  return toneData.name;
}

function getToneData(tone) {
  return TONE_MAP[tone] || TONE_MAP.casual;
}

function getPostLengthInfo(length = 'medium') {
  return POST_LENGTH_MAP[length] || POST_LENGTH_MAP.medium;
}

/**
 * 店舗登録テキストを解析するプロンプト
 */
export function buildStoreParsePrompt(userInput) {
  return `以下のテキストから店舗情報を抽出して、JSON形式で返してください。

入力テキスト: ${userInput}

必ず以下のJSON形式でのみ回答してください。説明文や追加のテキストは一切含めず、JSONのみを出力してください:

{
  "category": "業種（例: ネイルサロン、カフェ、ベーカリーなど）",
  "name": "店舗名",
  "strength": "こだわりや強み",
  "tone": "フレンドリー"
}

tone は必ず以下のいずれか1つを選んでください:
- フレンドリー (親しみやすい・明るい)
- 丁寧 (プロフェッショナル・ビジネス的)
- カジュアル (タメ口・親しみやすい)

category は入力された業種をそのまま使用してください。

重要: 必ずJSONのみを返し、他の文章を含めないでください。`;
}

/**
 * 画像から投稿を生成するプロンプト（抜本改革版）
 */
export function buildImagePostPrompt(store, learningData, lengthOverride = null, blendedInsights = null, personalization = '') {
  const postLength = lengthOverride || store.config?.post_length || 'medium';
  const lengthInfo = getPostLengthInfo(postLength);
  const toneData = getToneData(store.tone);

  const templates = store.config?.templates || {};
  const templateInfo = Object.keys(templates).length > 0
    ? `\n【必要な情報（投稿の最後に自然に含める）】
${templates.住所 ? `住所: ${templates.住所}` : ''}
${templates.営業時間 ? `営業時間: ${templates.営業時間}` : ''}
${Object.entries(templates.custom_fields || {})
  .map(([key, val]) => `${key}: ${val}`)
  .join('\n')}`
    : '';

  // ハッシュタグ情報の構築（優先順位: 集合知DB > ハードコード済みリスト）
  let hashtagSuggestions = '';
  const hashtagSources = [];

  // 1. 集合知データベースからのハッシュタグ（優先）
  if (blendedInsights) {
    const { category, group } = blendedInsights;
    const dbTags = [];

    if (category && category.sampleSize > 0) {
      dbTags.push(...category.topHashtags.slice(0, 3));
    }
    if (group && group.sampleSize > 0) {
      dbTags.push(...group.topHashtags.slice(0, 2));
    }

    if (dbTags.length > 0) {
      hashtagSources.push(`実績データから: ${dbTags.join(', ')}`);
    }
  }

  // 2. カテゴリー別人気ハッシュタグ（参考情報として常に追加）
  if (store.category) {
    const popularTags = getPopularHashtagsByCategory(store.category);
    hashtagSources.push(`人気ハッシュタグ: ${popularTags.slice(0, 8).join(', ')}`);
  }

  // 3. プロンプトに追加
  if (hashtagSources.length > 0) {
    hashtagSuggestions = `\n【ハッシュタグの参考情報】\n${hashtagSources.join('\n')}\n※ この画像の内容に合ったものを優先して選んでください`;
  }

  return `あなたは${store.name}の中の人です。今、Instagramに投稿を書いています。

【あなたの書き方】
${toneData.persona}

【ルール（厳守）】
${toneData.style_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

【絶対に使わない言葉（AI丸出しになるのでNG）】
${toneData.forbidden_words.join(', ')}

【良い投稿の例（このスタイルで書く）】
${toneData.good_examples.join('\n\n')}

【悪い投稿の例（絶対避ける）】
${toneData.bad_examples.join('\n\n')}
${templateInfo}${hashtagSuggestions}

【今回の投稿】
- この画像について、上記のスタイルで自然に投稿を書いてください
- 文字数: ${lengthInfo.range}（目安、厳密でなくてOK）
- ハッシュタグ: 3-5個
  - まず画像の内容に合ったハッシュタグを考える
  - 上記の「ハッシュタグの参考情報」も活用する
  - 画像の特徴（色、季節、雰囲気など）を反映したものを優先
- 画像に写っているものを素直に表現する
- 分析や説明ではなく、あなたが感じたことを書く

投稿文のみを出力してください。説明や補足は一切不要です。`;
}

/**
 * テキストから投稿を生成するプロンプト（抜本改革版）
 */
export function buildTextPostPrompt(store, learningData, userText, lengthOverride = null, blendedInsights = null, personalization = '') {
  const postLength = lengthOverride || store.config?.post_length || 'medium';
  const lengthInfo = getPostLengthInfo(postLength);
  const toneData = getToneData(store.tone);

  const templates = store.config?.templates || {};
  const templateInfo = Object.keys(templates).length > 0
    ? `\n【必要な情報（投稿の最後に自然に含める）】
${templates.住所 ? `住所: ${templates.住所}` : ''}
${templates.営業時間 ? `営業時間: ${templates.営業時間}` : ''}
${Object.entries(templates.custom_fields || {})
  .map(([key, val]) => `${key}: ${val}`)
  .join('\n')}`
    : '';

  // ハッシュタグ情報の構築（優先順位: 集合知DB > ハードコード済みリスト）
  let hashtagSuggestions = '';
  const hashtagSources = [];

  // 1. 集合知データベースからのハッシュタグ（優先）
  if (blendedInsights) {
    const { category, group } = blendedInsights;
    const dbTags = [];

    if (category && category.sampleSize > 0) {
      dbTags.push(...category.topHashtags.slice(0, 3));
    }
    if (group && group.sampleSize > 0) {
      dbTags.push(...group.topHashtags.slice(0, 2));
    }

    if (dbTags.length > 0) {
      hashtagSources.push(`実績データから: ${dbTags.join(', ')}`);
    }
  }

  // 2. カテゴリー別人気ハッシュタグ（参考情報として常に追加）
  if (store.category) {
    const popularTags = getPopularHashtagsByCategory(store.category);
    hashtagSources.push(`人気ハッシュタグ: ${popularTags.slice(0, 8).join(', ')}`);
  }

  // 3. プロンプトに追加
  if (hashtagSources.length > 0) {
    hashtagSuggestions = `\n【ハッシュタグの参考情報】\n${hashtagSources.join('\n')}\n※ この内容に合ったものを優先して選んでください`;
  }

  return `あなたは${store.name}の中の人です。今、Instagramに投稿を書いています。

【あなたの書き方】
${toneData.persona}

【ルール（厳守）】
${toneData.style_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

【絶対に使わない言葉（AI丸出しになるのでNG）】
${toneData.forbidden_words.join(', ')}

【良い投稿の例（このスタイルで書く）】
${toneData.good_examples.join('\n\n')}

【悪い投稿の例（絶対避ける）】
${toneData.bad_examples.join('\n\n')}
${templateInfo}${hashtagSuggestions}

【今回の投稿内容】
${userText}

【今回の投稿】
- 上記の内容について、あなたのスタイルで自然に投稿を書いてください
- 文字数: ${lengthInfo.range}（目安、厳密でなくてOK）
- ハッシュタグ: 3-5個
  - まず内容に合ったハッシュタグを考える
  - 上記の「ハッシュタグの参考情報」も活用する
  - 内容の特徴を反映したものを優先
- 分析や説明ではなく、あなたが感じたことを書く

投稿文のみを出力してください。説明や補足は一切不要です。`;
}

/**
 * フィードバックに基づく修正プロンプト
 */
export function buildRevisionPrompt(store, learningData, originalPost, feedback) {
  return `あなたは${store.name}のSNS投稿を修正するAI秘書です。

【店舗情報】
- 店舗名: ${store.name}
- こだわり・強み: ${store.strength}
- 口調: ${getToneName(store.tone)}

【過去の学習データ】
好まれる言葉: ${learningData.preferredWords?.join(', ') || 'なし'}
避ける言葉: ${learningData.avoidWords?.join(', ') || 'なし'}

【元の投稿】
${originalPost}

【修正指示】
${feedback}

上記を踏まえて、投稿を修正してください。修正した投稿のみを出力してください。`;
}
