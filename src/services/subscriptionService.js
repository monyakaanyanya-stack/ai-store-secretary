/**
 * サブスクリプション管理サービス
 *
 * 有効化手順: SUBSCRIPTION_HOWTO.md を参照
 *
 * グローバルスイッチ: SUBSCRIPTION_ENABLED 環境変数
 *   false（デフォルト）→ 全員 premium 扱い（使い放題）
 *   true → プラン制限が有効になる
 *
 * 有効化時にやること:
 *   1. database/migration_subscriptions.sql を Supabase で実行 ✅
 *   2. .env に STRIPE_* 変数を追加
 *   3. server.js に Stripe Webhook ルートを追加
 *   4. Railway 環境変数に SUBSCRIPTION_ENABLED=true を設定
 */

import { supabase } from './supabaseService.js';
import { getPlanConfig } from '../config/planConfig.js';

// ============================================================
// グローバルスイッチ
// SUBSCRIPTION_ENABLED=true で制限ON、それ以外は全員premium扱い
// ============================================================
const SUBSCRIPTION_ENABLED = process.env.SUBSCRIPTION_ENABLED === 'true';

// ============================================================
// プラン取得
// ============================================================

/**
 * ユーザーの現在プラン設定を取得（なければ free を自動作成）
 * @param {string} userId
 * @returns {Promise<{plan: string, status: string, currentPeriodEnd: Date|null}>}
 */
export async function getUserSubscription(userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end, cancel_at_period_end')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // レコードがなければ free で自動作成
    return await getOrCreateSubscription(userId);
  }

  // status が active / trialing 以外（past_due など）は free 扱いで制限
  const effectivePlan = ['active', 'trialing'].includes(data.status) ? data.plan : 'free';

  return {
    plan: effectivePlan,
    status: data.status,
    currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : null,
    cancelAtPeriodEnd: data.cancel_at_period_end || false,
  };
}

/**
 * サブスクリプションレコードがなければ free で新規作成して返す
 */
export async function getOrCreateSubscription(userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(
      { user_id: userId, plan: 'free', status: 'active', updated_at: new Date().toISOString() },
      { onConflict: 'user_id', ignoreDuplicates: true }
    )
    .select('plan, status, current_period_end, cancel_at_period_end')
    .single();

  if (error) {
    console.error('[Subscription] getOrCreate エラー:', error.message);
    return { plan: 'free', status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }

  return {
    plan: data?.plan || 'free',
    status: data?.status || 'active',
    currentPeriodEnd: data?.current_period_end ? new Date(data.current_period_end) : null,
    cancelAtPeriodEnd: data?.cancel_at_period_end || false,
  };
}

// ============================================================
// 生成回数チェック
// ============================================================

/**
 * 今月の生成数を取得（JST ベース）
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function getMonthlyGenerationCount(userId) {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const nowJst = new Date(now.getTime() + jstOffset);

  const monthStart = new Date(nowJst.getFullYear(), nowJst.getMonth(), 1);
  const monthStartUtc = new Date(monthStart.getTime() - jstOffset);

  // post_history は直接 user_id を持つのでシンプルにカウント
  const { count, error } = await supabase
    .from('post_history')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', monthStartUtc.toISOString());

  if (error) {
    console.error('[Subscription] 月間生成数取得エラー:', error.message);
    return 0;
  }

  return count || 0;
}

/**
 * 生成上限チェック
 * @param {string} userId
 * @returns {Promise<{allowed: boolean, used: number, limit: number, plan: string}>}
 */
export async function checkGenerationLimit(userId) {
  // スイッチOFF → 常に許可
  if (!SUBSCRIPTION_ENABLED) {
    return { allowed: true, used: 0, limit: Infinity, plan: 'premium' };
  }

  const subscription = await getUserSubscription(userId);
  const planConfig = getPlanConfig(subscription.plan);
  const limit = planConfig.monthlyGenerations;

  // 無制限プランはチェック不要
  if (!Number.isFinite(limit)) {
    return { allowed: true, used: 0, limit: Infinity, plan: subscription.plan };
  }

  const used = await getMonthlyGenerationCount(userId);

  return {
    allowed: used < limit,
    used,
    limit,
    plan: subscription.plan,
    planName: planConfig.name,
  };
}

// ============================================================
// 機能アクセスチェック
// ============================================================

/**
 * 特定機能が使用可能かチェック
 * @param {string} userId
 * @param {'collectiveIntelligence'|'seasonalMemory'|'advancedPersonalization'|'proposalABC'|'engagementReport'} feature
 * @returns {Promise<boolean>}
 */
export async function isFeatureEnabled(userId, feature) {
  // スイッチOFF → 全機能有効
  if (!SUBSCRIPTION_ENABLED) {
    return true;
  }

  const subscription = await getUserSubscription(userId);
  const planConfig = getPlanConfig(subscription.plan);
  return planConfig.features[feature] === true;
}

// ============================================================
// Stripe 連携（Webhook から呼び出す）
// ============================================================

/**
 * Stripe サブスクリプション作成/更新時にDBを同期
 * @param {object} stripeSubscription - Stripe Subscription オブジェクト
 * @param {string} lineUserId - metadata から取得したLINEユーザーID
 */
export async function syncStripeSubscription(stripeSubscription, lineUserId) {
  // LINE userId → DB users.line_user_id で探す
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('line_user_id', lineUserId)
    .single();

  if (!user) {
    console.error('[Subscription] Stripe sync: LINE ユーザーが見つかりません:', lineUserId?.slice(0, 4));
    return;
  }

  // Stripe の price ID からプランを判定
  const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
  const { PLANS } = await import('../config/planConfig.js');
  const matchedEntry = Object.entries(PLANS).find(([, v]) => v.stripePriceId === priceId);
  if (!matchedEntry) {
    console.error(`[Subscription] Stripe sync: 不明な Price ID です (${priceId?.slice(0, 12)}...)。ユーザーのプランは変更しません。`);
    return;
  }
  const matchedPlan = matchedEntry[0];

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id:                user.id,
      plan:                   matchedPlan,
      stripe_customer_id:     stripeSubscription.customer,
      stripe_subscription_id: stripeSubscription.id,
      status:                 stripeSubscription.status,
      current_period_start:   new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end:     new Date(stripeSubscription.current_period_end   * 1000).toISOString(),
      cancel_at_period_end:   stripeSubscription.cancel_at_period_end || false,
      updated_at:             new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('[Subscription] Stripe sync エラー:', error.message);
  } else {
    console.log(`[Subscription] Stripe sync 完了: user=${user.id.slice(0, 8)}, plan=${matchedPlan}`);
  }
}

/**
 * サブスクリプション解約/期限切れ時に free に戻す
 */
export async function downgradeToFree(stripeSubscriptionId) {
  const { error } = await supabase
    .from('subscriptions')
    .update({ plan: 'free', status: 'canceled', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  if (error) {
    console.error('[Subscription] downgrade エラー:', error.message);
  }
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * プラン・使用状況のサマリー文字列を生成（LINE 返信用）
 */
export async function buildPlanSummaryMessage(userId) {
  // スイッチOFF → premium として表示
  if (!SUBSCRIPTION_ENABLED) {
    const premiumConfig = getPlanConfig('premium');
    return `📋 現在のプラン: 全機能開放中（無料期間）\n📊 今月の生成: 無制限`;
  }

  const subscription = await getUserSubscription(userId);
  const planConfig = getPlanConfig(subscription.plan);
  const limit = planConfig.monthlyGenerations;

  let usageLine = '';
  if (Number.isFinite(limit)) {
    const used = await getMonthlyGenerationCount(userId);
    const remaining = Math.max(0, limit - used);
    usageLine = `\n📊 今月の生成: ${used} / ${limit}回（残り ${remaining}回）`;
  } else {
    usageLine = '\n📊 今月の生成: 無制限';
  }

  const featureLines = [
    `集合知データ:       ${planConfig.features.collectiveIntelligence ? '✅' : '❌'}`,
    `季節記憶:           ${planConfig.features.seasonalMemory         ? '✅' : '❌'}`,
    `人格学習:           ${planConfig.features.advancedPersonalization ? '✅' : '❌'}`,
    `報告（数値）:       ${planConfig.features.engagementHealthCheck   ? '✅' : '❌'}`,
    `分析結果:           ${planConfig.features.engagementPrescription  ? '✅' : '❌'}`,
    `自動学習→反映:       ${planConfig.features.engagementAutoLearn      ? '✅' : '❌'}`,
    `Instagram投稿:       ${planConfig.features.instagramPost            ? '✅' : '❌'}`,
    `週間コンテンツ計画:   ${planConfig.features.weeklyContentPlan        ? '✅' : '❌'}`,
    `強化版撮影アドバイス: ${planConfig.features.enhancedPhotoAdvice      ? '✅' : '❌'}`,
    `撮影提案ナッジ:       ${planConfig.features.dailyPhotoNudge          ? '✅' : '❌'}`,
  ].join('\n');

  let periodLine = '';
  if (subscription.plan !== 'free' && subscription.currentPeriodEnd) {
    const end = subscription.currentPeriodEnd.toLocaleDateString('ja-JP');
    periodLine = subscription.cancelAtPeriodEnd
      ? `\n⚠️ ${end} で解約予定`
      : `\n更新日: ${end}`;
  }

  return `📋 現在のプラン: ${planConfig.name}${usageLine}

【使用可能な機能】
${featureLines}${periodLine}`;
}
