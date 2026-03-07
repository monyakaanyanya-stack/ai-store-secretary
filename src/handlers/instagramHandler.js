import { replyText } from '../services/lineService.js';
import { getStore, getLatestPost } from '../services/supabaseService.js';
import {
  connectInstagramAccount,
  getInstagramConnectionStatus,
  syncInstagramPosts,
  getInstagramStats,
  getInstagramAccount,
  publishToInstagram,
  buildInstagramAuthUrl,
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
    // rest[0] = token, rest[1] = optional pageId
    const token = rest[0] || '';
    const pageId = rest[1] || null;
    return await handleInstagramConnect(user, token, pageId, replyToken);
  }

  if (subCommand === 'sync') {
    return await handleInstagramSync(user, replyToken);
  }

  if (subCommand === 'stats') {
    return await handleInstagramStats(user, replyToken);
  }

  if (subCommand === 'post') {
    return await handleInstagramPublish(user, replyToken);
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
/instagram post → 最新投稿をInstagramに投稿
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

async function handleInstagramConnect(user, token, pageId, replyToken) {
  if (!token) {
    // OAuth フロー: 認証URLを生成して返す
    try {
      const authUrl = buildInstagramAuthUrl(user.line_user_id, user.current_store_id);
      await replyText(replyToken, `📸 Instagram連携\n\n下のリンクをタップして、Instagramアカウントを認証してください:\n\n${authUrl}\n\n⏱ リンクは10分間有効です。`);
    } catch {
      // INSTAGRAM_REDIRECT_URI 未設定時は手動フローにフォールバック
      await replyText(replyToken, `📸 Instagram連携\n\nアクセストークンを指定してください:\n\n/instagram connect [アクセストークン]`);
    }
    return true;
  }

  try {
    // H1修正: replyTokenは1回しか使えないため、中間メッセージを削除し結果のみ返す
    const { account, accountInfo } = await connectInstagramAccount(user.current_store_id, token, pageId);

    await replyText(replyToken, `✅ Instagram連携完了！

@${accountInfo.username || account.instagram_user_id}
フォロワー: ${accountInfo.followers_count?.toLocaleString() || '取得中'}人

⚠️ セキュリティのため、先ほど送ったトークンを含むメッセージをチャット履歴から削除してください。

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
    // H1修正: replyTokenは1回しか使えないため、中間メッセージを削除し結果のみ返す
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

async function handleInstagramPublish(user, replyToken) {
  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      await replyText(replyToken, '店舗が見つかりません。');
      return true;
    }

    const latestPost = await getLatestPost(store.id);

    if (!latestPost || !latestPost.image_url) {
      await replyText(replyToken, '投稿する画像がありません。先に画像を送って投稿を作成してください。');
      return true;
    }

    // 3案未選択チェック
    if (/\[\s*案A[：:]/.test(latestPost.content)) {
      await replyText(replyToken, '先にA / B / C を選択してから投稿してください。');
      return true;
    }

    // 撮影アドバイス（━━━ 区切り以降）を除外して本文のみ投稿
    const caption = latestPost.content.split(/\n━{3,}/)[0].trim();

    const result = await publishToInstagram(store.id, latestPost.image_url, caption);

    await replyText(replyToken, `✅ Instagramに投稿しました！\n\n📱 投稿ID: ${result.id}\n\nInstagramアプリで確認してみてください。`);
  } catch (err) {
    console.error('[Instagram] 投稿エラー:', err);
    await replyText(replyToken, '❌ Instagram投稿に失敗しました。しばらくしてから再度お試しください。');
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
