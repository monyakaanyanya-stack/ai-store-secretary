import cron from 'node-cron';
import { sendDailyReminders } from './dailyReminderService.js';

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

  console.log('[Scheduler] スケジューラー起動完了（毎日 UTC 1:00 = JST 10:00）');
}
