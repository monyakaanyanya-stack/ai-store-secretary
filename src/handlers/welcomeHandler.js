import { LINE_API_BASE, CHANNEL_ACCESS_TOKEN } from '../config/env.js';

/**
 * ウェルカムメッセージを送信（友だち追加時）
 * @param {string} lineUserId - LINEユーザーID
 */
export async function sendWelcomeMessage(lineUserId) {
  const message = {
    type: 'text',
    text: `✨ AI店舗秘書へようこそ！

━━━━━━━━━━━━━━━
【こんなことができます】
━━━━━━━━━━━━━━━

📝 InstagramやX用の投稿文を自動生成
例: 「新商品のケーキ」→ 魅力的な投稿文に変換

🧠 使うほど賢くなるAI
あなたの好みを学習して、よりピッタリな文章に

📊 集合知で成功パターンを共有
同業種の成功データから最適な投稿を提案

━━━━━━━━━━━━━━━
【使い方はとても簡単】
━━━━━━━━━━━━━━━

1️⃣ 「登録」と送信してお店を登録
2️⃣ 商品やイベントを教える
3️⃣ 投稿文が自動生成される

━━━━━━━━━━━━━━━

まずは「登録」と送信して
お店を登録してみましょう！

分からないことがあれば
「ヘルプ」と送ってくださいね😊`
  };

  try {
    const res = await fetch(`${LINE_API_BASE}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [message],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LINEプッシュ失敗: ${res.status} ${body}`);
    }

    console.log(`[Welcome] ウェルカムメッセージ送信完了: ${lineUserId}`);
  } catch (err) {
    console.error('[Welcome] ウェルカムメッセージ送信エラー:', err.message);
  }
}

/**
 * 画像付きウェルカムメッセージ（将来的に実装）
 * TODO: 実際の画像URLを用意してから有効化
 */
export async function sendWelcomeMessageWithImages(lineUserId) {
  // 画像URLを環境変数または設定ファイルから取得
  // const imageUrl1 = process.env.WELCOME_IMAGE_1_URL;
  // const imageUrl2 = process.env.WELCOME_IMAGE_2_URL;

  // 現時点ではテキストメッセージのみ
  await sendWelcomeMessage(lineUserId);
}
