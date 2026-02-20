import { replyText } from '../services/lineService.js';
import { getStore } from '../services/supabaseService.js';
import {
  connectInstagramAccount,
  getInstagramConnectionStatus,
  syncInstagramPosts,
  getInstagramStats,
  getInstagramAccount,
} from '../services/instagramService.js';
import { supabase } from '../services/supabaseService.js';

/**
 * Instagram コマンドの振り分け
 * コマンド例:
 *   /instagram           → 連携状態の確認
 *   /instagram connect [トークン] → 連携
 *   /instagram sync      → データ同期
 *   /instagram stats     → 統計表示
 *   /instagram disconnect → 連携解除
 */
export async function handleInstagramCommand(user, args, replyToken) {
  if (!user.current_store_id) {
    await replyText(replyToken, '店舗が選択されていません。先に店舗を登録してください。');
    return true;
  }

  const [subCommand, ...rest] = args.trim().split(/\s+/);

  if (!subCommand || subCommand === 'status') {
    return await handleInstagramStatus(user, replyToken);
  }

  if (subCommand === 'connect') {
    const token = rest.join('');
    return await handleInstagramConnect(user, token, replyToken);
  }

  if (subCommand === 'sync') {
    return await handleInstagramSync(user, replyToken);
  }

  if (subCommand === 'stats') {
    return await handleInstagramStats(user, replyToken);
  }

  if (subCommand === 'disconnect') {
    return await handleInstagramDisconnect(user, replyToken);
  }

  await replyText(replyToken, `❓ コマンドが見つかりません。

使い方:
/instagram → 連携状態確認
/instagram connect [トークン] → 連携
/instagram sync → データ同期
/instagram stats → 統計表示
/instagram disconnect → 連携解除`);
  return true;
}

async function handleInstagramStatus(user, replyToken) {
  try {
    const status = await getInstagramConnectionStatus(user.current_store_id);
    await replyText(replyToken, status);
  } catch (err) {
    console.error('[Instagram] 状態確認エラー:', err);
    await replyText(replyToken, '❌ エラーが発生しました。しばらくしてから再度お試しください。');
  }
  return true;
}

async function handleInstagramConnect(user, token, replyToken) {
  if (!token) {
    await replyText(replyToken, `📸 Instagram連携

アクセストークンを指定してください:

/instagram connect [アクセストークン]

【トークンの取得方法】
1. Meta for Developers (developers.facebook.com) でアカウント作成
2. 新しいアプリを作成（アプリタイプ: ビジネス）
3. Instagram Graph API を追加
4. アクセストークンを生成

詳細は開発者ガイドをご参照ください。`);
    return true;
  }

  try {
    await replyText(replyToken, '⏳ Instagram連携中...\n\nアカウント情報を確認しています。');

    const { account, accountInfo } = await connectInstagramAccount(user.current_store_id, token);

    await replyText(replyToken, `✅ Instagram連携完了！

@${accountInfo.username || account.instagram_user_id}
フォロワー: ${accountInfo.followers_count?.toLocaleString() || '取得中'}人

データを同期するには:
/instagram sync

と送信してください。`);
  } catch (err) {
    console.error('[Instagram] 連携エラー:', err);
    await replyText(replyToken, '❌ 連携に失敗しました。トークンが正しいか確認してください。');
  }
  return true;
}

async function handleInstagramSync(user, replyToken) {
  try {
    await replyText(replyToken, '⏳ Instagram データを同期中...\n\n少々お待ちください。');

    const synced = await syncInstagramPosts(user.current_store_id, 25);

    await replyText(replyToken, `✅ 同期完了！\n\n新規取得: ${synced}件\n\n統計を確認するには:\n/instagram stats`);
  } catch (err) {
    console.error('[Instagram] 同期エラー:', err);
    await replyText(replyToken, '❌ 同期に失敗しました。トークンの有効期限を確認してください。');
  }
  return true;
}

async function handleInstagramStats(user, replyToken) {
  try {
    const stats = await getInstagramStats(user.current_store_id);

    if (!stats) {
      await replyText(replyToken, '📊 まだデータがありません。\n\n/instagram sync でデータを取得してください。');
      return true;
    }

    const topPostPreview = stats.topPost
      ? `\n\n【最高ER投稿】\n"${(stats.topPost.caption || '').slice(0, 60)}${(stats.topPost.caption || '').length > 60 ? '...' : ''}"\nER: ${stats.topPost.engagement_rate}%`
      : '';

    const hashtagSection = stats.topHashtags.length > 0
      ? `\n\n【高ERハッシュタグ】\n${stats.topHashtags.join(', ')}`
      : '';

    await replyText(replyToken, `📊 Instagram統計（直近${stats.totalPosts}件）

平均いいね: ${stats.avgLikes}
平均リーチ: ${stats.avgReach.toLocaleString()}
平均ER: ${stats.avgER}%${hashtagSection}${topPostPreview}`);
  } catch (err) {
    console.error('[Instagram] 統計エラー:', err);
    await replyText(replyToken, '❌ 統計の取得に失敗しました。しばらくしてから再度お試しください。');
  }
  return true;
}

async function handleInstagramDisconnect(user, replyToken) {
  try {
    const account = await getInstagramAccount(user.current_store_id);

    if (!account) {
      await replyText(replyToken, 'Instagram は連携されていません。');
      return true;
    }

    await supabase
      .from('instagram_accounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('store_id', user.current_store_id);

    await replyText(replyToken, '✅ Instagram連携を解除しました。\n\n再連携する場合は:\n/instagram connect [トークン]');
  } catch (err) {
    console.error('[Instagram] 解除エラー:', err);
    await replyText(replyToken, '❌ 解除に失敗しました。しばらくしてから再度お試しください。');
  }
  return true;
}
