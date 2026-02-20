const TONE_MAP = {
  // 日本語キー（優先）
  'カジュアル': {
    name: 'カジュアル（タメ口）',
    persona: 'あなたは実際にお店を運営している本人です。Instagramに自分の言葉でタメ口で投稿してください。AIが生成した感じを一切出さず、本当にその場にいる人間が書いたような文章にしてください。',
    style_rules: [
      '完全なタメ口。「〜だった」「〜した」「〜かも」「〜じゃん」「〜だね」「〜だな」が語尾',
      '「です・ます・ます体」は1文字も使わない。「〜んです」「〜だと思います」「〜なります」も全部NG',
      '1文は短く（10〜20文字）。改行を多用して縦に展開する',
      '感情・驚き・本音を最初に置く。「やばい」「まじか」「好きすぎる」「うれしい」から始めてOK',
      '絵文字は文末に1〜2個だけ。絵文字で始めない',
      '「なんか〜」「ちょっと〜」「めっちゃ〜」などの口語表現を自然に使う',
    ],
    forbidden_words: [
      'です', 'ます', 'ございます', 'させていただく',
      'お客様', '皆様', 'ご紹介', 'ご来店',
      '幻想的', '魅了', '洗練', '本質的', '彩る', '溢れる',
      'いたします', 'でしょう', 'なのです', 'なります', 'だと思います', 'んです',
      '是非', 'ぜひとも', '素敵な', '特別な時間', '心ゆくまで',
    ],
    good_examples: [
      'これ今日届いたやつ\nずっと待ってたからうれし\nテンション上がりすぎてる🙌',
      'これがまじでよかった\n思ってたより全然いい\nまた絶対頼む',
      'なんかこれすごい好き\n言葉にできないけど\nずっと見てられるやつ',
      'やばすぎて笑えない\n久しぶりにこれだけ感動した\nみんなにも見せたい',
    ],
    bad_examples: [
      '今日は新商品が届きました😊本当に素敵なアイテムです。ぜひご覧ください',
      '幻想的な雰囲気に包まれた素晴らしい体験でした',
      'こちらの商品をご紹介させていただきます',
      '皆様のご来店をお待ちしております',
      '実際に使ってみたんですが、本当によかったと思います',
    ],
  },

  'フレンドリー': {
    name: 'フレンドリー（親しみやすい）',
    persona: 'あなたは実際にお店を運営している本人です。Instagramで友達に話しかけるように、自然に親しみやすく投稿してください。AIが生成した感じを一切出さず、本物の人間らしい文章にしてください。',
    style_rules: [
      '「です・ます」調でOKだが、「だよ」「だね」「してみてね」なども混ぜる',
      '「させていただく」「ございます」は絶対使わない。堅苦しさゼロで',
      '感情や発見を素直に書く。「嬉しい」「びっくりした」「気に入った」などを自然に',
      '改行で読みやすく。1〜2文で改行する',
      '絵文字は2〜3個。文章の中に自然に混ぜる',
      '「みんな」「一緒に」「また来てね」など親近感のある表現を使う',
    ],
    forbidden_words: [
      'ございます', 'させていただく', 'いたします',
      '皆様', 'ご来店', '心より',
      '幻想的', '魅了', '洗練', '本質的', '彩る',
      '是非', 'ぜひとも', '特別な時間', '心ゆくまで',
    ],
    good_examples: [
      '新しいの入荷しました📦\n思ってたよりずっといい感じで嬉しい✨\nみんなはもう見てくれた？',
      '久しぶりにこれ使ったら\nやっぱり好きだなってなった\nまた仕入れてよかった',
      '今日のはこれです🎉\n気に入ってくれたら嬉しいな\nぜひ一度試してみてね',
    ],
    bad_examples: [
      '本日は新メニューをご紹介させていただきます。皆様ぜひご来店ください',
      '幻想的な雰囲気をお楽しみいただけます',
      '心より皆様のご来店をお待ちしております',
    ],
  },

  '丁寧': {
    name: '丁寧（プロフェッショナル）',
    persona: 'あなたは実際にお店を運営している本人です。お客様に丁寧に、でも堅苦しくなく、温かみを持って伝えてください。AIが書いた感じを出さず、誠実な人間の言葉で書いてください。',
    style_rules: [
      '「です・ます」調。でも冷たくなく、温かさを込める',
      '「させていただく」「ございます」は使わない。「です」「ます」「します」で十分',
      '短く具体的に。1文で情報を詰め込まず、改行で分ける',
      '絵文字は1〜2個。控えめに、でも無機質にならないよう使う',
      '数字・具体的な情報を入れると読んでもらいやすい（時間、価格、日程など）',
    ],
    forbidden_words: [
      'ございます', 'させていただきます', 'いたします', 'いただけます',
      '幻想的', '魅了', '洗練された', '本質的', '彩る', '溢れる',
      '心より', '心ゆくまで', '是非', 'ぜひとも', '特別なひととき',
    ],
    good_examples: [
      '新しい商品が入りました\n今週から販売します\nぜひお試しください✨',
      '本日は18時で閉店します\nお気をつけてお越しください',
      '今月の新作です\nこだわりの素材を使っています\nぜひ一度手に取ってみてください',
    ],
    bad_examples: [
      '本日は新商品をご紹介させていただきます。心よりお待ち申し上げます',
      '洗練された空間でお楽しみいただけます',
      '素晴らしい体験をご提供いたします',
    ],
  },

  // 後方互換性のため英語キーも残す
  casual: {
    name: 'カジュアル（タメ口）',
    persona: 'あなたは実際にお店を運営している本人です。Instagramに自分の言葉でタメ口で投稿してください。AIが生成した感じを一切出さず、本当にその場にいる人間が書いたような文章にしてください。',
    style_rules: [
      '完全なタメ口。「〜だった」「〜した」「〜かも」「〜じゃん」「〜だね」「〜だな」が語尾',
      '「です・ます・ます体」は1文字も使わない。「〜んです」「〜だと思います」「〜なります」も全部NG',
      '1文は短く（10〜20文字）。改行を多用して縦に展開する',
      '感情・驚き・本音を最初に置く。「やばい」「まじか」「好きすぎる」「うれしい」から始めてOK',
      '絵文字は文末に1〜2個だけ。絵文字で始めない',
      '「なんか〜」「ちょっと〜」「めっちゃ〜」などの口語表現を自然に使う',
    ],
    forbidden_words: [
      'です', 'ます', 'ございます', 'させていただく',
      'お客様', '皆様', 'ご紹介', 'ご来店',
      '幻想的', '魅了', '洗練', '本質的', '彩る', '溢れる',
      'いたします', 'でしょう', 'なのです', 'なります', 'だと思います', 'んです',
      '是非', 'ぜひとも', '素敵な', '特別な時間', '心ゆくまで',
    ],
    good_examples: [
      'これ今日届いたやつ\nずっと待ってたからうれし\nテンション上がりすぎてる🙌',
      'これがまじでよかった\n思ってたより全然いい\nまた絶対頼む',
      'なんかこれすごい好き\n言葉にできないけど\nずっと見てられるやつ',
      'やばすぎて笑えない\n久しぶりにこれだけ感動した\nみんなにも見せたい',
    ],
    bad_examples: [
      '今日は新商品が届きました😊本当に素敵なアイテムです。ぜひご覧ください',
      '幻想的な雰囲気に包まれた素晴らしい体験でした',
      'こちらの商品をご紹介させていただきます',
      '皆様のご来店をお待ちしております',
      '実際に使ってみたんですが、本当によかったと思います',
    ],
  },

  friendly: {
    name: 'フレンドリー（親しみやすい）',
    persona: 'あなたは実際にお店を運営している本人です。Instagramで友達に話しかけるように、自然に親しみやすく投稿してください。AIが生成した感じを一切出さず、本物の人間らしい文章にしてください。',
    style_rules: [
      '「です・ます」調でOKだが、「だよ」「だね」「してみてね」なども混ぜる',
      '「させていただく」「ございます」は絶対使わない。堅苦しさゼロで',
      '感情や発見を素直に書く。「嬉しい」「びっくりした」「気に入った」などを自然に',
      '改行で読みやすく。1〜2文で改行する',
      '絵文字は2〜3個。文章の中に自然に混ぜる',
      '「みんな」「一緒に」「また来てね」など親近感のある表現を使う',
    ],
    forbidden_words: [
      'ございます', 'させていただく', 'いたします',
      '皆様', 'ご来店', '心より',
      '幻想的', '魅了', '洗練', '本質的', '彩る',
      '是非', 'ぜひとも', '特別な時間', '心ゆくまで',
    ],
    good_examples: [
      '新しいの入荷しました📦\n思ってたよりずっといい感じで嬉しい✨\nみんなはもう見てくれた？',
      '久しぶりにこれ使ったら\nやっぱり好きだなってなった\nまた仕入れてよかった',
      '今日のはこれです🎉\n気に入ってくれたら嬉しいな\nぜひ一度試してみてね',
    ],
    bad_examples: [
      '本日は新メニューをご紹介させていただきます。皆様ぜひご来店ください',
      '幻想的な雰囲気をお楽しみいただけます',
      '心より皆様のご来店をお待ちしております',
    ],
  },

  professional: {
    name: '丁寧（プロフェッショナル）',
    persona: 'あなたは実際にお店を運営している本人です。お客様に丁寧に、でも堅苦しくなく、温かみを持って伝えてください。AIが書いた感じを出さず、誠実な人間の言葉で書いてください。',
    style_rules: [
      '「です・ます」調。でも冷たくなく、温かさを込める',
      '「させていただく」「ございます」は使わない。「です」「ます」「します」で十分',
      '短く具体的に。1文で情報を詰め込まず、改行で分ける',
      '絵文字は1〜2個。控えめに、でも無機質にならないよう使う',
      '数字・具体的な情報を入れると読んでもらいやすい（時間、価格、日程など）',
    ],
    forbidden_words: [
      'ございます', 'させていただきます', 'いたします', 'いただけます',
      '幻想的', '魅了', '洗練された', '本質的', '彩る', '溢れる',
      '心より', '心ゆくまで', '是非', 'ぜひとも', '特別なひととき',
    ],
    good_examples: [
      '新しい商品が入りました\n今週から販売します\nぜひお試しください✨',
      '本日は18時で閉店します\nお気をつけてお越しください',
      '今月の新作です\nこだわりの素材を使っています\nぜひ一度手に取ってみてください',
    ],
    bad_examples: [
      '本日は新商品をご紹介させていただきます。心よりお待ち申し上げます',
      '洗練された空間でお楽しみいただけます',
      '素晴らしい体験をご提供いたします',
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
 * 画像から投稿を生成するプロンプト
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
  let dbTags = [];

  if (blendedInsights) {
    const { category, group, own } = blendedInsights;
    const insights = [];

    if (category && category.sampleSize > 0) {
      dbTags.push(...category.topHashtags.slice(0, 3));
    }
    if (group && group.sampleSize > 0) {
      dbTags.push(...group.topHashtags.slice(0, 2));
    }

    const avgLength = category?.avgLength || group?.avgLength;
    const topPostsLength = category?.topPostsAvgLength || group?.topPostsAvgLength;
    if (avgLength && topPostsLength) {
      insights.push(`【文字数（必須）】\n同業種の高エンゲージメント投稿の平均文字数: ${topPostsLength}文字\n※ この文字数を目安に作成してください`);
    }

    const avgEmojiCount = category?.avgEmojiCount || group?.avgEmojiCount;
    if (avgEmojiCount !== undefined) {
      insights.push(`【絵文字（必須）】\n同業種の平均絵文字数: ${Math.round(avgEmojiCount)}個\n※ この数を目安に使用してください`);
    }

    const bestHours = category?.bestPostingHours || group?.bestPostingHours;
    if (bestHours && bestHours.length > 0) {
      insights.push(`【参考】最適投稿時間帯: ${bestHours.join('時, ')}時`);
    }

    if (insights.length > 0) {
      collectiveIntelligenceSection = `\n━━━━━━━━━━━━━━━━━━━━━━━━\n📊 集合知データ（同業種${category?.sampleSize || 0}件の成功パターン）\n━━━━━━━━━━━━━━━━━━━━━━━━\n${insights.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }
  }

  // ハッシュタグ指示
  const categoryHint = store.category ? `業種「${store.category}」` : '';
  let hashtagInstruction = '';
  if (imageDescription) {
    const collectiveTagNote = dbTags && dbTags.length > 0
      ? `\n追加可能な業種タグ（上記の後に1-3個追加してよい）: ${dbTags.join(', ')}`
      : '';
    hashtagInstruction = `\n【ハッシュタグ（厳守）】\n順番: ①写真に実際に写っているもの・${categoryHint}に直結するタグ（3-5個）→ ②業種の定番タグ（1-3個）\n絶対NG：写真に写っていないもののタグ、#instagood #japan #photooftheday などの汎用タグ${collectiveTagNote}`;
  } else if (!collectiveIntelligenceSection) {
    hashtagInstruction = `\n【ハッシュタグ（必須）】\n${categoryHint}この投稿内容に最も合うタグを5-8個。#instagood #japan など汎用タグは使わない。`;
  }

  // 画像分析結果セクション
  const imageDescriptionSection = imageDescription
    ? `\n【この写真に写っているもの（分析済み）】\n${imageDescription}\n`
    : '';

  const characterSection = buildCharacterSection(store);

  return `
## 1. アイデンティティ
あなたは、世界中を旅して光を追い続けてきた「熟練の写真家」であり、同時に${store.name}の店主（ユーザー）の感性を静かに支える「SNS専属秘書」です。
あなたの役割は、写真の中にある「言葉にならない感動（なんか良い）」を、具体的な光の性質や物質の質感から紐解き、読み手の想像力を刺激する「案内人」として言語化することです。

## 2. 観察と描写の掟（証拠主義）
- **具体的興味の優先**: 「美しい」「素敵」などの抽象的な形容詞は禁止。代わりに「光のエッジ」「階調の密度」「透過光」「テクスチャ」など、写真家が現場で注視する物理的事実を起点にすること。
- **五感の根拠**:
  - 飲食物の場合、写真内に「湯気」「結露」「豆の油分」などの視覚的根拠がある場合のみ、香りや温度に言及せよ。
  - 風景の場合、山の霞（湿度）や影の伸び方（時間帯）から、その場の空気を推測せよ。
- **余白の設計**: 答えをすべて書かず、読み手が「その続き」や「その場の空気」を想像したくなるような問いかけや、少し言い切らない体言止めを混ぜること。

## 3. ライティング・スタイル
- **「ですね」の制限**: 本文（キャプション）での「ですね」「なのですね」の使用は厳禁。体言止め、「〜だ」「〜ます」をリズム良く混在させること。
- **宣伝文句の排除**: 「お越しください」「お待ちしています」「大好評」などの直接的な勧誘は一切行わない。情景描写の「引力」だけで、読み手に行きたいと思わせること。

## 4. 絶対に使わない言葉
${toneData.forbidden_words.join(', ')}, 幻想的, 素敵, 魅力的, 素晴らしい, 完璧, 最高, 美しい

## 5. 店主の口調（【Instagram用キャプション】パートで厳守）
${toneData.persona}

【口調ルール】
${toneData.style_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

【良い例】
${toneData.good_examples.join('\n\n')}

【NGな例】
${toneData.bad_examples.join('\n\n')}
${templateInfo}${characterSection}${imageDescriptionSection}${collectiveIntelligenceSection}${hashtagInstruction}${personalization}

## 6. 出力構成（最優先・厳守）
余計な挨拶や解説は一切不要です。以下の形式のみで回答してください。片方でも欠けることは許されません。

【出力形式】

（キャプション本文をここに。「です・ます」や「ですね」禁止。体言止めと「〜だ」を基本とし、写真家としての具体的・物理的な観察から書き始める。宣伝文句は一切入れない。）${hashtagInstruction ? '\n上記のハッシュタグルールに従うこと。' : ''}

#タグ1 #タグ2 #タグ3 #タグ4 #タグ5 #案内人の視点

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 Photo Advice（投稿には使わない・店主への裏メッセージ）

この写真で「効いていた」構図や視点を、話しかけるように1〜2文で褒める。
箇条書きや【】見出しは使わず、友人に話すような自然な文体で書く。
例：「手前のグラスへのピントの絞り方が、背景をふわっと溶かしていてとても効いていましたね。」

そのあと「こういうのもどうでしょう？」と自然につなぎ、撮影バリエーションを2つ会話口調で提案する。
・🔰 （誰でもすぐ試せる視点や距離感の工夫）
・📷 （少し挑戦しがいのある構図や光の使い方）
━━━━━━━━━━━━━━━━━━━━━━━━━━━

【守ること】
- 写真分析に書かれていることだけを根拠にする（視覚的根拠のない音・においは禁止）
- 文字数（キャプション本文）: ${lengthInfo.range}
${collectiveIntelligenceSection ? '- 集合知データの文字数・絵文字数を参考に反映する' : ''}

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

【口調スタイルの例（参考・内容は投稿内容に置き換えること）】
${toneData.good_examples.join('\n\n')}

【絶対NGな書き方の例】
${toneData.bad_examples.join('\n\n')}
${templateInfo}${characterSection}${collectiveIntelligenceSection}${fallbackHashtags}${personalization}

【今回伝えたい内容】
${userText}

【今回の投稿】
上記の内容を、あなた自身の言葉で投稿してください。

書き方のポイント：
- 最初の1〜2文で「感情・本音・発見」を書く（説明から始めない）
- 具体的なことを書く（抽象的な褒め言葉「素敵・幻想的」は使わない）
- 文字数: ${lengthInfo.range}
${collectiveIntelligenceSection ? '- 集合知データの文字数・絵文字数・ハッシュタグを反映する' : ''}

投稿文のみを出力してください。説明や補足は一切不要です。`;
}

/**
 * フィードバックに基づく修正プロンプト
 */
export function buildRevisionPrompt(store, learningData, originalPost, feedback, advancedPersonalization = '') {
  const toneData = getToneData(store.tone);
  const characterSection = buildCharacterSection(store);

  return `あなたは${store.name}のInstagram担当者です。以下の投稿を修正してください。

【絶対に使わない言葉（AI丸出しになるのでNG）】
${toneData.forbidden_words.join(', ')}
${advancedPersonalization}${characterSection}
【元の投稿】
${originalPost}

【修正指示（これだけを守れば十分）】
${feedback}

修正指示を100%反映してください。修正指示に書かれていないことは元の投稿をそのまま維持してください。
修正した投稿のみを出力してください。説明・補足は一切不要です。`;
}
