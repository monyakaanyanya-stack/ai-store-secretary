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
              text: `あなたは店舗写真の観察者です。この写真から以下の5項目を読み取ってください。

1. 何が写っているか — 被写体を具体的に（商品名・料理名が推測できれば記載）
2. 視覚的な印象 — 色味・光の当たり方・質感（実際に見えるもののみ）
3. 五感の推測 — この写真から想像できる香り・音・温度・手触りを1-2つ
4. 時間帯・季節感 — 光や雰囲気から推測できる時間帯や季節
5. 記憶を呼ぶ要素 — この写真を見た人が「あ、行きたい」と感じそうなポイント

6. 【Observation — 視覚的事実の列挙】
   写真の中の「見えているもの」だけを書く。
   Observationは完全な視覚的事実のみ。効果・印象・雰囲気・意味は一切書かない。
   ルール:
   - 光 / 影 / 質感 / 色 / 形 / 位置関係 に注目
   - 料理・商品の「食レポ」は禁止（パリッと、ふわふわ、ジューシー、もちもち等）
   - 一般的な感想は禁止（美味しそう、素敵、こだわり）
   - 人が見落としそうな小さな要素を優先
   形式: 箇条書きで3〜5個
   良い例:
   - カップの縁に暖色の光が反射している
   - チーズケーキの焼き色が外側から内側へ徐々に薄くなっている
   - 黒いテーブルにカップの影がうっすら映っている
   悪い例:
   - カップの縁の光が暖かい雰囲気を作っている（←「雰囲気」は効果。ここでは書かない）
   - 焼き色が美味しそう（←感想。禁止）

7. 【Detection — 店主も気づいていない魅力の発見】
   Observationを元に「この写真の印象を決めている細部」を3つ選ぶ。
   「何が写っているか」ではなく「何がこの写真の印象を決めているか」を発見する。
   フォーマット（厳守）: [① _] <具体物>が<シンプルな効果>
   ルール:
   - 料理説明ではなく「発見」を書く
   - 感情・比喩・詩的表現は禁止
   - 1文で完結。「〜し、」で繋げない。短く
   - 分析・評論の言葉は禁止（差別化、視覚化、決定、強調、構成等）
   - 店主に見せるボタンなので、パッと読める軽さで
   良い例:
   [① _] 黒いテーブルが器を浮かび上がらせている
   [② _] 焼き色の濃淡に手焼きの跡が残っている
   [③ _] カップの縁の暖色の光が画面を温かくしている
   悪い例:
   [① _] 静かな夜の時間を感じる（←感情。禁止）
   [② _] 表面がパリッとして中がふわふわ（←食レポ。禁止）
   [③ _] 工業製品との差別化を図っている（←分析語。禁止）

ルール:
- 1〜5は詩的な表現は不要。自然な日本語で簡潔に
- 写真に写っていないものを創作しない
- 五感の推測は「〜しそう」「〜だろう」の推量表現で
- 1〜5は箇条書き
- 6のObservationは素材（視覚的事実のみ）。7のDetectionで「事実+効果」に昇格させる。この順序を必ず守る
- 7の3つは同じような切り口にならないこと`,
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
