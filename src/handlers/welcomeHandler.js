const LINE_API_BASE = 'https://api.line.me/v2/bot';
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

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

📸 画像から投稿文を自動生成
商品やイベントの写真を送るだけで、
InstagramやX用の魅力的な投稿文に！

🧠 あなたの好みを徐々に学習
フィードバックを重ねることで、
あなた好みの文章に近づいていきます

💬 自然な会話でサポート
分からないことがあれば、
普通に話しかけてください！

━━━━━━━━━━━━━━━
【使い方はとても簡単】
━━━━━━━━━━━━━━━

1️⃣ 「登録」と送信してお店を登録
2️⃣ 📸 商品の画像を送信
3️⃣ 投稿文が自動生成される
4️⃣ 「直し:〜」で調整可能

━━━━━━━━━━━━━━━

まずは「登録」と送信して
お店を登録してみましょう！

分からないことがあれば
気軽に質問してくださいね😊`
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
