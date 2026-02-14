const TONE_MAP = {
  friendly: {
    name: '親しみやすい',
    style: 'フレンドリーで親しみやすい語り口',
    instructions: '「〜だよ」「〜ね」「一緒に」などの親しげな語尾を使い、まるで友達に話しかけるような温かみのある表現にしてください。絵文字を適度に使い、読み手との距離を縮めるような文章にします。',
  },
  professional: {
    name: 'プロフェッショナルな',
    style: 'ビジネスライクで洗練された口調',
    instructions: '「ございます」「いたします」「させていただきます」など丁寧な敬語を徹底し、格調高く品のある表現にしてください。フォーマルな語彙を選び、信頼感と専門性を感じさせる文章にします。',
  },
  casual: {
    name: 'カジュアルな',
    style: '気軽で読みやすい口調',
    instructions: '「〜です」「〜ます」の丁寧語のみを使い、堅苦しくない軽快な文章にしてください。絵文字を多めに使い、SNSらしいポップで親しみやすい雰囲気にします。',
  },
  passionate: {
    name: '情熱的な',
    style: '熱量の高い感情豊かな口調',
    instructions: '「！」を多用し、「本当に」「すごく」「めちゃくちゃ」などの感嘆詞や強調表現を使って、熱意と情熱が伝わる文章にしてください。エネルギッシュで感情が前面に出る表現を心がけます。',
  },
  luxury: {
    name: '高級感のある',
    style: '上品で洗練された格調高い口調',
    instructions: '「上質な」「洗練された」「厳選された」など高級感を感じさせる語彙を選び、エレガントで品格のある表現にしてください。控えめな絵文字使用で、落ち着いた大人の雰囲気を演出します。',
  },
};

export const POST_LENGTH_MAP = {
  xshort: { range: '50-80文字', description: '超短文' },
  short: { range: '100-150文字', description: '短文' },
  medium: { range: '200-300文字', description: '中文' },
  long: { range: '400-500文字', description: '長文' },
};

function getToneName(tone) {
  const toneData = TONE_MAP[tone] || TONE_MAP.friendly;
  return toneData.name;
}

function getToneInstructions(tone) {
  const toneData = TONE_MAP[tone] || TONE_MAP.friendly;
  return toneData.instructions;
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
 * 画像から投稿を生成するプロンプト（Phase 1）
 */
export function buildImagePostPrompt(store, learningData, lengthOverride = null, blendedInsights = null, personalization = '') {
  const postLength = lengthOverride || store.config?.post_length || 'medium';
  const lengthInfo = getPostLengthInfo(postLength);

  const templates = store.config?.templates || {};
  const templateInfo = Object.keys(templates).length > 0
    ? `\n【店舗テンプレート情報】
${templates.address ? `住所: ${templates.address}` : ''}
${templates.business_hours ? `営業時間: ${templates.business_hours}` : ''}
${Object.entries(templates.custom_fields || {})
  .map(([key, val]) => `${key}: ${val}`)
  .join('\n')}`
    : '';

  // 集合知情報の追加
  let collectiveInsightsInfo = '';
  if (blendedInsights) {
    const { category, group } = blendedInsights;
    const insights = [];

    if (category && category.sampleSize > 0) {
      insights.push(`・同業種で人気のハッシュタグ: ${category.topHashtags.slice(0, 5).join(', ')}`);
      insights.push(`・同業種の平均投稿長: ${category.avgLength}文字`);
    }

    if (group && group.sampleSize > 0) {
      insights.push(`・大カテゴリーのトレンド: ${group.topHashtags.slice(0, 3).join(', ')}`);
    }

    if (insights.length > 0) {
      collectiveInsightsInfo = `\n【業界トレンド（参考情報）】\n${insights.join('\n')}`;
    }
  }

  return `あなたは${store.name}のSNS投稿を作成するAI秘書です。

【STEP 1: 画像の本質的な魅力分析】
まず、この画像を以下の視点で分析してください：

1. **人が写っているか**: 人（特に笑顔や楽しんでいる様子）が写っていると共感を呼びやすい
2. **ストーリーが感じられるか**: 単なる商品写真ではなく、使用シーンや制作過程など「物語」があるか
3. **臨場感・リアルさ**: 作り込みすぎず、自然体で親しみやすい雰囲気があるか
4. **視覚的インパクト**: パッと見て目を引く要素（色彩、構図、被写体の魅力）はあるか
5. **感情を動かす要素**: 見た人が「行きたい」「食べたい」「欲しい」と思える要素は何か

【STEP 2: 投稿文の作成】

**店舗情報:**
- 店舗名: ${store.name}
- こだわり: ${store.strength}（画像内容と自然に結びつく場合のみ軽く触れる）
- 口調: ${getToneName(store.tone)}${templateInfo}${collectiveInsightsInfo}${personalization}

**過去の学習データ:**
- 好まれる言葉: ${learningData.preferredWords?.join(', ') || 'なし'}
- 避ける言葉: ${learningData.avoidWords?.join(', ') || 'なし'}
- よく使う絵文字: ${learningData.topEmojis?.join(' ') || 'なし'}

**投稿作成の要件:**
1. STEP 1で分析した「この写真がなぜ魅力的なのか」を投稿文に自然に盛り込む
2. **口調は必ず守ること**: ${getToneInstructions(store.tone)}
3. Instagram用に最適化（${lengthInfo.range}）
4. 関連性の高いハッシュタグを3-5個追加
5. 絵文字を効果的に使用（口調に合わせて調整）
${templates.address || templates.business_hours ? '6. テンプレート情報を投稿の最後に自然に含める' : ''}

**重要な注意事項:**
- 画像に写っているものを最優先で表現する
- 技術的な写真分析（構図・光・色彩など）は投稿文に含めない
- 「人が楽しんでいる」「美味しそう」「行きたくなる」など、感情を動かす表現を重視
- エンゲージメントが高くなる本質的な魅力（人、ストーリー、臨場感）を言語化
- 店舗テーマと画像が異なる場合も、画像内容を優先
- 業界トレンドは参考程度に、この店舗らしさを最優先

投稿文のみを出力してください。`;
}

/**
 * テキストから投稿を生成するプロンプト
 */
export function buildTextPostPrompt(store, learningData, userText, lengthOverride = null, blendedInsights = null, personalization = '') {
  const postLength = lengthOverride || store.config?.post_length || 'medium';
  const lengthInfo = getPostLengthInfo(postLength);

  const templates = store.config?.templates || {};
  const templateInfo = Object.keys(templates).length > 0
    ? `\n【店舗テンプレート情報】
${templates.address ? `住所: ${templates.address}` : ''}
${templates.business_hours ? `営業時間: ${templates.business_hours}` : ''}
${Object.entries(templates.custom_fields || {})
  .map(([key, val]) => `${key}: ${val}`)
  .join('\n')}`
    : '';

  // 集合知情報の追加
  let collectiveInsightsInfo = '';
  if (blendedInsights) {
    const { category, group } = blendedInsights;
    const insights = [];

    if (category && category.sampleSize > 0) {
      insights.push(`・同業種で人気のハッシュタグ: ${category.topHashtags.slice(0, 5).join(', ')}`);
      insights.push(`・同業種の平均投稿長: ${category.avgLength}文字`);
    }

    if (group && group.sampleSize > 0) {
      insights.push(`・大カテゴリーのトレンド: ${group.topHashtags.slice(0, 3).join(', ')}`);
    }

    if (insights.length > 0) {
      collectiveInsightsInfo = `\n【業界トレンド（参考情報）】\n${insights.join('\n')}`;
    }
  }

  return `あなたは${store.name}のSNS投稿を作成するAI秘書です。

【店舗情報】
- 店舗名: ${store.name}
- こだわり・強み: ${store.strength}
- 口調: ${getToneName(store.tone)}${templateInfo}${collectiveInsightsInfo}${personalization}

【過去の学習データ】
- 好まれる言葉: ${learningData.preferredWords?.join(', ') || 'なし'}
- 避ける言葉: ${learningData.avoidWords?.join(', ') || 'なし'}
- よく使う絵文字: ${learningData.topEmojis?.join(' ') || 'なし'}

【ユーザーからの情報】
${userText}

【指示】
上記の情報をもとに、Instagram投稿用のキャプションを作成してください。

【要件】
1. **口調は必ず守ること**: ${getToneInstructions(store.tone)}
2. 過去の学習データを反映させる
3. Instagram用に最適化（${lengthInfo.range}）
4. 関連性の高いハッシュタグを3-5個追加（業界トレンドを参考にしつつ、投稿内容に合ったものを選ぶ）
5. 絵文字を効果的に使用（口調に合わせて調整）
${templates.address || templates.business_hours ? '6. テンプレート情報を投稿の最後に自然に含める' : ''}

投稿文のみを出力してください。`;
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
