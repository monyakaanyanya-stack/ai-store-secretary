/**
 * サブスクリプションプラン定義
 *
 * 有効化手順: SUBSCRIPTION_HOWTO.md を参照
 * ※ このファイルは変更不要。Stripe Price ID は .env で管理。
 */

export const PLANS = {
  free: {
    name: 'フリープラン',
    monthlyGenerations: 30,      // 月間生成上限（投稿生成 + 修正の合計）
    maxStores: 1,                 // 登録可能店舗数
    features: {
      collectiveIntelligence: false,   // 集合知データ（同業種ベスト参照）
      seasonalMemory: false,           // 季節記憶（前年同月投稿参照）
      advancedPersonalization: false,  // 高度なパーソナライゼーション（語尾学習等）
      proposalABC: true,               // A/B/C 案選択
      engagementReport: true,          // エンゲージメント報告
    },
    price: 0,
    stripePriceId: null,
  },

  standard: {
    name: 'スタンダードプラン',
    monthlyGenerations: 100,
    maxStores: 3,
    features: {
      collectiveIntelligence: true,
      seasonalMemory: true,
      advancedPersonalization: true,
      proposalABC: true,
      engagementReport: true,
    },
    price: 2980,   // 円/月（税込）
    stripePriceId: process.env.STRIPE_STANDARD_PRICE_ID || null,
  },

  premium: {
    name: 'プレミアムプラン',
    monthlyGenerations: Infinity,  // 無制限
    maxStores: Infinity,
    features: {
      collectiveIntelligence: true,
      seasonalMemory: true,
      advancedPersonalization: true,
      proposalABC: true,
      engagementReport: true,
    },
    price: 5980,
    stripePriceId: process.env.STRIPE_PREMIUM_PRICE_ID || null,
  },
};

/** プラン名から定義を取得（不明プランは free にフォールバック） */
export function getPlanConfig(planName) {
  return PLANS[planName] || PLANS.free;
}

/** 全プランの一覧（フリーを除く有料プランのみ） */
export const PAID_PLANS = Object.entries(PLANS)
  .filter(([, v]) => v.price > 0)
  .map(([key, v]) => ({ key, ...v }));
