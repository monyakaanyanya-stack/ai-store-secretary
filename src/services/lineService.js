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

  // S8修正: LINE APIレスポンスbodyの詳細をログに記録し、throwには含めない
  if (!res.ok) {
    const body = await res.text();
    console.error(`[LINE] 返信失敗 status=${res.status} body=${body.slice(0, 200)}`);
    throw new Error(`LINE返信失敗: ${res.status}`);
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

  // S8修正: LINE APIレスポンスbodyの詳細をログに記録し、throwには含めない
  if (!res.ok) {
    const body = await res.text();
    console.error(`[LINE] プッシュ送信失敗 status=${res.status} body=${body.slice(0, 200)}`);
    throw new Error(`LINEプッシュメッセージ送信失敗: ${res.status}`);
  }
}

/**
 * LINE に複数メッセージを1回のリプライで返信（最大5メッセージ）
 * pushMessage不要で月間制限にカウントされない
 * @param {string} replyToken
 * @param {Array} messages - [{type:'text', text:'...', quickReply?:{items:[...]}}]
 */
export async function replyMessages(replyToken, messages) {
  // 各テキストメッセージの5000文字制限を適用
  const trimmedMessages = messages.map(msg => {
    if (msg.type === 'text' && msg.text && msg.text.length > 5000) {
      return { ...msg, text: msg.text.slice(0, 4990) + '\n...' };
    }
    return msg;
  });

  const res = await fetch(`${LINE_API_BASE}/message/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: trimmedMessages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[LINE] 複数メッセージ返信失敗 status=${res.status} body=${body.slice(0, 200)}`);
    throw new Error(`LINE複数メッセージ返信失敗: ${res.status}`);
  }
}

/**
 * LINE にクイックリプライ付きテキストを返信
 * @param {string} replyToken
 * @param {string} text - 本文
 * @param {Array} items - QuickReply items: [{ type: 'action', action: { type: 'message', label: 'A', text: 'A' } }]
 */
export async function replyWithQuickReply(replyToken, text, items) {
  const trimmed = text.length > 5000 ? text.slice(0, 4990) + '\n...' : text;

  const res = await fetch(`${LINE_API_BASE}/message/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{
        type: 'text',
        text: trimmed,
        quickReply: { items },
      }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[LINE] QuickReply返信失敗 status=${res.status} body=${body.slice(0, 200)}`);
    throw new Error(`LINE QuickReply返信失敗: ${res.status}`);
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
