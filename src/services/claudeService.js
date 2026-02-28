import Anthropic from '@anthropic-ai/sdk';
import { notifyClaudeError } from './errorNotification.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-20250514';

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
export async function askClaudeWithImage(prompt, imageBase64, mediaType = 'image/jpeg') {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
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
      max_tokens: 600,
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

ルール:
- 詩的な表現は不要。自然な日本語で簡潔に
- 写真に写っていないものを創作しない
- 五感の推測は「〜しそう」「〜だろう」の推量表現で
- 出力は箇条書き`,
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
