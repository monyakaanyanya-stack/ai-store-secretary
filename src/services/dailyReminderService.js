import { supabase } from './supabaseService.js';
import { pushMessage } from './lineService.js';

/**
 * デイリーリマインダー: 全ユーザーに報告を促すメッセージを送信
 */
export async function sendDailyReminders() {
  console.log('[DailyReminder] リマインダー送信開始');

  try {
    // リマインダー有効なユーザーを取得（デフォルトはすべて有効）
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('reminder_enabled', true); // デフォルト true

    if (error) {
      console.error('[DailyReminder] ユーザー取得エラー:', error.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('[DailyReminder] 対象ユーザーなし');
      return;
    }

    let sentCount = 0;
    let skipCount = 0;

    for (const user of users) {
      try {
        // 最後に投稿を生成してから24時間以上経過しているかチェック
        const { data: recentPost } = await supabase
          .from('post_history')
          .select('created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // 投稿履歴がない、または24時間以上経過している場合のみ送信
        if (!recentPost || isMoreThan24HoursAgo(recentPost.created_at)) {
          await sendReminderToUser(user.line_user_id);
          sentCount++;

          // レート制限対策: 各送信間に100ms待機
          await sleep(100);
        } else {
          skipCount++;
        }
      } catch (err) {
        console.error(`[DailyReminder] ユーザー ${user.line_user_id} への送信エラー:`, err.message);
      }
    }

    console.log(`[DailyReminder] リマインダー送信完了: 送信=${sentCount}, スキップ=${skipCount}`);
  } catch (err) {
    console.error('[DailyReminder] リマインダー送信エラー:', err.message);
  }
}

/**
 * 個別ユーザーにリマインダーを送信
 */
async function sendReminderToUser(lineUserId) {
  const message = {
    type: 'text',
    text: `おはようございます☀️

昨日Instagramに投稿しましたか？
エンゲージメントを報告すると、集合知が成長します！

【報告方法】
報告: いいね120, 保存15, コメント5

と送信してください。

※ リマインダーを停止したい場合は「リマインダー停止」と送信してください`
  };

  await pushMessage(lineUserId, [message]);
  console.log(`[DailyReminder] 送信完了: ${lineUserId}`);
}

/**
 * 24時間以上前かチェック
 */
function isMoreThan24HoursAgo(timestamp) {
  const now = new Date();
  const postDate = new Date(timestamp);
  const diffHours = (now - postDate) / (1000 * 60 * 60);
  return diffHours >= 24;
}

/**
 * スリープ関数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
