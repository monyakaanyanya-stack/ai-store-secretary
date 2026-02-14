const TONE_MAP = {
  friendly: '親しみやすい',
  professional: 'プロフェッショナルな',
  casual: 'カジュアルな',
  passionate: '情熱的な',
  luxury: '高級感のある',
};

function getToneName(tone) {
  return TONE_MAP[tone] || TONE_MAP.friendly;
}

/**
 * 店舗登録テキストを解析するプロンプト
 */
export function buildStoreParsePrompt(userInput) {
  return `以下のテキストから店舗情報を抽出してJSON形式で返してください。

入力: ${userInput}

以下のJSON形式で出力してください（JSONのみ、他の文字は含めないでください）:
{
  "name": "店舗名",
  "strength": "こだわり・強み",
  "tone": "口調（friendly/professional/casual/passionate/luxury のいずれか）"
}`;
}

/**
 * 画像から投稿を生成するプロンプト（Phase 1）
 */
export function buildImagePostPrompt(store, learningData) {
  return `あなたは${store.name}のSNS投稿を作成するAI秘書です。

【店舗情報】
- 店舗名: ${store.name}
- こだわり・強み: ${store.strength}
- 口調: ${getToneName(store.tone)}

【過去の学習データ】
好まれる言葉: ${learningData.preferredWords?.join(', ') || 'なし'}
避ける言葉: ${learningData.avoidWords?.join(', ') || 'なし'}
よく使う絵文字: ${learningData.topEmojis?.join(' ') || 'なし'}

【指示】
この画像の商品について、Instagram投稿用のキャプションを作成してください。

【要件】
1. 店舗の${getToneName(store.tone)}な口調で書く
2. 過去の学習データを反映させる
3. Instagram用に最適化（200-300文字程度）
4. 関連性の高いハッシュタグを3-5個追加
5. 絵文字を効果的に使用

投稿文のみを出力してください。`;
}

/**
 * テキストから投稿を生成するプロンプト
 */
export function buildTextPostPrompt(store, learningData, userText) {
  return `あなたは${store.name}のSNS投稿を作成するAI秘書です。

【店舗情報】
- 店舗名: ${store.name}
- こだわり・強み: ${store.strength}
- 口調: ${getToneName(store.tone)}

【過去の学習データ】
好まれる言葉: ${learningData.preferredWords?.join(', ') || 'なし'}
避ける言葉: ${learningData.avoidWords?.join(', ') || 'なし'}
よく使う絵文字: ${learningData.topEmojis?.join(' ') || 'なし'}

【ユーザーからの情報】
${userText}

【指示】
上記の情報をもとに、Instagram投稿用のキャプションを作成してください。

【要件】
1. 店舗の${getToneName(store.tone)}な口調で書く
2. 過去の学習データを反映させる
3. Instagram用に最適化（200-300文字程度）
4. 関連性の高いハッシュタグを3-5個追加
5. 絵文字を効果的に使用

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
