/**
 * サブスクリプション関連 LINE ハンドラー
 *
 * 有効化手順: SUBSCRIPTION_HOWTO.md を参照
 * 組み込み方法: textHandler.js の振り分けに以下を追加するだけ
 *
 *   import { handlePlanStatus, handleUpgradePrompt } from './subscriptionHandler.js';
 *
 *   // テキスト振り分けの早い段階に追加:
 *   if (trimmed === 'プラン' || trimmed === '/plan') {
 *     return await handlePlanStatus(user, replyToken);
 *   }
 *   if (trimmed === 'アップグレード' || trimmed === '/upgrade') {
 *     return await handleUpgradePrompt(user, replyToken);
 *   }
 */

import { replyText } from '../services/lineService.js';
import {
  buildPlanSummaryMessage,
  checkGenerationLimit,
  getUserSubscription,
} from '../services/subscriptionService.js';
import { PAID_PLANS, getPlanConfig } from '../config/planConfig.js';

// ============================================================
// 「プラン」コマンド — 現在プラン・使用状況を表示
// ============================================================

export async function handlePlanStatus(user, replyToken) {
  try {
    const summary = await buildPlanSummaryMessage(user.id);
    const subscription = await getUserSubscription(user.id);

    let upgradeHint = '';
    if (subscription.plan === 'free') {
      upgradeHint = '\n\n💡 「アップグレード」でプランを確認できます';
    }

    await replyText(replyToken, summary + upgradeHint);
  } catch (err) {
    console.error('[SubscriptionHandler] プラン確認エラー:', err.message);
    await replyText(replyToken, 'プランの確認中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ============================================================
// 「アップグレード」コマンド — 有料プラン一覧 + 決済リンク
// ============================================================

export async function handleUpgradePrompt(user, replyToken) {
  try {
    const subscription = await getUserSubscription(user.id);
    const currentPlan = subscription.plan;

    if (currentPlan === 'premium') {
      await replyText(replyToken, '✅ すでに最上位のプレミアムプランをご利用中です。\n\nいつもありがとうございます！');
      return;
    }

    // 有料プランの案内文を生成
    const planLines = PAID_PLANS
      .filter(p => p.key !== currentPlan)
      .map(p => {
        const features = [
          `月間${p.monthlyGenerations === Infinity ? '無制限' : p.monthlyGenerations + '回'}生成`,
          `${p.maxStores === Infinity ? '無制限' : p.maxStores + '店舗'}登録`,
          p.features.collectiveIntelligence ? '集合知データ ✅' : '',
          p.features.seasonalMemory         ? '季節記憶 ✅'     : '',
        ].filter(Boolean).join('\n  ');

        // Stripe Payment Link は Stripe ダッシュボードで作成後に .env に追加
        const paymentLink = getStripePaymentLink(p.key, user);

        return `━━━━━━━━━━━━━━━
【${p.name}】
月額 ¥${p.price.toLocaleString()}（税込）

  ${features}

${paymentLink ? `▶ お申し込みはこちら:\n${paymentLink}` : '▶ 準備中（もうしばらくお待ちください）'}`;
      })
      .join('\n\n');

    const message = `💳 プランアップグレード

現在: ${getPlanConfig(currentPlan).name}

${planLines}

━━━━━━━━━━━━━━━
❓ ご不明な点は「問い合わせ」でご連絡ください`;

    await replyText(replyToken, message);
  } catch (err) {
    console.error('[SubscriptionHandler] アップグレード案内エラー:', err.message);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ============================================================
// 生成上限到達時の通知（imageHandler / textHandler から呼び出す）
// ============================================================

/**
 * 生成前に上限チェックを行い、上限到達時はメッセージを返して処理を停止させる
 * @returns {boolean} true = 上限超過（処理停止）, false = 継続可能
 */
export async function replyIfLimitReached(user, replyToken) {
  try {
    const result = await checkGenerationLimit(user.id);
    if (result.allowed) return false;  // 問題なし

    await replyText(
      replyToken,
      `⚠️ 今月の生成上限（${result.limit}回）に達しました。

現在: ${result.used}回 / ${result.limit}回

「アップグレード」で上限を増やすことができます。\n\n次月（1日）にリセットされます。`
    );
    return true;  // 上限超過 → 呼び出し元は処理を中断する
  } catch (err) {
    console.error('[SubscriptionHandler] 上限チェックエラー:', err.message);
    return false;  // エラー時は通過させる（サービス継続性を優先）
  }
}

// ============================================================
// 内部ユーティリティ
// ============================================================

/**
 * Stripe Payment Link を生成（LINE ユーザー ID を metadata に付与）
 * Payment Link は Stripe ダッシュボードで事前作成が必要
 */
function getStripePaymentLink(planKey, user) {
  const envKey = `STRIPE_PAYMENT_LINK_${planKey.toUpperCase()}`;
  const baseLink = process.env[envKey];
  if (!baseLink) return null;

  // client_reference_id に LINE ユーザー ID を付与（Webhook で照合用）
  const url = new URL(baseLink);
  url.searchParams.set('client_reference_id', user.id);
  return url.toString();
}
