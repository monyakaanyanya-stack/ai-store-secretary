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
      max_tokens: 1000,
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
              text: `この写真を分析し、以下のJSON形式で出力してください。

{
  "main_subject": "写真の主役（1つだけ。料理名・商品名が推測できれば具体的に）",
  "supporting_elements": ["補足要素1", "補足要素2", "補足要素3"],
  "description": "写真全体の簡潔な説明（色味・光・質感・時間帯・季節感を含む。3文以内）",
  "observations": [
    "視覚的事実1（光・影・色・形・質感・位置関係のみ）",
    "視覚的事実2",
    "視覚的事実3"
  ],
  "viewpoints": [
    "発見1: 店主も気づいていない魅力（15字以内。モノ系）",
    "発見2: 店主も気づいていない魅力（15字以内。細部系）",
    "発見3: 店主も気づいていない魅力（15字以内。場の要素系）"
  ],
  "main_subject_tag": "food|person|hands|workspace|interior|coffee|drink|product|other のいずれか1つ",
  "scene_type": "meal|cooking|cafe_work|portrait|conversation|empty_space|display|other のいずれか1つ",
  "has_person": true または false,
  "action_type": "eating|kneading|holding|drinking|talking|looking_out|arranging|serving|none のいずれか1つ",
  "lighting_type": "natural_soft|warm_indoor|hard_backlight|low_light|bright_daylight のいずれか1つ",
  "camera_angle": "eye_level|top_down|side|diagonal|close_crop のいずれか1つ"
}

ルール:
- main_subject: 写真で一番目立つもの。1つだけ特定する
- supporting_elements: main_subject以外の要素（器・背景・光源など）。3つまで
- observations: 見えているものだけ。感想・雰囲気・効果は書かない。食レポ禁止（パリッと、ふわふわ等）
- viewpoints: 3つは必ず別々の対象（①モノ ②細部 ③場の要素）。感情・比喩・分析語は禁止。「〜がいい」「〜が効いてる」くらいの軽さ
- 写真に写っていないものを創作しない
- 人数を推測しない（皿が2つでも「二人」と書かない。見えているモノだけ記述する）
- main_subject_tag: main_subjectの英語分類タグ。必ず指定の選択肢から1つ選ぶ
- scene_type: 写真のシーン分類。必ず指定の選択肢から1つ選ぶ
- has_person: 人物が写っているかどうか（true/false）
- action_type: 写っている人物や手の動作。人物なしならnone
- lighting_type: 光の種類。必ず指定の選択肢から1つ選ぶ
- camera_angle: カメラアングル。必ず指定の選択肢から1つ選ぶ
- JSONのみ出力。説明や前置きは不要`,
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
