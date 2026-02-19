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
      '// 口調の参考（内容は写真・投稿に合わせて変える）\n新しいの届いた🙌\nずっと欲しかったやつ\nテンション上がりすぎてる',
      '今日めちゃくちゃよかった\nまた行きたい',
      'これ本当にやばい\nみんなにも試してほしい',
    ],
    bad_examples: [
      '今日は少しカジュアルなスタイルです', // ← です使ってる
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
      '// 口調の参考（内容は写真・投稿に合わせて変える）\n新しいのが入荷しました📦\n想像以上にいい感じで嬉しい\nみんなはもう見てくれた？',
      '久しぶりにこれ使ってみたよ✨\nやっぱり好きだなって思った',
      '今日はこれをご紹介します🎉\nぜひ一度試してみてね',
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
      '// 口調の参考（内容は写真・投稿に合わせて変える）\n新しい商品が入荷しました\n今週から販売開始です\nぜひお試しください',
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
      '// 口調の参考（内容は写真・投稿に合わせて変える）\n新しいの届いた🙌\nずっと欲しかったやつ\nテンション上がりすぎてる',
      '今日めちゃくちゃよかった\nまた行きたい',
      'これ本当にやばい\nみんなにも試してほしい',
    ],
    bad_examples: [
      '今日は少しカジュアルなスタイルです',
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
      '// 口調の参考（内容は写真・投稿に合わせて変える）\n新しいのが入荷しました📦\n想像以上にいい感じで嬉しい\nみんなはもう見てくれた？',
      '久しぶりにこれ使ってみたよ✨\nやっぱり好きだなって思った',
      '今日はこれをご紹介します🎉\nぜひ一度試してみてね',
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
      '// 口調の参考（内容は写真・投稿に合わせて変える）\n新しい商品が入荷しました\n今週から販売開始です\nぜひお試しください',
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
  esthetic_salon: [
    '#小顔矯正', '#肌質改善', '#自分磨き', '#ハーブピーリング',
    '#毛穴ケア', '#美白ケア', '#痩身エステ', '#ブライダルエステ',
    '#美意識向上', '#アンチエイジング', '#美容好きさんと繋がりたい'
  ],
  eyelash_salon: [
    '#まつげエクステ', '#まつエク', '#マツエク', '#まつ毛パーマ',
    '#ラッシュリフト', '#パリジェンヌラッシュリフト', '#アイラッシュ',
    '#マツパ', '#フラットラッシュ', '#ボリュームラッシュ'
  ],
  relaxation_salon: [
    '#リラクゼーション', '#マッサージ', '#癒し', '#疲労回復',
    '#もみほぐし', '#アロママッサージ', '#リフレッシュ',
    '#リラックス', '#整体', '#ボディケア'
  ],
  sweets_shop: [
    '#スイーツ部', '#映えスイーツ', '#ご褒美スイーツ', '#今日のおやつ',
    '#デパ地下スイーツ', '#期間限定スイーツ', '#手土産スイーツ',
    '#自分へのご褒美', '#断面萌え', '#ケーキ屋さん'
  ],
  yoga_fitness: [
    '#ヨガライフ', '#ヨガジョ', '#宅トレ', '#ボディメイク',
    '#ヘルシーライフ', '#朝ヨガ', '#夜ヨガ',
    '#マインドフルネス', '#瞑想', '#ダイエット記録'
  ],
  photographer: [
    '#ポートレート', '#写真好きな人と繋がりたい', '#ファインダー越しの私の世界',
    '#出張撮影', '#家族写真', '#ウェディングフォト',
    '#宣材写真', '#撮影依頼受付中', '#キリトリセカイ'
  ],
  vintage_clothing: [
    '#古着', '#古着コーデ', '#古着屋', '#ヴィンテージ', '#vintage',
    '#古着好きな人と繋がりたい', '#古着女子', '#古着男子', '#古着ファッション'
  ],
  accessory_shop: [
    '#アクセサリー', '#ハンドメイドアクセサリー', '#ピアス', '#イヤリング',
    '#ネックレス', '#リング', '#韓国アクセサリー', '#天然石アクセサリー'
  ],
  flower_shop: [
    '#花屋', '#花のある暮らし', '#フラワーアレンジメント',
    '#ブーケ', '#花束', '#生花', '#ドライフラワー',
    '#花好きな人と繋がりたい', '#季節の花'
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
    // 美容系
    'ネイルサロン': 'nail_salon', 'ネイル': 'nail_salon',
    '美容室': 'beauty_salon', 'ヘアサロン': 'beauty_salon',
    'エステサロン': 'esthetic_salon', 'エステ': 'esthetic_salon',
    'まつげエクステ': 'eyelash_salon', 'まつエク': 'eyelash_salon', 'アイラッシュサロン': 'eyelash_salon',
    'リラクゼーションサロン': 'relaxation_salon', 'マッサージサロン': 'relaxation_salon', 'マッサージ': 'relaxation_salon',
    // 飲食系
    'カフェ': 'cafe', 'レストラン': 'restaurant',
    'ベーカリー': 'bakery', 'パン屋': 'bakery',
    'スイーツ店': 'sweets_shop', 'ケーキ屋': 'sweets_shop',
    'バー': 'restaurant', '居酒屋': 'restaurant',
    // 小売系
    'アパレル': 'fashion', '雑貨店': 'fashion', 'セレクトショップ': 'fashion',
    '古着屋': 'vintage_clothing',
    'アクセサリーショップ': 'accessory_shop',
    '花屋': 'flower_shop',
    // サービス系
    'ヨガスタジオ': 'yoga_fitness', 'フィットネスジム': 'yoga_fitness', 'ダンススクール': 'yoga_fitness',
    'フォトグラファー': 'photographer', '写真スタジオ': 'photographer',
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
 * キャラクター設定をプロンプトに変換
 */
function buildCharacterSection(store) {
  const character = store.config?.character_settings;
  if (!character) return '';

  const parts = [];

  if (character.catchphrases && character.catchphrases.length > 0) {
    parts.push(`【口癖・よく使う表現（必ず使う）】\n${character.catchphrases.join('、')}`);
  }

  if (character.ng_words && character.ng_words.length > 0) {
    parts.push(`【絶対に使わないフレーズ（NG）】\n${character.ng_words.join('、')}`);
  }

  if (character.personality) {
    parts.push(`【キャラクター・個性】\n${character.personality}`);
  }

  if (parts.length === 0) return '';

  return `\n━━━━━━━━━━━━━━━━━━━━━━━━\n🎭 あなたの個性（最優先で反映）\n━━━━━━━━━━━━━━━━━━━━━━━━\n${parts.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
}

/**
 * 画像から投稿を生成するプロンプト（抜本改革版）
 */
export function buildImagePostPrompt(store, learningData, lengthOverride = null, blendedInsights = null, personalization = '', imageDescription = null) {
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

  // 集合知データの構築（同業種の成功パターンを反映）
  let collectiveIntelligenceSection = '';

  if (blendedInsights) {
    const { category, group, own } = blendedInsights;
    const insights = [];

    // ハッシュタグ（優先度1）
    const dbTags = [];
    if (category && category.sampleSize > 0) {
      dbTags.push(...category.topHashtags.slice(0, 3));
    }
    if (group && group.sampleSize > 0) {
      dbTags.push(...group.topHashtags.slice(0, 2));
    }

    if (dbTags.length > 0) {
      insights.push(`【ハッシュタグ（必須）】\n以下は同業種で高エンゲージメントのハッシュタグです。3-5個を必ず使用:\n${dbTags.join(', ')}`);
    }

    // 文字数（優先度2）
    const avgLength = category?.avgLength || group?.avgLength;
    const topPostsLength = category?.topPostsAvgLength || group?.topPostsAvgLength;
    if (avgLength && topPostsLength) {
      insights.push(`【文字数（必須）】\n同業種の高エンゲージメント投稿の平均文字数: ${topPostsLength}文字\n※ この文字数を目安に作成してください`);
    }

    // 絵文字（優先度3）
    const avgEmojiCount = category?.avgEmojiCount || group?.avgEmojiCount;
    if (avgEmojiCount !== undefined) {
      insights.push(`【絵文字（必須）】\n同業種の平均絵文字数: ${Math.round(avgEmojiCount)}個\n※ この数を目安に使用してください`);
    }

    // 投稿時間帯（参考情報）
    const bestHours = category?.bestPostingHours || group?.bestPostingHours;
    if (bestHours && bestHours.length > 0) {
      insights.push(`【参考】最適投稿時間帯: ${bestHours.join('時, ')}時`);
    }

    if (insights.length > 0) {
      collectiveIntelligenceSection = `\n━━━━━━━━━━━━━━━━━━━━━━━━\n📊 集合知データ（同業種${category?.sampleSize || 0}件の成功パターン）\n━━━━━━━━━━━━━━━━━━━━━━━━\n${insights.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }
  }

  // ハッシュタグ指示（画像分析結果があればそれを使う）
  let fallbackHashtags = '';
  if (!collectiveIntelligenceSection) {
    const categoryHint = store.category ? `業種「${store.category}」` : '';
    fallbackHashtags = imageDescription
      ? `\n【ハッシュタグ（厳守）】\n上記「この写真に写っているもの」の分析結果を読んで、実際に写っているもの + ${categoryHint}に直結するタグのみ（5-8個）。\n絶対NG：写真に写っていないものや場所のタグ、#海 #夕暮れ #空 #風景 #instagood #japan #photooftheday #フォロー などの汎用タグ`
      : `\n【ハッシュタグ（必須）】\n${categoryHint}この投稿内容に最も合うタグを5-8個。#instagood #japan など汎用タグは使わない。`;
  }

  // 画像分析結果セクション
  const imageDescriptionSection = imageDescription
    ? `\n【この写真に写っているもの（分析済み）】\n${imageDescription}\n`
    : '';

  const characterSection = buildCharacterSection(store);

  return `あなたは${store.name}の中の人です。今、Instagramに投稿を書いています。

【あなたの書き方】
${toneData.persona}

【ルール（厳守）】
${toneData.style_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

【絶対に使わない言葉（AI丸出しになるのでNG）】
${toneData.forbidden_words.join(', ')}

【口調スタイルの例（参考）】
${toneData.good_examples.filter(e => !e.startsWith('//')).join('\n\n')}

【悪い投稿の例（絶対避ける）】
${toneData.bad_examples.join('\n\n')}
${templateInfo}${characterSection}${imageDescriptionSection}${collectiveIntelligenceSection}${fallbackHashtags}${personalization}

【今回の投稿（厳守）】
上記「この写真に写っているもの」の内容だけをベースに投稿を書いてください。

絶対NG（ハルシネーション禁止）：
- 分析結果に書かれていない音・においなどを勝手に追加しない（「波の音」「潮の香り」など）
- 分析結果に書かれていない場所・状況を作り出さない（「海辺を歩いている」「散歩中」など）
- 「〜の季節」「〜な気分」など写真から直接読み取れない雰囲気を勝手に付け足さない
- 写真に写っているもの以外について言及しない

必ず守る：
- 文字数: ${lengthInfo.range}
- 分析結果に書かれていることのみを投稿に反映する
- 写っているものを具体的に言及する
${collectiveIntelligenceSection ? '- 集合知データの文字数・絵文字数は参考程度に反映する' : ''}

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

  // 集合知データの構築（同業種の成功パターンを反映）
  let collectiveIntelligenceSection = '';

  if (blendedInsights) {
    const { category, group, own } = blendedInsights;
    const insights = [];

    // ハッシュタグ（優先度1）
    const dbTags = [];
    if (category && category.sampleSize > 0) {
      dbTags.push(...category.topHashtags.slice(0, 3));
    }
    if (group && group.sampleSize > 0) {
      dbTags.push(...group.topHashtags.slice(0, 2));
    }

    if (dbTags.length > 0) {
      insights.push(`【ハッシュタグ（必須）】\n以下は同業種で高エンゲージメントのハッシュタグです。3-5個を必ず使用:\n${dbTags.join(', ')}`);
    }

    // 文字数（優先度2）
    const avgLength = category?.avgLength || group?.avgLength;
    const topPostsLength = category?.topPostsAvgLength || group?.topPostsAvgLength;
    if (avgLength && topPostsLength) {
      insights.push(`【文字数（必須）】\n同業種の高エンゲージメント投稿の平均文字数: ${topPostsLength}文字\n※ この文字数を目安に作成してください`);
    }

    // 絵文字（優先度3）
    const avgEmojiCount = category?.avgEmojiCount || group?.avgEmojiCount;
    if (avgEmojiCount !== undefined) {
      insights.push(`【絵文字（必須）】\n同業種の平均絵文字数: ${Math.round(avgEmojiCount)}個\n※ この数を目安に使用してください`);
    }

    // 投稿時間帯（参考情報）
    const bestHours = category?.bestPostingHours || group?.bestPostingHours;
    if (bestHours && bestHours.length > 0) {
      insights.push(`【参考】最適投稿時間帯: ${bestHours.join('時, ')}時`);
    }

    if (insights.length > 0) {
      collectiveIntelligenceSection = `\n━━━━━━━━━━━━━━━━━━━━━━━━\n📊 集合知データ（同業種${category?.sampleSize || 0}件の成功パターン）\n━━━━━━━━━━━━━━━━━━━━━━━━\n${insights.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }
  }

  // ハッシュタグは常にAIが投稿内容を見て自由生成
  let fallbackHashtags = '';
  if (!collectiveIntelligenceSection) {
    const categoryHint = store.category ? `業種は「${store.category}」。` : '';
    fallbackHashtags = `\n【ハッシュタグ（必須）】\n${categoryHint}この投稿内容を直接読んで、内容に最も合うInstagramハッシュタグを5-8個付ける。業種タグと投稿内容タグを両方含めること。#instagood #japan #photooftheday などの汎用タグは使わない。`;
  }

  const characterSection = buildCharacterSection(store);

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
${templateInfo}${characterSection}${collectiveIntelligenceSection}${fallbackHashtags}${personalization}

【今回の投稿内容】
${userText}

【今回の投稿】
- 上記の内容について、あなたのスタイルで自然に投稿を書いてください
- 文字数: ${lengthInfo.range}（目安、厳密でなくてOK）
${collectiveIntelligenceSection ? '  ※ 上記の集合知データ（文字数・絵文字数・ハッシュタグ）を必ず反映してください' : ''}
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
