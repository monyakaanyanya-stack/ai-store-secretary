import { replyText, replyWithQuickReply } from '../services/lineService.js';
import { askClaude } from '../services/claudeService.js';
import { getStore, savePostHistory, clearPendingImageContext } from '../services/supabaseService.js';
import { supabase } from '../services/supabaseService.js';
import { buildImagePostPrompt } from '../utils/promptBuilder.js';
import { saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { getRevisionExample } from '../utils/categoryExamples.js';
import { checkGenerationLimit, isFeatureEnabled } from '../services/subscriptionService.js';
import { isDevTestStore } from './adminHandler.js';

// pending_image_context の有効期限（30分）
const PENDING_EXPIRE_MS = 30 * 60 * 1000;

// 分析完了待機の設定
const ANALYSIS_POLL_INTERVAL_MS = 500;
const ANALYSIS_POLL_MAX_ATTEMPTS = 20; // 500ms × 20 = 最大10秒

/**
 * pending_image_context が有効かどうか確認
 * analysisStatus: 'pending' | 'complete' | 'error' を考慮
 */
function isValidContext(ctx) {
  if (!ctx || !ctx.messageId || !ctx.storeId) return false;
  const age = Date.now() - new Date(ctx.createdAt).getTime();
  if (age >= PENDING_EXPIRE_MS) return false;
  // 新フォーマット: analysisStatus があれば有効（pending/complete/error）
  if (ctx.analysisStatus) return true;
  // 旧フォーマット: imageDescription があれば有効
  return !!ctx.imageDescription;
}

/**
 * バックグラウンド分析の完了を待機
 * @returns {Object|null} 完了した context、またはエラー/タイムアウト時は null
 */
async function waitForAnalysis(userId) {
  for (let i = 0; i < ANALYSIS_POLL_MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, ANALYSIS_POLL_INTERVAL_MS));

    const { data: freshUser } = await supabase
      .from('users')
      .select('pending_image_context')
      .eq('id', userId)
      .single();

    const ctx = freshUser?.pending_image_context;
    if (!ctx) return null;

    if (ctx.analysisStatus === 'complete') return ctx;
    if (ctx.analysisStatus === 'error') return null;
    // まだ 'pending' → 次のループ
  }
  return null; // タイムアウト
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
  let ctx = user.pending_image_context;

  if (!isValidContext(ctx)) {
    // 期限切れ or 不正なコンテキスト → クリアしてユーザーに通知
    await clearPendingImageContext(user.id);
    await replyText(replyToken, 'ちょっと時間が空いちゃったので、もう一度画像を送ってもらえますか？');
    return true;
  }

  // ── バックグラウンド分析の完了待機 ──
  if (ctx.analysisStatus === 'pending') {
    console.log('[PendingImage] バックグラウンド分析待機中...');
    const completedCtx = await waitForAnalysis(user.id);

    if (!completedCtx) {
      // タイムアウト or エラー
      await clearPendingImageContext(user.id);
      await replyText(replyToken, '画像の分析に時間がかかっています。もう一度画像を送ってみてください。');
      return true;
    }
    ctx = completedCtx;
    console.log('[PendingImage] バックグラウンド分析完了を確認');
  }

  // analysisStatus === 'error' のケース
  if (ctx.analysisStatus === 'error' || !ctx.imageDescription) {
    await clearPendingImageContext(user.id);
    await replyText(replyToken, '画像がうまく読み取れませんでした。もう一度画像を送ってみてください');
    return true;
  }

  // コンテキストをすぐにクリア（2重送信防止）
  await clearPendingImageContext(user.id);

  // ──────────────────────────────────────────────
  // 生成回数チェック（実際の生成直前にも確認）
  // ──────────────────────────────────────────────
  const genLimit = await checkGenerationLimit(user.id);
  if (!genLimit.allowed) {
    await replyText(replyToken,
      `⚠️ 今月の生成上限（${genLimit.limit}回）に達しました。\n\n現在: ${genLimit.used}回 / ${genLimit.limit}回\n\n「アップグレード」で上限を増やすことができます。\n\n次月（1日）にリセットされます。`
    );
    return true;
  }

  const isSkip = ['スキップ', 'skip', 'Skip', 'SKIP', 'なし', 'なし。'].includes(text.trim());
  const hint = isSkip ? null : text.trim();

  console.log(`[PendingImage] ヒント受信: store=${ctx.storeId} hint="${hint ?? 'スキップ'}"`);

  try {
    const store = await getStore(ctx.storeId);
    if (!store) {
      return await replyText(replyToken, '店舗が見つかりません。「店舗一覧」で確認してみてください');
    }

    // ※ 画像は初回送信時に Claude Vision で分析済み（ctx.imageDescription に保存）
    //    再取得は不要。LINE のメッセージサーバーから画像が削除されても問題なし。

    const isPremium = await isFeatureEnabled(user.id, 'enhancedPhotoAdvice');

    // 開発者テスト店舗: 検出カテゴリーで store を一時的にオーバーライド
    const storeForPrompt = isDevTestStore(store) && ctx.effectiveCategory
      ? { ...store, category: ctx.effectiveCategory }
      : store;

    const prompt = buildImagePostPrompt(
      storeForPrompt,
      null,
      ctx.blendedInsights ?? null,
      ctx.personalization ?? '',
      ctx.imageDescription,
      { isPremium, hint },
    );

    const rawContent = await askClaude(prompt);
    const savedPost = await savePostHistory(user.id, store.id, rawContent, null, ctx.imageUrl || null);

    // 開発者テスト店舗は集合知に保存しない
    if (store.category && !isDevTestStore(store)) {
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
    const learningNote = ctx.hasLearning ? '\n🧠 これまでの学習を反映しています' : '';
    // 残り回数通知（残り3回以下の時のみ表示）
    const remaining = Number.isFinite(genLimit.limit) ? genLimit.limit - (genLimit.used + 1) : null;
    const remainingNote = remaining !== null && remaining <= 3 ? `\n📊 今月の残り: ${remaining}回` : '';
    const formattedReply = `3つの投稿案ができました！どの案が理想に近いですか？👇${learningNote}
━━━━━━━━━━━
${rawContent}
━━━━━━━━━━━

A・B・C を選んだあと「直し: ${revisionExample}」で微調整もできます${remainingNote}`;

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
    await replyText(replyToken, 'うまくいきませんでした...もう一度画像を送ってみてください');
    return true;
  }
}
