import Anthropic from '@anthropic-ai/sdk';
import { notifyClaudeError } from './errorNotification.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-20250514';
export const MODEL_HAIKU = 'claude-haiku-4-5-20251001';

/**
 * テキストのみのリクエスト
 * S1修正: options引数に対応（max_tokens, temperature, system等）
 * S2対応: systemパラメータ分離に対応
 */
export async function askClaude(prompt, options = {}) {
  try {
    const {
      max_tokens = 1024,
      temperature,
      system,
    } = options;

    const requestParams = {
      model: MODEL,
      max_tokens,
      messages: [{ role: 'user', content: prompt }],
    };

    // temperatureが明示指定された場合のみ設定（未指定ならAPIデフォルト）
    if (temperature !== undefined) {
      requestParams.temperature = temperature;
    }

    // S2対応: systemパラメータで安全にシステムプロンプトを分離
    if (system) {
      requestParams.system = system;
    }

    const response = await client.messages.create(requestParams);

    // M12修正: content配列が空の場合のガード
    if (!response.content || response.content.length === 0) {
      throw new Error('Claude APIから空のレスポンスが返されました');
    }
    return response.content[0].text;
  } catch (error) {
    console.error('[Claude] API エラー:', error.message);
    await notifyClaudeError(error, 'unknown');
    throw error;
  }
}

/**
 * 画像付きリクエスト（Vision）
 */
export async function askClaudeWithImage(prompt, imageBase64, mediaType = 'image/jpeg', options = {}) {
  const { model = MODEL, max_tokens = 1024 } = options;
  try {
    const response = await client.messages.create({
      model,
      max_tokens,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    // M12修正: content配列が空の場合のガード
    if (!response.content || response.content.length === 0) {
      throw new Error('Claude Vision APIから空のレスポンスが返されました');
    }
    return response.content[0].text;
  } catch (error) {
    console.error('[Claude] Vision API エラー:', error.message);
    await notifyClaudeError(error, 'unknown');
    throw error;
  }
}

/**
 * 画像を分析して説明文を取得（投稿生成の前処理用）
 */
export async function describeImage(imageBase64, mediaType = 'image/jpeg') {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 850,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `あなたは店舗写真の観察者です。この写真から以下の5項目を読み取ってください。

1. 何が写っているか — 被写体を具体的に（商品名・料理名が推測できれば記載）
2. 視覚的な印象 — 色味・光の当たり方・質感（実際に見えるもののみ）
3. 五感の推測 — この写真から想像できる香り・音・温度・手触りを1-2つ
4. 時間帯・季節感 — 光や雰囲気から推測できる時間帯や季節
5. 記憶を呼ぶ要素 — この写真を見た人が「あ、行きたい」と感じそうなポイント

6. 写真の観察（3つの視点）— 撮った店主本人も気づいていない可能性のある「具体的な魅力」を3つ見つけてください。
   必ず以下のどれかに基づいて観察すること: 物・光・行動・時間・空気感
   3つはそれぞれ異なる観点から。カテゴリ名は出力しない。
   各15〜25文字。具体的に。
   NG: 抽象的な表現（「心の静寂」「日常の断片」「この場所の記憶」等）
   NG: 撮影テクニック（「この角度で撮ると」「光の入り方を狙って」等）
   NG: 「きれい」「美味しそう」のような感想
   OK: その場で目に見える物・動き・光・温度・匂いを具体的に描写
   フォーマット（厳守）:
   [① _] 〇〇〇〇
   [② _] 〇〇〇〇
   [③ _] 〇〇〇〇
   例: [① _] 焼きたてパンの湯気が朝の光に溶ける瞬間
       [② _] カウンター越しに見えるコーヒーミルの動き
       [③ _] 開店直後のまだ静かな店内

ルール:
- 1〜5は詩的な表現は不要。自然な日本語で簡潔に
- 写真に写っていないものを創作しない
- 五感の推測は「〜しそう」「〜だろう」の推量表現で
- 1〜5は箇条書き
- 6の観察は写真の説明や感想ではなく「この写真のどこに注目すれば投稿になるか」を提案する
- 6の3つは同じような切り口にならないよう、異なる観点（物・光・行動・時間・空気感）から観察する`,
            },
          ],
        },
      ],
    });

    // M12修正: content配列が空の場合のガード
    if (!response.content || response.content.length === 0) {
      throw new Error('Claude画像分析APIから空のレスポンスが返されました');
    }
    return response.content[0].text;
  } catch (error) {
    // S9修正: nullを返さずthrowする（呼び出し元で適切にハンドリング）
    console.error('[Claude] 画像分析エラー:', error.message);
    throw new Error(`画像分析失敗: ${error.message}`);
  }
}
