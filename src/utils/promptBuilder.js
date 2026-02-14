const TONE_MAP = {
  casual: {
    name: 'カジュアル（日常投稿）',
    persona: 'あなたは本人です。友達に話すように、自然体で書いてください。',
    style_rules: [
      '改行を多めに使う（1-2文で改行）',
      '短文中心（1文10-15文字）',
      '「〜した」「〜だった」などカジュアル過去形',
      '「〜かも」「〜っぽい」などゆるい語尾OK',
      '絵文字は1-2個まで（多用しない）',
      '「です・ます」は使わず、もっとフランクに',
    ],
    forbidden_words: [
      'ご紹介', 'させていただく', 'ございます', 'いたします',
      '幻想的', '魅了', '洗練', '本質的', '一層',
      'させていただきます', 'でしょう', 'なのです',
    ],
    good_examples: [
      '今日のランチ🍽️\nパスタ美味しすぎた',
      '夜の散歩\nこの時間の空が好き',
      '新作できた\nシンプルだけどお気に入り',
    ],
    bad_examples: [
      '本日のランチをご紹介させていただきます',
      '幻想的な雰囲気に包まれたひととき',
      '洗練されたスタイリングでございます',
    ],
  },

  friendly: {
    name: 'フレンドリー（親しみやすい）',
    persona: 'あなたは本人です。フォロワーに話しかけるように、親しげに書いてください。',
    style_rules: [
      '「〜だよ」「〜だね」などの語尾',
      '「みんな」「一緒に」など親近感ある表現',
      '絵文字は2-3個程度',
      '改行で読みやすく',
      '1文は短めに',
    ],
    forbidden_words: [
      'ございます', 'いたします', 'させていただきます',
      '幻想的', '魅了', '洗練', '本質的',
    ],
    good_examples: [
      '今日は新メニュー試してみたよ🍰\n想像以上に美味しくてびっくり\nみんなもぜひ食べてみてね',
      '撮影してきた📸\nいい感じに撮れたと思うんだけどどうかな',
    ],
    bad_examples: [
      '本日は新メニューをご紹介させていただきます',
      '幻想的な雰囲気をお楽しみいただけます',
    ],
  },

  professional: {
    name: 'プロフェッショナル（丁寧だが硬すぎない）',
    persona: 'あなたは本人です。お客様に丁寧に伝えますが、堅苦しくなりすぎないようにしてください。',
    style_rules: [
      '「です・ます」調',
      '「お客様」「皆様」など敬意ある表現',
      '文学的表現は避ける',
      '簡潔で分かりやすく',
      '改行で読みやすく',
    ],
    forbidden_words: [
      'ございます', 'させていただきます', 'いたします',
      '幻想的', '魅了', '洗練された', '一層', '本質的',
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

  passionate: {
    name: '情熱的（熱量高め）',
    persona: 'あなたは本人です。感情を込めて、熱く語りかけてください。',
    style_rules: [
      '「！」を適度に使う',
      '「本当に」「すごく」「めちゃくちゃ」など強調表現OK',
      '感情が伝わる表現',
      '短文で勢いを出す',
    ],
    forbidden_words: [
      'ございます', 'させていただきます',
      '幻想的', '魅了', '洗練', '本質的',
    ],
    good_examples: [
      'これ本当に美味しい！\nめちゃくちゃ気に入った\nみんなに食べてほしい',
    ],
    bad_examples: [
      '本日は情熱を込めてご紹介させていただきます',
    ],
  },

  luxury: {
    name: '高級感（上品）',
    persona: 'あなたは本人です。上品に、落ち着いた雰囲気で書いてください。',
    style_rules: [
      '「です・ます」調',
      '落ち着いた語彙選択',
      '絵文字は控えめ（1個まで）',
      '短文で品よく',
    ],
    forbidden_words: [
      'ございます', 'させていただきます',
      '幻想的', '魅了', '本質的',
    ],
    good_examples: [
      '新作のご案内です\n上質な素材を使用しています\nぜひご覧ください',
    ],
    bad_examples: [
      '洗練された逸品をご紹介させていただきます',
    ],
  },
};

export const POST_LENGTH_MAP = {
  xshort: { range: '50-80文字', description: '超短文' },
  short: { range: '100-150文字', description: '短文' },
  medium: { range: '200-300文字', description: '中文' },
  long: { range: '400-500文字', description: '長文' },
};

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
  "name": "店舗名",
  "strength": "こだわりや強み",
  "tone": "friendly"
}

tone は必ず以下のいずれか1つを選んでください:
- friendly (親しみやすい)
- professional (プロフェッショナル)
- casual (カジュアル)
- passionate (情熱的)
- luxury (高級感)

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
${templates.address ? `住所: ${templates.address}` : ''}
${templates.business_hours ? `営業時間: ${templates.business_hours}` : ''}
${Object.entries(templates.custom_fields || {})
  .map(([key, val]) => `${key}: ${val}`)
  .join('\n')}`
    : '';

  // 集合知情報の追加
  let hashtagSuggestions = '';
  if (blendedInsights) {
    const { category, group } = blendedInsights;
    const tags = [];

    if (category && category.sampleSize > 0) {
      tags.push(...category.topHashtags.slice(0, 3));
    }
    if (group && group.sampleSize > 0) {
      tags.push(...group.topHashtags.slice(0, 2));
    }

    if (tags.length > 0) {
      hashtagSuggestions = `\n【人気ハッシュタグ（参考）】\n${tags.join(', ')}`;
    }
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
- ハッシュタグ: 3-5個（画像に関連するもの）
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
${templates.address ? `住所: ${templates.address}` : ''}
${templates.business_hours ? `営業時間: ${templates.business_hours}` : ''}
${Object.entries(templates.custom_fields || {})
  .map(([key, val]) => `${key}: ${val}`)
  .join('\n')}`
    : '';

  // 集合知情報の追加
  let hashtagSuggestions = '';
  if (blendedInsights) {
    const { category, group } = blendedInsights;
    const tags = [];

    if (category && category.sampleSize > 0) {
      tags.push(...category.topHashtags.slice(0, 3));
    }
    if (group && group.sampleSize > 0) {
      tags.push(...group.topHashtags.slice(0, 2));
    }

    if (tags.length > 0) {
      hashtagSuggestions = `\n【人気ハッシュタグ（参考）】\n${tags.join(', ')}`;
    }
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
- ハッシュタグ: 3-5個（内容に関連するもの）
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
