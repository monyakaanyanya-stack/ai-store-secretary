import { supabase } from './supabaseService.js';
import { pushMessage } from './lineService.js';
import { updateFollowerCount, saveFollowerHistory, getStore } from './supabaseService.js';
import { replyText } from './lineService.js';

/**
 * 月次フォロワー数収集: 毎月1日に全ユーザーにフォロワー数を尋ねる
 */
export async function sendMonthlyFollowerRequests() {
  console.log('[MonthlyFollower] 月次フォロワー数収集開始');

  try {
    // 全ユーザーを取得
    const { data: users, error } = await supabase
      .from('users')
      .select('*, stores!inner(*)');

    if (error) {
      console.error('[MonthlyFollower] ユーザー取得エラー:', error.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('[MonthlyFollower] 対象ユーザーなし');
      return;
    }

    let sentCount = 0;

    for (const user of users) {
      if (!user.current_store_id) {
        continue; // 店舗未設定のユーザーはスキップ
      }

      try {
        // リクエストレコードを作成
        await supabase
          .from('monthly_follower_requests')
          .insert({
            user_id: user.id,
            store_id: user.current_store_id,
            status: 'awaiting_response'
          });

        // メッセージを送信
        await sendFollowerRequestToUser(user.line_user_id);
        sentCount++;

        // レート制限対策: 各送信間に100ms待機
        await sleep(100);
      } catch (err) {
        console.error(`[MonthlyFollower] ユーザー ${user.line_user_id} への送信エラー:`, err.message);
      }
    }

    console.log(`[MonthlyFollower] 月次フォロワー数収集完了: 送信=${sentCount}`);
  } catch (err) {
    console.error('[MonthlyFollower] 月次フォロワー数収集エラー:', err.message);
  }
}

/**
 * 個別ユーザーにフォロワー数収集メッセージを送信
 */
async function sendFollowerRequestToUser(lineUserId) {
  const message = {
    type: 'text',
    text: `今月もお疲れ様です！📊

現在のInstagramフォロワー数を教えてください。
フォロワー数を基準に、より正確なエンゲージメント分析を行います。

【回答方法】
フォロワー: 1250

または、数字だけでも OK です：
1250

※ この情報は月次レポートやエンゲージメント率の計算に使用されます
※ 7日以内に回答してください`
  };

  // C1修正: pushMessageは配列を要求（LINE Push APIの仕様）
  await pushMessage(lineUserId, [message]);
}

/**
 * ユーザーからのフォロワー数応答を処理
 */
export async function handleFollowerCountResponse(user, followerCount, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。先に店舗を登録してください。');
  }

  // フォロワー数のバリデーション
  if (followerCount < 0 || followerCount > 1000000) {
    return await replyText(replyToken, `⚠️ フォロワー数が異常です: ${followerCount}

0〜1,000,000の範囲で入力してください。`);
  }

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '選択中の店舗が見つかりません。');
    }

    // フォロワー数を保存
    await updateFollowerCount(store.id, followerCount);
    await saveFollowerHistory(store.id, followerCount, 'monthly_collection');

    // リクエストを完了状態にする
    await supabase
      .from('monthly_follower_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('store_id', store.id)
      .eq('status', 'awaiting_response');

    console.log(`[MonthlyFollower] フォロワー数保存完了: store=${store.name}, count=${followerCount}`);

    await replyText(replyToken, `✅ フォロワー数を記録しました！

【記録内容】
店舗: ${store.name}
フォロワー数: ${followerCount.toLocaleString()}人

今後のエンゲージメント報告でこの数値を基準に分析します。
ありがとうございました！`);
  } catch (err) {
    console.error('[MonthlyFollower] フォロワー数保存エラー:', err.message);
    // M9修正: 内部エラーメッセージをユーザーに漏洩しない
    console.error('[MonthlyFollower] フォロワー数保存エラー詳細:', err.message);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
  }
}

/**
 * pending中のフォロワー数リクエストを取得
 */
export async function getPendingFollowerRequest(userId, storeId) {
  if (!userId || !storeId) return null;

  const { data } = await supabase
    .from('monthly_follower_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .eq('status', 'awaiting_response')
    .single();

  return data || null;
}

/**
 * スリープ関数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
