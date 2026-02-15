import { collectDailySummary } from './src/services/dailySummaryService.js';
import { notifyDailySummary } from './src/services/errorNotification.js';

async function testDailySummary() {
  console.log('デイリーサマリーのテストを開始...');

  try {
    const summary = await collectDailySummary();
    console.log('集計結果:', summary);

    await notifyDailySummary(summary);
    console.log('✅ LINE通知を送信しました');
  } catch (err) {
    console.error('❌ エラー:', err.message);
  }
}

testDailySummary();
