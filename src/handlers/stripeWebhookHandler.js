/**
 * Stripe Webhook ハンドラー
 *
 * 有効化手順: SUBSCRIPTION_HOWTO.md の「STEP 4: Webhook 登録」を参照
 *
 * server.js への組み込み方法:
 *   import { handleStripeWebhook } from './src/handlers/stripeWebhookHandler.js';
 *   // Webhook は raw body が必要なので LINE webhook の前に追加
 *   app.post('/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
 *
 * Stripe で購読するイベント:
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_failed
 *   - checkout.session.completed  ← Payment Link 使用時
 */

import Stripe from 'stripe';
import {
  syncStripeSubscription,
  downgradeToFree,
} from '../services/subscriptionService.js';
import { pushMessage } from '../services/lineService.js';
import { supabase } from '../services/supabaseService.js';

// Stripe クライアント（実行時に初期化）
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY が設定されていません');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
}

// ============================================================
// メインハンドラー（server.js から呼び出す）
// ============================================================

export async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error('[StripeWebhook] STRIPE_WEBHOOK_SECRET が未設定');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('[StripeWebhook] 署名検証失敗:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log(`[StripeWebhook] イベント受信: ${event.type}`);

  try {
    switch (event.type) {

      // サブスクリプション作成・更新
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const lineUserId = await getLineUserIdFromCustomer(subscription.customer);
        if (lineUserId) {
          await syncStripeSubscription(subscription, lineUserId);
          // プラン変更通知
          if (event.type === 'customer.subscription.updated') {
            await notifyPlanChange(lineUserId, subscription);
          }
        }
        break;
      }

      // サブスクリプション解約・期限切れ
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await downgradeToFree(subscription.id);
        const lineUserId = await getLineUserIdFromCustomer(subscription.customer);
        if (lineUserId) {
          await notifyPlanDowngrade(lineUserId);
        }
        break;
      }

      // 支払い失敗
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const lineUserId = await getLineUserIdFromCustomer(invoice.customer);
        if (lineUserId) {
          await notifyPaymentFailed(lineUserId);
        }
        break;
      }

      // Payment Link からのチェックアウト完了（初回購読）
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription);
          // client_reference_id に user.id を設定している
          const userId = session.client_reference_id;
          if (userId) {
            const lineUserId = await getLineUserIdFromUserId(userId);
            if (lineUserId) {
              await syncStripeSubscription(subscription, lineUserId);
              await notifyPlanActivated(lineUserId, subscription);
            }
          }
        }
        break;
      }

      default:
        // 未処理イベントは無視
        break;
    }
  } catch (err) {
    console.error(`[StripeWebhook] イベント処理エラー (${event.type}):`, err.message);
    // Stripe には 200 を返す（再送ループ防止）
  }

  return res.status(200).json({ received: true });
}

// ============================================================
// ユーティリティ
// ============================================================

/** Stripe Customer ID → LINE ユーザー ID を取得 */
async function getLineUserIdFromCustomer(stripeCustomerId) {
  const { data } = await supabase
    .from('subscriptions')
    .select('users!inner(line_user_id)')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();
  return data?.users?.line_user_id || null;
}

/** DB users.id → LINE ユーザー ID を取得 */
async function getLineUserIdFromUserId(userId) {
  const { data } = await supabase
    .from('users')
    .select('line_user_id')
    .eq('id', userId)
    .single();
  return data?.line_user_id || null;
}

/** プラン変更通知 */
async function notifyPlanChange(lineUserId, stripeSubscription) {
  try {
    const { PLANS } = await import('../config/planConfig.js');
    const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
    const plan = Object.entries(PLANS).find(([, v]) => v.stripePriceId === priceId)?.[1];
    if (!plan) return;

    await pushMessage(lineUserId, [{
      type: 'text',
      text: `✅ プランが「${plan.name}」に変更されました！\n\n「プラン」で現在の状況を確認できます。`,
    }]);
  } catch (err) {
    console.error('[StripeWebhook] 変更通知エラー:', err.message);
  }
}

/** プラン有効化通知（Payment Link 経由） */
async function notifyPlanActivated(lineUserId, stripeSubscription) {
  try {
    const { PLANS } = await import('../config/planConfig.js');
    const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
    const plan = Object.entries(PLANS).find(([, v]) => v.stripePriceId === priceId)?.[1];
    const planName = plan?.name || '有料プラン';

    const endDate = new Date(stripeSubscription.current_period_end * 1000)
      .toLocaleDateString('ja-JP');

    await pushMessage(lineUserId, [{
      type: 'text',
      text: `🎉 「${planName}」へのご登録ありがとうございます！\n\n全機能がご利用いただけます。\n次回更新日: ${endDate}\n\n「プラン」で詳細を確認できます。`,
    }]);
  } catch (err) {
    console.error('[StripeWebhook] 有効化通知エラー:', err.message);
  }
}

/** プランダウングレード通知 */
async function notifyPlanDowngrade(lineUserId) {
  try {
    await pushMessage(lineUserId, [{
      type: 'text',
      text: `ご利用ありがとうございました。\n\nプランがフリープランに戻りました。\n引き続き月30回までの投稿生成をご利用いただけます。\n\n再開の際は「アップグレード」と送ってください。`,
    }]);
  } catch (err) {
    console.error('[StripeWebhook] ダウングレード通知エラー:', err.message);
  }
}

/** 支払い失敗通知 */
async function notifyPaymentFailed(lineUserId) {
  try {
    await pushMessage(lineUserId, [{
      type: 'text',
      text: `⚠️ お支払いに失敗しました。\n\nStripe のマイページから支払い情報を更新してください。\n更新されない場合、自動的にフリープランに移行します。`,
    }]);
  } catch (err) {
    console.error('[StripeWebhook] 支払失敗通知エラー:', err.message);
  }
}
