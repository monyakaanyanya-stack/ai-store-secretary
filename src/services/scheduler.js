import cron from 'node-cron';
import { sendDailyReminders } from './dailyReminderService.js';
import { collectDailySummary } from './dailySummaryService.js';
import { notifyDailySummary } from './errorNotification.js';
import { sendMonthlyFollowerRequests } from './monthlyFollowerService.js';

/**
 * スケジューラー起動
 */
export function startScheduler() {
  // 毎日朝10時（日本時間）にリマインダー送信
  // cron形式: 分 時 日 月 曜日
  // 注意: Railway/Herokuは UTC タイムゾーンなので、日本時間10時 = UTC 1時
  cron.schedule('0 1 * * *', async () => {
    console.log('[Scheduler] デイリーリマインダー実行開始');
    try {
      await sendDailyReminders();
    } catch (error) {
      console.error('[Scheduler] リマインダー実行エラー:', error);
    }
  }, {
    timezone: 'UTC'
  });

  // 毎日23:59（日本時間）にデイリーサマリー送信
  // JST 23:59 = UTC 14:59
  cron.schedule('59 14 * * *', async () => {
    console.log('[Scheduler] デイリーサマリー実行開始');
    try {
      const summary = await collectDailySummary();
      await notifyDailySummary(summary);
      console.log('[Scheduler] デイリーサマリー送信完了:', summary);
    } catch (error) {
      console.error('[Scheduler] デイリーサマリー実行エラー:', error);
    }
  }, {
    timezone: 'UTC'
  });

  // 毎月1日の朝10時（日本時間）にフォロワー数収集
  // JST 10:00 = UTC 1:00
  cron.schedule('0 1 1 * *', async () => {
    console.log('[Scheduler] 月次フォロワー数収集実行開始');
    try {
      await sendMonthlyFollowerRequests();
    } catch (error) {
      console.error('[Scheduler] フォロワー数収集エラー:', error);
    }
  }, {
    timezone: 'UTC'
  });

  console.log('[Scheduler] スケジューラー起動完了');
  console.log('  - デイリーリマインダー: 毎日 UTC 1:00 (JST 10:00)');
  console.log('  - デイリーサマリー: 毎日 UTC 14:59 (JST 23:59)');
  console.log('  - 月次フォロワー数収集: 毎月1日 UTC 1:00 (JST 10:00)');
}
