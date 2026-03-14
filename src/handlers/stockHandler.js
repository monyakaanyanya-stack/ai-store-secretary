/**
 * 投稿ストック + 予約投稿ハンドラー
 *
 * 機能:
 *   - ストック保存（A/B/C選択後に💾ボタンから）
 *   - ストック一覧表示（「ストック」コマンド）
 *   - ストックからInstagram即時投稿
 *   - ストック削除
 *   - 予約投稿（日時指定→cronで自動投稿）
 */
import { replyText, replyWithQuickReply, pushMessage } from '../services/lineService.js';
import {
  getStore,
  getLatestPost,
  updatePostStatus,
  getStockPosts,
  getStockPostById,
  deleteStockPost,
  getDueScheduledPosts,
  getStockCount,
  savePendingImageContext,
  clearPendingImageContext,
  setPendingCommand,
  supabase,
} from '../services/supabaseService.js';
import { getInstagramAccount, publishToInstagram } from '../services/instagramService.js';
import { isFeatureEnabled } from '../services/subscriptionService.js';

const MAX_STOCK = 10;

// ==================== JST ヘルパー ====================

function getNowJst() {
  const JST_OFFSET = 9 * 60 * 60 * 1000;
  return new Date(Date.now() + JST_OFFSET);
}

function formatJstDate(date) {
  const d = new Date(date);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const month = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const hours = String(jst.getUTCHours()).padStart(2, '0');
  const minutes = String(jst.getUTCMinutes()).padStart(2, '0');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[jst.getUTCDay()];
  return `${month}/${day}（${weekday}）${hours}:${minutes}`;
}

// ==================== ストック保存 ====================

/**
 * 最新投稿をストック（下書き）に保存
 */
export async function handleStockSave(user, replyToken) {
  try {
    if (!user.current_store_id) {
      return await replyText(replyToken, '店舗が選択されていません。先に店舗を登録してください。');
    }

    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '店舗が見つかりません。');
    }

    // ストック上限チェック
    const stockCount = await getStockCount(store.id);
    if (stockCount >= MAX_STOCK) {
      return await replyText(replyToken, `📦 ストックが上限（${MAX_STOCK}件）に達しています。\n\n古いストックを投稿または削除してから保存してください。\n「ストック」で一覧を確認できます。`);
    }

    const latestPost = await getLatestPost(store.id);
    if (!latestPost) {
      return await replyText(replyToken, '保存する投稿がありません。先に画像を送って投稿を作成してください。');
    }

    // 3案未選択チェック
    if (/\[\s*案A[：:]/.test(latestPost.content)) {
      return await replyText(replyToken, '先にA / B / C を選択してからストックしてください。');
    }

    await updatePostStatus(latestPost.id, 'draft');

    return await replyWithQuickReply(
      replyToken,
      `💾 ストックに保存しました！\n\n投稿したいときに「ストック」と送ってください。`,
      [
        { type: 'action', action: { type: 'message', label: '📦 ストック一覧', text: 'ストック' } },
      ]
    );
  } catch (err) {
    console.error('[Stock] ストック保存エラー:', err);
    return await replyText(replyToken, '❌ ストック保存に失敗しました。');
  }
}

// ==================== ストック一覧 ====================

/**
 * ストック一覧を表示
 */
export async function handleStockList(user, replyToken) {
  try {
    if (!user.current_store_id) {
      return await replyText(replyToken, '店舗が選択されていません。先に店舗を登録してください。');
    }

    const stocks = await getStockPosts(user.current_store_id);

    if (stocks.length === 0) {
      return await replyText(replyToken, '📦 ストックはまだありません。\n\n投稿を作成した後、「💾 ストック」ボタンで保存できます。');
    }

    // 一覧テキスト生成
    const lines = stocks.map((post, i) => {
      const preview = post.content.split(/\n/)[0].slice(0, 20) + (post.content.length > 20 ? '...' : '');
      const date = formatJstDate(post.created_at);
      const statusIcon = post.post_status === 'scheduled'
        ? `⏰ ${formatJstDate(post.scheduled_at)}`
        : '📝';
      return `${i + 1}. ${preview} (${date}) ${statusIcon}`;
    });

    const text = `📦 投稿ストック\n\n${lines.join('\n')}\n\n番号を選んでください👇`;

    // クイックリプライボタン（最大13個だが、ストック上限10なので問題なし）
    const quickReplies = stocks.map((_, i) => ({
      type: 'action',
      action: { type: 'message', label: `${i + 1}`, text: `ストック:${i + 1}` },
    }));

    return await replyWithQuickReply(replyToken, text, quickReplies);
  } catch (err) {
    console.error('[Stock] ストック一覧エラー:', err);
    return await replyText(replyToken, '❌ ストック一覧の取得に失敗しました。');
  }
}

// ==================== ストック選択→アクション表示 ====================

/**
 * ストック番号選択後、プレビュー + アクションボタンを表示
 */
export async function handleStockAction(user, stockIndex, replyToken) {
  try {
    const stocks = await getStockPosts(user.current_store_id);

    if (stockIndex < 1 || stockIndex > stocks.length) {
      return await replyText(replyToken, `1〜${stocks.length} の番号で選んでください。`);
    }

    const selectedPost = stocks[stockIndex - 1];

    // 選択した投稿IDをpending_image_contextに保存（次のアクションで使う）
    await savePendingImageContext(user.id, {
      stock_mode: true,
      stock_post_id: selectedPost.id,
      storeId: user.current_store_id,
    });

    // プレビュー（撮影アドバイス除外）
    const preview = selectedPost.content.split(/\n━{3,}/)[0].trim();
    const truncated = preview.length > 200 ? preview.slice(0, 200) + '...' : preview;

    const quickReplies = [
      { type: 'action', action: { type: 'message', label: '📸 今すぐ投稿', text: 'ストック投稿' } },
      { type: 'action', action: { type: 'message', label: '⏰ 予約投稿', text: 'ストック予約' } },
      { type: 'action', action: { type: 'message', label: '🗑 削除', text: 'ストック削除' } },
      { type: 'action', action: { type: 'message', label: '↩ 戻る', text: 'ストック' } },
    ];

    return await replyWithQuickReply(
      replyToken,
      `━━━━━━━━━━━\n${truncated}\n━━━━━━━━━━━`,
      quickReplies
    );
  } catch (err) {
    console.error('[Stock] ストックアクション表示エラー:', err);
    return await replyText(replyToken, '❌ エラーが発生しました。');
  }
}

// ==================== ストックからInstagram即時投稿 ====================

/**
 * 選択中のストックをInstagramに即時投稿
 */
export async function handleStockPublish(user, replyToken) {
  try {
    const ctx = user.pending_image_context;
    if (!ctx?.stock_mode || !ctx?.stock_post_id) {
      return await replyText(replyToken, '先に「ストック」から投稿を選んでください。');
    }

    const post = await getStockPostById(ctx.stock_post_id);
    if (!post) {
      await clearPendingImageContext(user.id);
      return await replyText(replyToken, 'この投稿は既に削除されています。');
    }

    if (!post.image_url) {
      await clearPendingImageContext(user.id);
      return await replyText(replyToken, 'この投稿には画像がないためInstagramに投稿できません。');
    }

    const igAccount = await getInstagramAccount(post.store_id).catch(() => null);
    if (!igAccount) {
      await clearPendingImageContext(user.id);
      return await replyText(replyToken, 'Instagram未連携です。先に「インスタ連携」で連携してください。');
    }

    // 撮影アドバイス除外
    const caption = post.content.split(/\n━{3,}/)[0].trim();

    const result = await publishToInstagram(post.store_id, post.image_url, caption);

    // ステータスを posted に更新
    await updatePostStatus(post.id, 'posted');
    await clearPendingImageContext(user.id);

    return await replyText(replyToken, `✅ ストックからInstagramに投稿しました！\n\n📱 投稿ID: ${result.id}\n\nInstagramアプリで確認してみてください。`);
  } catch (err) {
    console.error('[Stock] ストック投稿エラー:', err);
    await clearPendingImageContext(user.id).catch(() => {});
    return await replyText(replyToken, '❌ Instagram投稿に失敗しました。しばらくしてから再度お試しください。');
  }
}

// ==================== ストック削除 ====================

/**
 * 選択中のストックを削除
 */
export async function handleStockDelete(user, replyToken) {
  try {
    const ctx = user.pending_image_context;
    if (!ctx?.stock_mode || !ctx?.stock_post_id) {
      return await replyText(replyToken, '先に「ストック」から投稿を選んでください。');
    }

    await deleteStockPost(ctx.stock_post_id);
    await clearPendingImageContext(user.id);

    return await replyWithQuickReply(
      replyToken,
      '🗑 ストックから削除しました。',
      [
        { type: 'action', action: { type: 'message', label: '📦 ストック一覧', text: 'ストック' } },
      ]
    );
  } catch (err) {
    console.error('[Stock] ストック削除エラー:', err);
    return await replyText(replyToken, '❌ 削除に失敗しました。');
  }
}

// ==================== 予約投稿: 時間選択 ====================

/**
 * 予約投稿の時間選択画面を表示
 */
export async function handleSchedulePrompt(user, replyToken) {
  try {
    const ctx = user.pending_image_context;
    if (!ctx?.stock_mode || !ctx?.stock_post_id) {
      return await replyText(replyToken, '先に「ストック」から投稿を選んでください。');
    }

    // 予約投稿機能の権限チェック（Light+）
    const canSchedule = await isFeatureEnabled(user.current_store_id, 'scheduledPost');
    if (!canSchedule) {
      return await replyText(replyToken, '⏰ 予約投稿はライトプラン以上で利用できます。\n\n「アップグレード」でプラン変更できます。');
    }

    const post = await getStockPostById(ctx.stock_post_id);
    if (!post) {
      await clearPendingImageContext(user.id);
      return await replyText(replyToken, 'この投稿は既に削除されています。');
    }

    // Instagram連携チェック
    const igAccount = await getInstagramAccount(post.store_id).catch(() => null);
    if (!igAccount) {
      return await replyText(replyToken, 'Instagram未連携です。先に「インスタ連携」で連携してください。');
    }

    // 時間候補を生成（JST）
    const now = getNowJst();
    const options = generateTimeOptions(now);

    const quickReplies = options.map(opt => ({
      type: 'action',
      action: { type: 'message', label: opt.label, text: `予約:${opt.iso}` },
    }));

    return await replyWithQuickReply(
      replyToken,
      '⏰ いつ投稿しますか？',
      quickReplies
    );
  } catch (err) {
    console.error('[Stock] 予約投稿プロンプトエラー:', err);
    return await replyText(replyToken, '❌ エラーが発生しました。');
  }
}

/**
 * 時間候補を生成（今日/明日の定番時間帯）
 */
function generateTimeOptions(nowJst) {
  const options = [];
  const todayBase = new Date(Date.UTC(
    nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate()
  ));

  // 今日の候補: 12:00, 18:00, 21:00（まだ過ぎていない時間のみ）
  const todayHours = [12, 18, 21];
  for (const h of todayHours) {
    const candidate = new Date(todayBase.getTime() + h * 60 * 60 * 1000);
    // JSTで候補を作ったが、ISO変換時はUTCに戻す（JST = UTC+9）
    const utcTime = new Date(candidate.getTime() - 9 * 60 * 60 * 1000);
    if (utcTime.getTime() > Date.now() + 10 * 60 * 1000) { // 10分後以降
      options.push({
        label: `今日${h}:00`,
        iso: utcTime.toISOString(),
      });
    }
  }

  // 明日の候補: 12:00, 18:00
  const tomorrowBase = new Date(todayBase.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowHours = [12, 18];
  for (const h of tomorrowHours) {
    const candidate = new Date(tomorrowBase.getTime() + h * 60 * 60 * 1000);
    const utcTime = new Date(candidate.getTime() - 9 * 60 * 60 * 1000);
    options.push({
      label: `明日${h}:00`,
      iso: utcTime.toISOString(),
    });
  }

  // 最低2つは表示
  return options.slice(0, 4);
}

// ==================== 予約投稿: 確定 ====================

/**
 * 予約時間を確定してスケジュール設定
 */
export async function handleScheduleConfirm(user, timeStr, replyToken) {
  try {
    const ctx = user.pending_image_context;
    if (!ctx?.stock_mode || !ctx?.stock_post_id) {
      return await replyText(replyToken, '先に「ストック」から投稿を選んでください。');
    }

    const post = await getStockPostById(ctx.stock_post_id);
    if (!post) {
      await clearPendingImageContext(user.id);
      return await replyText(replyToken, 'この投稿は既に削除されています。');
    }

    // ISO文字列をパース
    const scheduledAt = new Date(timeStr);
    if (isNaN(scheduledAt.getTime())) {
      return await replyText(replyToken, '⚠️ 日時の形式が正しくありません。ボタンから選んでください。');
    }

    // 過去の日時チェック
    if (scheduledAt.getTime() <= Date.now()) {
      return await replyText(replyToken, '⚠️ 過去の時間は指定できません。');
    }

    // ステータスを scheduled に更新
    await updatePostStatus(post.id, 'scheduled', scheduledAt.toISOString());
    await clearPendingImageContext(user.id);

    const displayTime = formatJstDate(scheduledAt);

    return await replyWithQuickReply(
      replyToken,
      `⏰ 予約しました！\n\n${displayTime} に自動投稿します。\n変更は「ストック」から確認できます。`,
      [
        { type: 'action', action: { type: 'message', label: '📦 ストック一覧', text: 'ストック' } },
      ]
    );
  } catch (err) {
    console.error('[Stock] 予約確定エラー:', err);
    return await replyText(replyToken, '❌ 予約設定に失敗しました。');
  }
}

// ==================== 予約投稿: cron処理 ====================

/**
 * 予約投稿の期限チェック＆自動投稿（10分ごとのcronから呼ばれる）
 */
export async function processScheduledPosts() {
  const duePosts = await getDueScheduledPosts();

  if (duePosts.length === 0) return;

  console.log(`[ScheduledPost] ${duePosts.length}件の予約投稿を処理`);

  for (const post of duePosts) {
    try {
      // Instagram連携チェック
      const igAccount = await getInstagramAccount(post.store_id).catch(() => null);
      if (!igAccount) {
        console.warn(`[ScheduledPost] store=${post.store_id} Instagram未連携 → draftに戻す`);
        await updatePostStatus(post.id, 'draft');
        await notifyUser(post.store_id, '⚠️ 予約投稿に失敗しました（Instagram未連携）。\nストックに戻しました。');
        continue;
      }

      // 画像チェック
      if (!post.image_url) {
        console.warn(`[ScheduledPost] postId=${post.id} 画像なし → draftに戻す`);
        await updatePostStatus(post.id, 'draft');
        await notifyUser(post.store_id, '⚠️ 予約投稿に失敗しました（画像がありません）。\nストックに戻しました。');
        continue;
      }

      // 撮影アドバイス除外してキャプション取得
      const caption = post.content.split(/\n━{3,}/)[0].trim();

      // Instagram投稿
      const result = await publishToInstagram(post.store_id, post.image_url, caption);

      // ステータスを posted に更新
      await updatePostStatus(post.id, 'posted');

      // ユーザーに通知
      await notifyUser(post.store_id, `✅ 予約投稿が完了しました！\n\n📱 投稿ID: ${result.id}\nInstagramアプリで確認してみてください。`);

      console.log(`[ScheduledPost] 投稿成功: postId=${post.id}, igId=${result.id}`);
    } catch (err) {
      console.error(`[ScheduledPost] 投稿失敗: postId=${post.id}`, err);
      // 失敗時はdraftに戻す（リトライループなし）
      await updatePostStatus(post.id, 'draft').catch(() => {});
      await notifyUser(post.store_id, `⚠️ 予約投稿に失敗しました。\nストックに戻しました。\n\nエラー: ${err.message?.slice(0, 50) || '不明'}`).catch(() => {});
    }
  }
}

/**
 * 店舗のオーナーにLINE pushメッセージを送信
 */
async function notifyUser(storeId, message) {
  try {
    const { data: store } = await supabase
      .from('stores')
      .select('user_id')
      .eq('id', storeId)
      .single();

    if (!store) return;

    const { data: user } = await supabase
      .from('users')
      .select('line_user_id')
      .eq('id', store.user_id)
      .single();

    if (!user?.line_user_id) return;

    await pushMessage(user.line_user_id, message);
  } catch (err) {
    console.error('[ScheduledPost] 通知送信エラー:', err.message);
  }
}
