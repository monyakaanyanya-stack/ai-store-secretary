/**
 * サブスクリプションプラン定義（3プラン構造）
 *
 * 有効化手順: SUBSCRIPTION_HOWTO.md を参照
 * ※ このファイルは変更不要。Stripe Price ID は .env で管理。
 *
 * プラン設計:
 *   Free     - まずは体験（投稿完成体験を月5回）→ 投稿系機能ON
 *   Standard - SNSを続ける（¥2,980/月・60回）
 *   Premium  - SNS運用を任せる（¥5,980/月・200回）
 *
 * 機能フラグ説明:
 *   collectiveIntelligence    - 集合知データ（同業種ベスト参照）→ 全プラン
 *   seasonalMemory            - 季節記憶（前年同月投稿参照）→ 全プラン
 *   advancedPersonalization   - 高度なパーソナライゼーション（人格学習）→ 全プラン
 *   proposalABC               - A/B/C 案選択 → 全プラン
 *   engagementHealthCheck     - 健康診断（数字だけ見れる）→ 全プラン
 *   engagementPrescription    - 処方箋（因果分析・業界比較・勝ちパターン）→ 全プラン
 *   engagementAutoLearn       - エンゲージメント→プロンプト自動反映 → 全プラン
 *   instagramPost             - Instagram投稿（API経由）→ 全プラン
 *   weeklyContentPlan         - 週間コンテンツ計画（月曜自動送信）→ Premium
 *   enhancedPhotoAdvice       - 強化版撮影アドバイス（明日撮るべきもの+理由）→ Premium
 *   dailyPhotoNudge            - 毎日17時の撮影提案ナッジ → Standard以上
 *   postStock                 - 投稿ストック（下書き保存）→ 全プラン
 *   scheduledPost             - 予約投稿（日時指定で自動投稿）→ 全プラン
 *   dataCollection            - エンゲージメントデータ裏収集（集合知貢献）→ 全プラン
 */

export const PLANS = {
  free: {
    name: 'フリープラン',
    monthlyGenerations: 5,
    maxStores: 1,
    features: {
      collectiveIntelligence: true,
      seasonalMemory: true,
      advancedPersonalization: true,
      proposalABC: true,
      engagementHealthCheck: true,
      engagementPrescription: true,
      engagementAutoLearn: true,
      instagramPost: true,
      weeklyContentPlan: false,
      enhancedPhotoAdvice: false,
      dailyPhotoNudge: false,
      postStock: true,
      scheduledPost: true,
      dataCollection: true,
    },
    price: 0,
    stripePriceId: null,
  },

  standard: {
    name: 'スタンダードプラン',
    monthlyGenerations: 60,
    maxStores: 1,
    features: {
      collectiveIntelligence: true,
      seasonalMemory: true,
      advancedPersonalization: true,
      proposalABC: true,
      engagementHealthCheck: true,
      engagementPrescription: true,
      engagementAutoLearn: true,
      instagramPost: true,
      weeklyContentPlan: false,
      enhancedPhotoAdvice: false,
      dailyPhotoNudge: true,
      postStock: true,
      scheduledPost: true,
      dataCollection: true,
    },
    price: 2980,
    stripePriceId: process.env.STRIPE_STANDARD_PRICE_ID || null,
  },

  premium: {
    name: 'プレミアムプラン',
    monthlyGenerations: 200,
    maxStores: 5,
    features: {
      collectiveIntelligence: true,
      seasonalMemory: true,
      advancedPersonalization: true,
      proposalABC: true,
      engagementHealthCheck: true,
      engagementPrescription: true,
      engagementAutoLearn: true,
      instagramPost: true,
      weeklyContentPlan: true,
      enhancedPhotoAdvice: true,
      dailyPhotoNudge: true,
      postStock: true,
      scheduledPost: true,
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
