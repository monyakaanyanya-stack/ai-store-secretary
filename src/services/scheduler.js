import cron from 'node-cron';
import { sendDailyReminders } from './dailyReminderService.js';
import { collectDailySummary } from './dailySummaryService.js';
import { notifyDailySummary, notifyCategoryPromotion } from './errorNotification.js';

import { detectPopularOtherCategories } from './collectiveIntelligence.js';
import { sendWeeklyPlansToAllPremium } from './weeklyPlanService.js';
import { sendDailyPhotoNudges } from './dailyNudgeService.js';
import { runNightlyEngagementSync } from './nightlyEngagementService.js';

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

  // 毎日17時（日本時間）に撮影提案ナッジ送信
  // JST 17:00 = UTC 8:00
  cron.schedule('0 8 * * *', () => {
    runWithLock('デイリー撮影ナッジ', sendDailyPhotoNudges);
  }, {
    timezone: 'UTC'
  });

  // 毎日深夜2時（日本時間）にInstagramエンゲージメント自動同期
  // JST 2:00 = UTC 17:00
  cron.schedule('0 17 * * *', () => {
    runWithLock('夜間エンゲージメント同期', runNightlyEngagementSync);
  }, {
    timezone: 'UTC'
  });

  // 毎週月曜 朝9:30（日本時間）にPremiumユーザーに週間計画を送信
  // JST 9:30 月曜 = UTC 0:30 月曜
  cron.schedule('30 0 * * 1', () => {
    runWithLock('週間コンテンツ計画', sendWeeklyPlansToAllPremium);
  }, {
    timezone: 'UTC'
  });

  console.log('[Scheduler] スケジューラー起動完了');
  console.log('  - デイリーリマインダー: 毎日 UTC 1:00 (JST 10:00)');
  console.log('  - デイリー撮影ナッジ: 毎日 UTC 8:00 (JST 17:00)');
  console.log('  - デイリーサマリー: 毎日 UTC 14:59 (JST 23:59)');
  console.log('  - カテゴリー昇格チェック: 毎週月曜 UTC 0:00 (JST 9:00)');
  console.log('  - 夜間エンゲージメント同期: 毎日 UTC 17:00 (JST 2:00)');
  console.log('  - 週間コンテンツ計画: 毎週月曜 UTC 0:30 (JST 9:30)');
}
