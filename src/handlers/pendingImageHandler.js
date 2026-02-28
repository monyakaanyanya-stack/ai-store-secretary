import { replyText, replyWithQuickReply, getImageAsBase64 } from '../services/lineService.js';
import { askClaude } from '../services/claudeService.js';
import { getStore, savePostHistory, clearPendingImageContext } from '../services/supabaseService.js';
import { buildImagePostPrompt } from '../utils/promptBuilder.js';
import { saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { getRevisionExample } from '../utils/categoryExamples.js';

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
    // 期限切れ or 不正なコンテキスト → クリアしてユーザーに通知
    await clearPendingImageContext(user.id);
    await replyText(replyToken, '⏰ 画像の待ち時間が切れました（30分）。\nもう一度画像を送り直してください📸');
    return true;
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
    // ヒントは想起トリガー・来店トリガーどちらにも自然に反映してよい
    const enrichedDescription = hint
      ? `${ctx.imageDescription}\n\n【店主からの補足情報（想起・来店どちらのトリガーにも自然に反映してよい）】${hint}`
      : ctx.imageDescription;

    const prompt = buildImagePostPrompt(
      store,
      null,
      ctx.blendedInsights ?? null,
      ctx.personalization ?? '',
      enrichedDescription,
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

    const revisionExample = getRevisionExample(store.category);
    const formattedReply = `✨ 3つの投稿案ができました！
━━━━━━━━━━━
${rawContent}
━━━━━━━━━━━

どの案が理想に近いですか？👇

【学習させる方法】
✏️ 直し: ${revisionExample}　→ 指示で修正＋学習
📝 学習: [自分で書いた文章]　→ 見本を送って直接学習

※ 選択・修正・見本のたびに好みを学習します📚`;

    await replyWithQuickReply(replyToken, formattedReply, [
      { type: 'action', action: { type: 'message', label: '✅ A案', text: 'A' } },
      { type: 'action', action: { type: 'message', label: '✅ B案', text: 'B' } },
      { type: 'action', action: { type: 'message', label: '✅ C案', text: 'C' } },
      { type: 'action', action: { type: 'message', label: '✏️ 直し', text: '直し:' } },
      { type: 'action', action: { type: 'message', label: '📝 学習', text: '学習:' } },
    ]);
    return true;
  } catch (err) {
    console.error('[PendingImage] 投稿生成エラー:', err);
    await replyText(replyToken, '投稿生成中にエラーが発生しました。もう一度画像を送ってください。');
    return true;
  }
}
