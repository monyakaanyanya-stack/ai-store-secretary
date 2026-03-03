/**
 * サブスクリプションプラン定義
 *
 * 有効化手順: SUBSCRIPTION_HOWTO.md を参照
 * ※ このファイルは変更不要。Stripe Price ID は .env で管理。
 *
 * 機能フラグ説明:
 *   collectiveIntelligence    - 集合知データ（同業種ベスト参照）→ 全プラン
 *   seasonalMemory            - 季節記憶（前年同月投稿参照）
 *   advancedPersonalization   - 高度なパーソナライゼーション（人格学習）
 *   proposalABC               - A/B/C 案選択 → 全プラン
 *   engagementHealthCheck     - 健康診断（数字だけ見れる）→ 全プラン
 *   engagementPrescription    - 処方箋（因果分析・業界比較・勝ちパターン）
 *   engagementAutoLearn       - エンゲージメント→プロンプト自動反映
 *   instagramSchedulePost     - Instagram予約投稿（API経由）
 *   dataCollection            - エンゲージメントデータ裏収集（集合知貢献）→ 全プラン
 */

export const PLANS = {
  free: {
    name: 'フリープラン',
    monthlyGenerations: 1,  // ⚠️ テスト用: 本番では10に戻す
    maxStores: 1,
    features: {
      collectiveIntelligence: true,
      seasonalMemory: false,
      advancedPersonalization: false,
      proposalABC: true,
      engagementHealthCheck: true,
      engagementPrescription: false,
      engagementAutoLearn: false,
      instagramSchedulePost: false,
      dataCollection: true,
    },
    price: 0,
    stripePriceId: null,
  },

  standard: {
    name: 'スタンダードプラン',
    monthlyGenerations: 25,
    maxStores: 3,
    features: {
      collectiveIntelligence: true,
      seasonalMemory: true,
      advancedPersonalization: true,
      proposalABC: true,
      engagementHealthCheck: true,
      engagementPrescription: true,
      engagementAutoLearn: true,
      instagramSchedulePost: false,
      dataCollection: true,
    },
    price: 2980,
    stripePriceId: process.env.STRIPE_STANDARD_PRICE_ID || null,
  },

  premium: {
    name: 'プレミアムプラン',
    monthlyGenerations: 60,
    maxStores: Infinity,
    features: {
      collectiveIntelligence: true,
      seasonalMemory: true,
      advancedPersonalization: true,
      proposalABC: true,
      engagementHealthCheck: true,
      engagementPrescription: true,
      engagementAutoLearn: true,
      instagramSchedulePost: true,
      dataCollection: true,
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
