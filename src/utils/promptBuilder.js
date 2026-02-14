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
export function buildImagePostPrompt(store, learningData) {
  return `あなたは${store.name}のSNS投稿を作成するAI秘書です。

【重要な指示】
まず画像を詳細に分析し、何が写っているのかを正確に把握してください。
画像の内容を最優先してInstagram投稿を作成してください。

【投稿作成時の基本方針】
- 口調: ${getToneName(store.tone)}の語り口で書く
- 店舗の雰囲気: ${store.name}は「${store.strength}」がテーマ（参考程度）
- 学習データ: ${learningData.preferredWords?.join(', ') || 'なし'}

【画像分析と投稿作成の手順】
1. この画像に何が写っているかを正確に特定
2. 写っているもの（商品/アイテム/風景など）を主役にして投稿文を作成
3. ${getToneName(store.tone)}な口調で、自然で魅力的な文章にする
4. 関連性の高いハッシュタグを3-5個追加
5. 絵文字を効果的に使用

【注意事項】
- 画像に写っていないものを無理に結びつけない
- 「${store.strength}」は店舗のベース情報として軽く触れる程度でOK
- 画像の内容が店舗テーマと異なっても、画像内容を優先する

Instagram用に最適化された投稿文のみを出力してください（200-300文字程度）。`;
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
