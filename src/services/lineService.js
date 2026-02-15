const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_API_BASE = 'https://api.line.me/v2/bot';
const LINE_DATA_BASE = 'https://api-data.line.me/v2/bot';

/**
 * LINE にテキストメッセージを返信
 */
export async function replyText(replyToken, text) {
  // テキストが5000文字を超える場合は切り詰め
  const trimmed = text.length > 5000 ? text.slice(0, 4990) + '\n...' : text;

  const res = await fetch(`${LINE_API_BASE}/message/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text: trimmed }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE返信失敗: ${res.status} ${body}`);
  }
}

/**
 * LINE にプッシュメッセージを送信
 */
export async function pushMessage(lineUserId, messages) {
  const res = await fetch(`${LINE_API_BASE}/message/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINEプッシュメッセージ送信失敗: ${res.status} ${body}`);
  }
}

/**
 * LINE Content API から画像バイナリを取得し Base64 文字列で返す
 */
export async function getImageAsBase64(messageId) {
  const res = await fetch(`${LINE_DATA_BASE}/message/${messageId}/content`, {
    headers: {
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
  });

  if (!res.ok) {
    throw new Error(`画像取得失敗: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
}
