import { replyText } from '../services/lineService.js';
import { clearPendingImageContext } from '../services/supabaseService.js';

// pending_image_context の有効期限（30分）
const PENDING_EXPIRE_MS = 30 * 60 * 1000;

/**
 * pending_image_context が有効かどうか確認
 * analysisStatus: 'pending' | 'generating' | 'complete' | 'error' を考慮
 */
function isValidContext(ctx) {
  if (!ctx || !ctx.messageId || !ctx.storeId) return false;
  const age = Date.now() - new Date(ctx.createdAt).getTime();
  if (age >= PENDING_EXPIRE_MS) return false;
  // 新フォーマット: analysisStatus があれば有効（pending/generating/complete/error）
  if (ctx.analysisStatus) return true;
  // 旧フォーマット: imageDescription があれば有効
  return !!ctx.imageDescription;
}

/**
 * バックグラウンド処理中にユーザーがテキストを送った場合の対応
 * 投稿生成はimageHandler.jsのバックグラウンド処理で完結するため、
 * ここではステータスに応じた待機メッセージを返すのみ
 *
 * @param {object} user - ユーザーオブジェクト（pending_image_context を含む）
 * @param {string} text - ユーザーが送ったテキスト
 * @param {string} replyToken
 * @returns {boolean} 処理したかどうか
 */
export async function handlePendingImageResponse(user, text, replyToken) {
  const ctx = user.pending_image_context;

  if (!isValidContext(ctx)) {
    // 期限切れ or 不正なコンテキスト → クリアしてユーザーに通知
    await clearPendingImageContext(user.id);
    await replyText(replyToken, 'ちょっと時間が空いちゃったので、もう一度画像を送ってもらえますか？');
    return true;
  }

  // ── バックグラウンドで分析+生成中 → ユーザーに待ってもらう ──
  if (ctx.analysisStatus === 'pending' || ctx.analysisStatus === 'generating') {
    console.log(`[PendingImage] バックグラウンド処理中 (${ctx.analysisStatus}) → 待機メッセージ返信`);
    await replyText(replyToken, 'まだ投稿を考えている途中です、もう少しだけお待ちくださいね！');
    return true;
  }

  // analysisStatus === 'error' のケース
  if (ctx.analysisStatus === 'error' || !ctx.imageDescription) {
    await clearPendingImageContext(user.id);
    await replyText(replyToken, '画像がうまく読み取れませんでした。もう一度画像を送ってみてください');
    return true;
  }

  // analysisStatus === 'complete' のケース（旧フロー互換 — 通常はここに来ない）
  await clearPendingImageContext(user.id);
  await replyText(replyToken, '投稿案の準備中です。まもなくお届けしますね！');
  return true;
}
