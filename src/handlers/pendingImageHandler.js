import { replyText, getImageAsBase64 } from '../services/lineService.js';
import { askClaude } from '../services/claudeService.js';
import { getStore, savePostHistory, clearPendingImageContext } from '../services/supabaseService.js';
import { buildImagePostPrompt } from '../utils/promptBuilder.js';
import { saveEngagementMetrics } from '../services/collectiveIntelligence.js';

// pending_image_context の有効期限（30分）
const PENDING_EXPIRE_MS = 30 * 60 * 1000;

/**
 * pending_image_context が有効かどうか確認
 */
function isValidContext(ctx) {
  if (!ctx || !ctx.messageId || !ctx.imageDescription || !ctx.storeId) return false;
  const age = Date.now() - new Date(ctx.createdAt).getTime();
  return age < PENDING_EXPIRE_MS;
}

/**
 * 画像の「一言ヒント」返信を受け取り、投稿を生成する
 *
 * @param {object} user - ユーザーオブジェクト（pending_image_context を含む）
 * @param {string} text - ユーザーが送ったテキスト（ヒント or「スキップ」）
 * @param {string} replyToken
 * @returns {boolean} 処理したかどうか
 */
export async function handlePendingImageResponse(user, text, replyToken) {
  const ctx = user.pending_image_context;

  if (!isValidContext(ctx)) {
    // 期限切れ or 不正なコンテキスト → クリアして終了
    await clearPendingImageContext(user.id);
    return false;
  }

  // コンテキストをすぐにクリア（2重送信防止）
  await clearPendingImageContext(user.id);

  const isSkip = ['スキップ', 'skip', 'Skip', 'SKIP', 'なし', 'なし。'].includes(text.trim());
  const hint = isSkip ? null : text.trim();

  console.log(`[PendingImage] ヒント受信: store=${ctx.storeId} hint="${hint ?? 'スキップ'}"`);

  try {
    const store = await getStore(ctx.storeId);
    if (!store) {
      return await replyText(replyToken, '店舗情報が見つかりません。店舗一覧 で確認してください。');
    }

    // 画像を再取得
    const imageBase64 = await getImageAsBase64(ctx.messageId);

    // ヒントがある場合は imageDescription に追記してプロンプトに反映
    const enrichedDescription = hint
      ? `${ctx.imageDescription}\n\n【店主からの補足情報】${hint}`
      : ctx.imageDescription;

    // 機材レベルを再判定
    const equipmentLevel = ctx.imageDescription?.toLowerCase().includes('signature')
      ? 'signature'
      : 'snapshot';

    const prompt = buildImagePostPrompt(
      store,
      ctx.learningData ?? {},
      null,
      ctx.blendedInsights ?? null,
      ctx.personalization ?? '',
      enrichedDescription,
      equipmentLevel,
    );

    const rawContent = await askClaude(prompt);
    const savedPost = await savePostHistory(user.id, store.id, rawContent);

    if (store.category) {
      try {
        await saveEngagementMetrics(store.id, store.category, {
          post_id: savedPost.id,
          content: rawContent,
        });
      } catch (metricsErr) {
        console.error('[PendingImage] メトリクス初期保存エラー（投稿は成功）:', metricsErr.message);
      }
    }

    console.log(`[PendingImage] 投稿生成完了: store=${store.name}`);

    const formattedReply = `✨ 3つの投稿案ができました！
━━━━━━━━━━━
${rawContent}
━━━━━━━━━━━

どの案が理想に近いですか？
A / B / C と送ってください✉️
修正したい場合は「直し: 〜」でどうぞ

※ 選択するたびにあなたの好みを学習します📚`;

    await replyText(replyToken, formattedReply);
    return true;
  } catch (err) {
    console.error('[PendingImage] 投稿生成エラー:', err);
    await replyText(replyToken, '投稿生成中にエラーが発生しました。もう一度画像を送ってください。');
    return true;
  }
}
