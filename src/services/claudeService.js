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
  "main_subject": "写真の主役（1つだけ。人物メインなら「人物」と書く。料理・商品なら具体名）",
  "supporting_elements": ["補足要素1", "補足要素2", "補足要素3"],
  "description": "写真全体の簡潔な説明（色味・光・質感・時間帯・季節感を含む。3文以内）",
  "observations": [
    "視覚的事実1（光・影・色・形・質感・位置関係のみ）",
    "視覚的事実2",
    "視覚的事実3"
  ],
  "viewpoints": [
    "発見1: あなたも気づいていない魅力（15字以内。モノ系）",
    "発見2: あなたも気づいていない魅力（15字以内。細部系）",
    "発見3: あなたも気づいていない魅力（15字以内。場の要素系）"
  ],
  "main_subject_tag": "food|person|hands|workspace|interior|coffee|drink|product|other のいずれか1つ",
  "scene_type": "meal|cooking|cafe_work|portrait|conversation|empty_space|display|other のいずれか1つ",
  "has_person": true または false,
  "action_type": "eating|kneading|holding|drinking|talking|looking_out|arranging|serving|none のいずれか1つ",
  "lighting_type": "natural_soft|warm_indoor|hard_backlight|low_light|bright_daylight のいずれか1つ",
  "camera_angle": "eye_level|top_down|side|diagonal|close_crop のいずれか1つ",
  "color_tone": "warm|cool|neutral|monochrome|vibrant のいずれか1つ",
  "subject_density": "single|few|many のいずれか1つ",
  "composition_type": "center|rule_of_thirds|symmetry|frame|diagonal のいずれか1つ"
}

ルール:
- main_subject: 写真で一番目立つもの。1つだけ特定する
  - 人物がメインの写真 → main_subjectは「人物」。服のパーツ名（ジップ、ボタン等）にしない
  - 人物写真のsupporting_elementsは「表情の雰囲気」「光」「背景」など場の要素にする
- supporting_elements: main_subject以外の要素（器・背景・光源など）。3つまで
- observations: 見えているものだけ。感想・雰囲気・効果は書かない。食レポ禁止（パリッと、ふわふわ等）
  - 人物写真の場合: 服の部品を1つずつ列挙しない。全体の空気感・光・表情の方向性を観察する
- viewpoints: 3つは必ず別々の対象（①モノ ②細部 ③場の要素）。感情・比喩・分析語は禁止。「〜がいい」「〜が効いてる」くらいの軽さ
  - 人物写真の場合: 服のパーツではなく「光の当たり方」「表情の一瞬」「場の空気」から発見する
- 写真に写っていないものを創作しない
- 人数を推測しない（皿が2つでも「二人」と書かない。見えているモノだけ記述する）
- 人物の容姿・体型・年齢への言及は禁止
- main_subject_tag: main_subjectの英語分類タグ。必ず指定の選択肢から1つ選ぶ
- scene_type: 写真のシーン分類。必ず指定の選択肢から1つ選ぶ
- has_person: 人物が写っているかどうか（true/false）
- action_type: 写っている人物や手の動作。人物なしならnone
- lighting_type: 光の種類。必ず指定の選択肢から1つ選ぶ
- camera_angle: カメラアングル。必ず指定の選択肢から1つ選ぶ
- color_tone: 写真全体の色調。warm=暖色系, cool=寒色系, neutral=中間, monochrome=モノトーン/白黒寄り, vibrant=鮮やか/カラフル
- subject_density: 主な被写体の数。single=1つ, few=2-3個, many=4個以上
- composition_type: 構図タイプ。center=中央配置, rule_of_thirds=三分割, symmetry=対称, frame=フレーム構図, diagonal=斜め/対角線
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
