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
      max_tokens: 700,
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
              text: `あなたはプロの写真家です。この写真を以下の5項目で分析してください。

- 主要な被写体: 何が写っているか具体的な名前で
- 光の質と方向: 逆光・サイド光・柔らかい自然光・人工光など、光が被写体にどんな表情を与えているか
- 色と質感: 温かみ・冷たさ・柔らかさ・透明感・艶など（実際に見えるもの）
- 構図の特徴: ボケ・アングル（俯瞰/目線/見上げ）・余白の使い方・フレーミングの意図
- 全体の雰囲気・空気感: 光と色から自然に生まれる感覚（叙情的に表現してよい）

【ルール】
- 写真に実際に見えるものを根拠に分析する
- 「光と影が作る柔らかな空気感」などの叙情的表現は積極的に使ってよい
- 写真に写っていない音・においの描写は禁止
- 箇条書きで出力する`,
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
