import Anthropic from '@anthropic-ai/sdk';
import { notifyClaudeError } from './errorNotification.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-20250514';

/**
 * テキストのみのリクエスト
 */
export async function askClaude(prompt) {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

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
      max_tokens: 500,
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
              text: `この画像に実際に写っているものだけを説明してください。

【厳守ルール】
- 写真に実際に映っているものだけを書く
- 写真に写っていないもの（音・においなどの感覚情報・周辺状況の推測・想像）は一切書かない
- 「〜にいる」「〜の近く」「〜が感じられる」などの推測表現は禁止
- 「おそらく」「〜かもしれない」などの曖昧表現も禁止

以下を箇条書きで：
- 主要な被写体（何が写っているか、具体的な名前で）
- 見えている背景・場所（推測せず、実際に見える範囲だけ）
- 色・素材・質感・状態
- 目立つディテール・特徴

余計な前置きや解釈は不要。見えるものだけを報告する。`,
            },
          ],
        },
      ],
    });

    return response.content[0].text;
  } catch (error) {
    console.error('[Claude] 画像分析エラー:', error.message);
    return null;
  }
}
