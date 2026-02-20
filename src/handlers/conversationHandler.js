import { replyText } from '../services/lineService.js';

/**
 * ヘルプリクエストへの応答
 */
export async function handleHelpRequest(user, replyToken) {
  const message = `InstagramやX(Twitter)用の投稿文を自動生成できます！✨

【基本的な使い方】

1️⃣ 商品やイベントを教えてください
例: 「新商品のケーキ」「セール開始」

2️⃣ 投稿文が自動生成されます

3️⃣ 気に入らなければ調整
「直し: もっとカジュアルに」

【便利な機能】

📊 報告: いいね120, 保存15
→ 実績を記録して学習

📚 学習状況
→ AIの学習状態を確認

❓ ヘルプ
→ 詳しい使い方

試しに何か送ってみてください！
例: 「本日のおすすめランチ」`;

  await replyText(replyToken, message);
  console.log(`[Conversation] Help request handled`);
}

/**
 * 挨拶への応答
 */
export async function handleGreeting(user, replyToken) {
  const greetings = [
    'こんにちは！今日はどんな投稿を作りますか？✨',
    'やあ！何か投稿したいことはありますか？',
    'こんにちは！商品やイベントを教えてください！'
  ];

  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  const message = `${greeting}

商品名やイベント内容を送ってください。
例: 「新作パン」「期間限定セール」

分からない場合は「ヘルプ」と送ってね！`;

  await replyText(replyToken, message);
  console.log(`[Conversation] Greeting handled`);
}

/**
 * 混乱状態への応答（ガイダンス）
 */
export async function handleConfusion(user, replyToken) {
  const message = `お困りですか？簡単に使えますよ！😊

【こんな風に使います】

✅ 「新作ケーキ入荷」
→ InstagramやX用の投稿文を作成

✅ 「明日からセール開始」
→ イベント告知の投稿文を作成

✅ 「本日のおすすめランチ」
→ 日替わり投稿を作成

━━━━━━━━━━━━━━━

【あなたのお店について】

まだ登録していない場合:
「登録」と送信してお店を登録

登録済みの場合:
商品やイベントを教えてください！

━━━━━━━━━━━━━━━

詳しくは「ヘルプ」と送ってください。`;

  await replyText(replyToken, message);
  console.log(`[Conversation] Confusion handled`);
}
