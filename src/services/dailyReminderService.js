import { supabase } from './supabaseService.js';
import { pushMessage } from './lineService.js';
import { getUserSubscription } from './subscriptionService.js';

/**
 * デイリーリマインダー: 有料ユーザー全員に報告を促す
 * - Freeプランはスキップ（Push通数削減）
 * - リマインダー停止済みユーザーはスキップ
 * - Instagram連携済みユーザーはスキップ
 */
export async function sendDailyReminders() {
  console.log('[DailyReminder] リマインダー送信開始');

  try {
    // リマインダー有効なユーザー情報を取得（reminder_enabled が null または true）
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .or('reminder_enabled.is.null,reminder_enabled.eq.true');

    if (userError) {
      console.error('[DailyReminder] ユーザー取得エラー:', userError.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('[DailyReminder] リマインダー有効ユーザーなし');
      return;
    }

    // Instagram連携済み店舗のstore_idを取得（連携済みユーザーはリマインダー不要）
    let instagramLinkedStoreIds = new Set();
    try {
      const { data: igAccounts } = await supabase
        .from('instagram_accounts')
        .select('store_id')
        .eq('is_active', true);
      if (igAccounts) {
        instagramLinkedStoreIds = new Set(igAccounts.map(a => a.store_id));
      }
    } catch (err) {
      console.warn('[DailyReminder] Instagram連携チェック失敗（続行）:', err.message);
    }

    let sentCount = 0;
    let skipCount = 0;
    let igSkipCount = 0;
    let freeSkipCount = 0;
    const sentLineUserIds = new Set(); // 重複防止用

    for (const user of users) {
      if (sentLineUserIds.has(user.line_user_id)) {
        skipCount++;
        continue;
      }

      // Instagram連携済みの店舗を使っている場合はスキップ
      if (user.current_store_id && instagramLinkedStoreIds.has(user.current_store_id)) {
        igSkipCount++;
        continue;
      }

      // Freeプランユーザーはスキップ（Push通数削減）
      try {
        const sub = await getUserSubscription(user.id);
        if (sub.plan === 'free') {
          freeSkipCount++;
          continue;
        }
      } catch (subErr) {
        console.warn(`[DailyReminder] サブスク確認失敗（スキップ）: ${user.line_user_id.slice(0, 4)}****`);
        continue;
      }

      try {
        await sendReminderToUser(user.line_user_id);
        sentLineUserIds.add(user.line_user_id);
        sentCount++;

        // レート制限対策: 各送信間に100ms待機
        await sleep(100);
      } catch (err) {
        console.error(`[DailyReminder] 送信エラー: ${user.line_user_id.slice(0, 4)}****`, err.message);
      }
    }

    console.log(`[DailyReminder] リマインダー送信完了: 送信=${sentCount}, スキップ=${skipCount}, IG連携スキップ=${igSkipCount}, Freeスキップ=${freeSkipCount}`);
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

昨日の投稿、Instagramに載せましたか？
学習の為に反応を教えてもらえると、私の次の提案の精度が上がります📈

【方法①】インサイト（投稿ページを開いてインサイトを見る）のスクショを送る
 → そのまま送るだけで自動で読み取ります📸

【方法②】テキストで報告
 報告: いいね45 保存8 コメント2
（リーチも分かる場合は「リーチ:450」を追加）

※ リマインダーを停止したい場合は「リマインダー停止」と送信してください`
  };

  await pushMessage(lineUserId, [message]);
  console.log(`[DailyReminder] 送信完了: ${lineUserId.slice(0, 4)}****`);
}

/**
 * スリープ関数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
