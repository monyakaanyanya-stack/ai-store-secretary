import { replyText } from '../services/lineService.js';
import { supabase } from '../services/supabaseService.js';

/**
 * データリセット確認メッセージ
 */
export async function handleDataResetPrompt(user, replyToken) {
  console.log(`[DataReset] handleDataResetPrompt called: user=${user.id}, store=${user.current_store_id}`);

  if (!user.current_store_id) {
    console.warn(`[DataReset] 店舗未選択: user=${user.id}`);
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  console.log(`[DataReset] 確認メッセージ送信開始: store=${user.current_store_id}`);

  const message = `⚠️ データリセット確認

以下のデータをすべて削除します：
━━━━━━━━━━━━━━━
📝 投稿履歴（AIが生成した投稿）
🧠 学習データ（フィードバック履歴）
📚 学習プロファイル（AIの学習状態）
━━━━━━━━━━━━━━━

【保持されるデータ】
✅ 店舗情報（店名、業種、こだわり、口調）
✅ エンゲージメント報告データ（集合知データ）

⚠️ 削除したデータは復元できません

本当にリセットしますか？

実行する場合: 「リセット実行」
キャンセル: 「キャンセル」`;

  await replyText(replyToken, message);
  console.log(`[DataReset] 確認メッセージ送信完了`);
}

/**
 * データリセット実行
 */
export async function handleDataResetExecution(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const storeId = user.current_store_id;

    // 1. 投稿履歴を削除
    const { count: postCount } = await supabase
      .from('post_history')
      .delete()
      .eq('store_id', storeId);

    // 2. 学習データを削除
    const { count: learningCount } = await supabase
      .from('learning_data')
      .delete()
      .eq('store_id', storeId);

    // 3. 学習プロファイルを削除
    await supabase
      .from('learning_profiles')
      .delete()
      .eq('store_id', storeId);

    console.log(`[DataReset] データリセット完了: store=${storeId}, posts=${postCount}, learning=${learningCount}`);

    const message = `✅ データリセット完了

削除されたデータ:
━━━━━━━━━━━━━━━
📝 投稿履歴: ${postCount || 0}件
🧠 学習データ: ${learningCount || 0}件
━━━━━━━━━━━━━━━

【保持されたデータ】
✅ エンゲージメント報告データ（集合知データ）

学習プロファイルを初期化しました。
AIは初期状態に戻りました。

引き続きご利用いただけます！`;

    await replyText(replyToken, message);
  } catch (err) {
    console.error('[DataReset] エラー:', err.message);
    await replyText(replyToken, `リセット中にエラーが発生しました: ${err.message}`);
  }
}
