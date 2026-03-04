import { supabase } from './supabaseService.js';
import { pushMessage } from './lineService.js';

/**
 * デイリーリマインダー: 昨日（JST）投稿を生成したユーザーにのみ報告を促す
 *
 * 修正前の問題: 全ユーザーに「24時間以上生成してない人」基準で送っていた
 * 修正後: 「昨日(JST)に投稿を生成した人」だけに送る
 */
export async function sendDailyReminders() {
  console.log('[DailyReminder] リマインダー送信開始');

  try {
    // JST「昨日」の日付範囲を計算
    // Railway は UTC 動作のため、JST = UTC+9 として変換
    const JST_OFFSET = 9 * 60 * 60 * 1000;
    const nowUtc = new Date();
    const nowJst = new Date(nowUtc.getTime() + JST_OFFSET);

    // 昨日（JST）の 00:00:00 〜 23:59:59 を UTC に変換
    const yesterdayJst = new Date(nowJst);
    yesterdayJst.setDate(yesterdayJst.getDate() - 1);

    const yesterdayStartJst = new Date(yesterdayJst);
    yesterdayStartJst.setHours(0, 0, 0, 0);

    const yesterdayEndJst = new Date(yesterdayJst);
    yesterdayEndJst.setHours(23, 59, 59, 999);

    const yesterdayStartUtc = new Date(yesterdayStartJst.getTime() - JST_OFFSET);
    const yesterdayEndUtc = new Date(yesterdayEndJst.getTime() - JST_OFFSET);

    console.log(`[DailyReminder] 昨日(JST)範囲: ${yesterdayStartUtc.toISOString()} 〜 ${yesterdayEndUtc.toISOString()}`);

    // 昨日（JST）に投稿を生成したユーザーのIDを取得
    const { data: yesterdayPosts, error: postError } = await supabase
      .from('post_history')
      .select('user_id')
      .gte('created_at', yesterdayStartUtc.toISOString())
      .lte('created_at', yesterdayEndUtc.toISOString());

    if (postError) {
      console.error('[DailyReminder] 投稿履歴取得エラー:', postError.message);
      return;
    }

    if (!yesterdayPosts || yesterdayPosts.length === 0) {
      console.log('[DailyReminder] 昨日投稿を生成したユーザーなし → リマインダー送信なし');
      return;
    }

    // ユニークなuser_idを抽出
    const userIds = [...new Set(yesterdayPosts.map(p => p.user_id))];
    console.log(`[DailyReminder] 昨日生成ユーザー数: ${userIds.length}件`);

    // リマインダー有効なユーザー情報を取得（reminder_enabled が null または true）
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .in('id', userIds)
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

    console.log(`[DailyReminder] リマインダー送信完了: 送信=${sentCount}, スキップ=${skipCount}, IG連携スキップ=${igSkipCount}`);
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
数値を教えてもらえると、AIが学習して次の提案の精度が上がります📈

【方法①】インサイトのスクショを送る（おすすめ）
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
