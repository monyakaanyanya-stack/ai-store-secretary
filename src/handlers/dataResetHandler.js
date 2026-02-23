import { replyText } from '../services/lineService.js';
import { supabase, getStore, getStoresByUser, deleteStore, updateCurrentStore } from '../services/supabaseService.js';
import { maskId } from '../utils/security.js';

/**
 * データリセット確認メッセージ
 */
export async function handleDataResetPrompt(user, replyToken) {
  console.log(`[DataReset] handleDataResetPrompt called`);

  if (!user.current_store_id) {
    console.warn(`[DataReset] 店舗未選択: user=${maskId(user.id)}`);
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  console.log(`[DataReset] 確認メッセージ送信開始: store=${maskId(user.current_store_id)}`);

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
    const { error: profileError } = await supabase
      .from('learning_profiles')
      .delete()
      .eq('store_id', storeId);
    if (profileError) {
      // サイレント継続せず例外として伝播させる
      throw new Error(`learning_profiles削除エラー: ${profileError.message}`);
    }

    console.log(`[DataReset] データリセット完了: store=${maskId(storeId)}, posts=${postCount}, learning=${learningCount}`);

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
    await replyText(replyToken, 'リセット中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}

/**
 * 店舗削除の確認メッセージ
 */
export async function handleStoreDeletePrompt(user, replyToken) {
  // 店舗一覧を取得
  const stores = await getStoresByUser(user.id);

  if (stores.length === 0) {
    return await replyText(replyToken, '削除できる店舗がありません。');
  }

  // 選択中の店舗がある場合はそれを削除対象に
  if (user.current_store_id) {
    const store = await getStore(user.current_store_id);
    if (store) {
      const message = `⚠️ 店舗削除の確認

「${store.name}」を削除します。

以下のデータがすべて削除されます：
━━━━━━━━━━━━━━━
🏪 店舗情報（業種・こだわり・口調）
📝 投稿履歴
🧠 学習データ・プロファイル
📊 フォロワー履歴
📸 Instagram連携情報
━━━━━━━━━━━━━━━

【残るデータ】
✅ 集合知データ（業種カテゴリー別の学習データ）
　→ 他の店舗・将来の登録でも活用されます

⚠️ この操作は元に戻せません

削除する場合: 「店舗削除実行」
キャンセル: 「キャンセル」`;
      return await replyText(replyToken, message);
    }
  }

  // 選択中の店舗がない場合は一覧を表示して切替を促す
  const list = stores.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
  return await replyText(replyToken, `店舗を選択してから削除してください。

登録済み店舗:
${list}

切替: 店舗名 → で選択してから
もう一度「店舗削除」と送信してください。`);
}

/**
 * 店舗削除の実行
 */
export async function handleStoreDeleteExecution(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '店舗が見つかりません。');
    }

    const storeName = store.name;
    const storeId = user.current_store_id;

    // 店舗削除（関連データも含む）
    await deleteStore(storeId);

    // 別の店舗に切り替え（削除した店舗を除外して残りを取得）
    const allStores = await getStoresByUser(user.id);
    const remaining = allStores.filter(s => s.id !== storeId);
    let switchMessage = '';
    if (remaining.length > 0) {
      await updateCurrentStore(user.id, remaining[0].id);
      switchMessage = `\n\n「${remaining[0].name}」に切り替えました。`;
    } else {
      await updateCurrentStore(user.id, null);
      switchMessage = '\n\n店舗がなくなりました。「登録」で新しく登録できます。';
    }

    await replyText(replyToken, `✅ 「${storeName}」を削除しました。${switchMessage}`);
  } catch (err) {
    console.error('[StoreDelete] エラー:', err.message);
    await replyText(replyToken, '削除中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}
