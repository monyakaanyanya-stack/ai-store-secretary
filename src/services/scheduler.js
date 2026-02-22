import cron from 'node-cron';
import { sendDailyReminders } from './dailyReminderService.js';
import { collectDailySummary } from './dailySummaryService.js';
import { notifyDailySummary, notifyCategoryPromotion } from './errorNotification.js';
import { sendMonthlyFollowerRequests } from './monthlyFollowerService.js';
import { detectPopularOtherCategories } from './collectiveIntelligence.js';

// H18修正: cron ジョブの重複実行防止ロック
const jobLocks = new Map();

/**
 * 排他ロック付きジョブ実行
 * 前回の実行が終わっていない場合はスキップ
 */
async function runWithLock(jobName, fn) {
  if (jobLocks.get(jobName)) {
    console.warn(`[Scheduler] ${jobName} はまだ実行中のためスキップ`);
    return;
  }

  jobLocks.set(jobName, true);
  const startTime = Date.now();
  try {
    await fn();
    console.log(`[Scheduler] ${jobName} 完了 (${Date.now() - startTime}ms)`);
  } catch (error) {
    console.error(`[Scheduler] ${jobName} エラー:`, error);
  } finally {
    jobLocks.set(jobName, false);
  }
}

/**
 * スケジューラー起動
 */
export function startScheduler() {
  // 毎日朝10時（日本時間）にリマインダー送信
  // cron形式: 分 時 日 月 曜日
  // 注意: Railway/Herokuは UTC タイムゾーンなので、日本時間10時 = UTC 1時
  cron.schedule('0 1 * * *', () => {
    runWithLock('デイリーリマインダー', sendDailyReminders);
  }, {
    timezone: 'UTC'
  });

  // 毎日23:59（日本時間）にデイリーサマリー送信
  // JST 23:59 = UTC 14:59
  cron.schedule('59 14 * * *', () => {
    runWithLock('デイリーサマリー', async () => {
      const summary = await collectDailySummary();
      await notifyDailySummary(summary);
      console.log('[Scheduler] デイリーサマリー送信完了:', summary);
    });
  }, {
    timezone: 'UTC'
  });

  // 毎月1日の朝10時（日本時間）にフォロワー数収集
  // JST 10:00 = UTC 1:00
  cron.schedule('0 1 1 * *', () => {
    runWithLock('月次フォロワー数収集', sendMonthlyFollowerRequests);
  }, {
    timezone: 'UTC'
  });

  // 毎週月曜 朝9時（日本時間）に other カテゴリー昇格チェック
  // JST 9:00 = UTC 0:00
  cron.schedule('0 0 * * 1', () => {
    runWithLock('カテゴリー昇格チェック', async () => {
      const candidates = await detectPopularOtherCategories(5);
      if (candidates.length > 0) {
        console.log('[Scheduler] 昇格候補:', candidates);
        await notifyCategoryPromotion(candidates);
      } else {
        console.log('[Scheduler] 昇格候補なし');
      }
    });
  }, {
    timezone: 'UTC'
  });

  console.log('[Scheduler] スケジューラー起動完了');
  console.log('  - デイリーリマインダー: 毎日 UTC 1:00 (JST 10:00)');
  console.log('  - デイリーサマリー: 毎日 UTC 14:59 (JST 23:59)');
  console.log('  - 月次フォロワー数収集: 毎月1日 UTC 1:00 (JST 10:00)');
  console.log('  - カテゴリー昇格チェック: 毎週月曜 UTC 0:00 (JST 9:00)');
}
