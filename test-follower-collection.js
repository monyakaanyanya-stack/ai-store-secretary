import { sendMonthlyFollowerRequests } from './src/services/monthlyFollowerService.js';

async function testFollowerCollection() {
  console.log('月次フォロワー数収集のテストを開始...');

  try {
    await sendMonthlyFollowerRequests();
    console.log('✅ テスト完了: 全ユーザーにメッセージを送信しました');
  } catch (err) {
    console.error('❌ エラー:', err.message);
  }
}

testFollowerCollection();
