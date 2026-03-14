import { replyText, replyWithQuickReply } from '../services/lineService.js';
import { getStore, getLatestPost, updatePostStatus } from '../services/supabaseService.js';
import {
  connectInstagramAccount,
  getInstagramConnectionStatus,
  syncInstagramPosts,
  getInstagramStats,
  getInstagramAccount,
  publishToInstagram,
  publishCarouselToInstagram,
  buildInstagramAuthUrl,
} from '../services/instagramService.js';
import { supabase, savePendingImageContext, clearPendingImageContext } from '../services/supabaseService.js';

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
・インスタ連携 → Instagram連携
・インスタ解除 → Instagram連携解除`);
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
    } catch (err) {
      console.error('[Instagram] OAuth URL生成エラー:', err.message);
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

    // 同期後に統計も自動表示
    const stats = await getInstagramStats(user.current_store_id);

    let statsText = '';
    if (stats) {
      const hashtagSection = stats.topHashtags.length > 0
        ? `\n\n【高ERハッシュタグ】\n${stats.topHashtags.join(', ')}`
        : '';
      const topPostPreview = stats.topPost
        ? `\n\n【最高ER投稿】\n"${(stats.topPost.caption || '').slice(0, 60)}${(stats.topPost.caption || '').length > 60 ? '...' : ''}"\nER: ${stats.topPost.engagement_rate}%`
        : '';
      statsText = `\n\n📊 統計（直近${stats.totalPosts}件）\n平均いいね: ${stats.avgLikes}\n平均リーチ: ${stats.avgReach.toLocaleString()}\n平均ER: ${stats.avgER}%${hashtagSection}${topPostPreview}`;
    }

    await replyText(replyToken, `✅ 同期完了！\n\n新規取得: ${synced}件${statsText}`);
  } catch (err) {
    console.error('[Instagram] 同期エラー:', err);
    await replyText(replyToken, '❌ 同期に失敗しました。トークンの有効期限を確認してください。');
  }
  return true;
}

async function handleInstagramStats(user, replyToken) {
  try {
    let stats = await getInstagramStats(user.current_store_id);

    // データがなければ自動syncを試行
    if (!stats) {
      try {
        await syncInstagramPosts(user.current_store_id, 25);
        stats = await getInstagramStats(user.current_store_id);
      } catch (syncErr) {
        console.error('[Instagram] stats自動同期失敗:', syncErr.message);
      }
    }

    if (!stats) {
      await replyText(replyToken, '📊 まだデータがありません。Instagram連携を確認してください。');
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

    // 投稿済みステータスに更新
    await updatePostStatus(latestPost.id, 'posted').catch(err => {
      console.warn('[Instagram] post_status更新失敗（続行）:', err.message);
    });

    await replyText(replyToken, `✅ Instagramに投稿しました！\n\n📱 投稿ID: ${result.id}\n\nInstagramアプリで確認してみてください。`);
  } catch (err) {
    console.error('[Instagram] 投稿エラー:', err);
    await replyText(replyToken, '❌ Instagram投稿に失敗しました。しばらくしてから再度お試しください。');
  }
  return true;
}

/**
 * カルーセル投稿モードを開始
 * 元画像をimagesに入れてpending_image_contextを設定
 */
export async function handleCarouselStart(user, replyToken) {
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

    // カルーセルモードを開始
    await savePendingImageContext(user.id, {
      carousel_mode: true,
      images: [latestPost.image_url],
      storeId: store.id,
      postId: latestPost.id,
      createdAt: new Date().toISOString(),
    });

    await replyWithQuickReply(
      replyToken,
      `📸 複数枚投稿モード\n\n1枚目（元の画像）は追加済みです。\n追加の画像を送ってください（最大10枚）\n\n全部送ったら「完了」を押してください。`,
      [
        { type: 'action', action: { type: 'message', label: '✅ 完了', text: '完了' } },
        { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' } },
      ]
    );
  } catch (err) {
    console.error('[Instagram] カルーセル開始エラー:', err);
    await replyText(replyToken, '❌ エラーが発生しました。しばらくしてから再度お試しください。');
  }
  return true;
}

/**
 * カルーセルモード中のテキスト応答処理
 * 「完了」→ 投稿 / その他 → 画像を送るよう促す
 */
export async function handleCarouselTextResponse(user, trimmed, replyToken) {
  const ctx = user.pending_image_context;

  if (trimmed === '完了') {
    return await handleCarouselComplete(user, replyToken);
  }

  // その他のテキスト → 画像を送るよう促す
  await replyWithQuickReply(
    replyToken,
    `画像を送るか「完了」を押してください。\n現在 ${ctx.images.length}枚`,
    [
      { type: 'action', action: { type: 'message', label: '✅ 完了', text: '完了' } },
      { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' } },
    ]
  );
  return true;
}

/**
 * カルーセル投稿を実行
 */
async function handleCarouselComplete(user, replyToken) {
  const ctx = user.pending_image_context;

  if (!ctx || !ctx.images || ctx.images.length < 2) {
    await replyText(replyToken, 'カルーセル投稿には2枚以上の画像が必要です。画像を追加してください。');
    return true;
  }

  try {
    const store = await getStore(ctx.storeId);
    if (!store) {
      await clearPendingImageContext(user.id);
      await replyText(replyToken, '店舗が見つかりません。');
      return true;
    }

    // direct_modeの場合はctxからキャプション取得、通常はlatestPostから
    let caption;
    if (ctx.direct_mode && ctx.direct_caption) {
      caption = ctx.direct_caption;
    } else {
      const latestPost = await getLatestPost(store.id);
      if (!latestPost) {
        await clearPendingImageContext(user.id);
        await replyText(replyToken, '投稿が見つかりません。');
        return true;
      }
      // 撮影アドバイス（━━━ 区切り以降）を除外して本文のみ投稿
      caption = latestPost.content.split(/\n━{3,}/)[0].trim();
    }

    // direct_modeの場合はpost_historyに保存
    if (ctx.direct_mode) {
      const { savePostHistory } = await import('../services/supabaseService.js');
      await savePostHistory(user.id, store.id, caption, null, ctx.images[0]);
    }

    // pending_image_context をクリア（投稿前にクリア）
    await clearPendingImageContext(user.id);

    const result = await publishCarouselToInstagram(store.id, ctx.images, caption);

    await replyText(replyToken, `✅ Instagramにカルーセル投稿しました！（${ctx.images.length}枚）\n\n📱 投稿ID: ${result.id}\n\nInstagramアプリで確認してみてください。`);
  } catch (err) {
    console.error('[Instagram] カルーセル投稿エラー:', err);
    await clearPendingImageContext(user.id);
    await replyText(replyToken, '❌ カルーセル投稿に失敗しました。しばらくしてから再度お試しください。');
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
