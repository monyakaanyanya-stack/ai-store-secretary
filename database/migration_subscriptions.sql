-- ============================================================
-- サブスクリプション管理テーブル
-- 実行タイミング: 課金機能を有効化する直前に Supabase で実行
-- 参照: SUBSCRIPTION_HOWTO.md
-- ============================================================

-- subscriptions テーブル（ユーザー 1:1）
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan                   TEXT NOT NULL DEFAULT 'free'
                           CHECK (plan IN ('free', 'standard', 'premium')),
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN DEFAULT FALSE,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS（service_role のみアクセス可能）
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_service_role_all" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- インデックス
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id    ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_cid ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sid ON subscriptions(stripe_subscription_id);

-- ============================================================
-- 月間生成数カウント用ビュー
-- post_history を JST ベースで月集計（既存テーブルを流用）
-- ============================================================
CREATE OR REPLACE VIEW monthly_generation_counts AS
SELECT
  u.id          AS user_id,
  DATE_TRUNC('month',
    (ph.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo'
  )             AS month_jst,
  COUNT(*)      AS generation_count
FROM post_history ph
JOIN stores s ON ph.store_id = s.id
JOIN users  u ON s.user_id = u.id
GROUP BY u.id, DATE_TRUNC('month',
  (ph.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo'
);

-- ============================================================
-- 既存ユーザーに free サブスクリプションレコードを付与
-- ※ 新規ユーザーは subscriptionService.js の getOrCreate で自動作成
-- ============================================================
INSERT INTO subscriptions (user_id, plan, status, created_at, updated_at)
SELECT id, 'free', 'active', now(), now()
FROM users
WHERE id NOT IN (SELECT user_id FROM subscriptions)
ON CONFLICT (user_id) DO NOTHING;

-- 確認クエリ
SELECT
  plan,
  COUNT(*) AS user_count
FROM subscriptions
GROUP BY plan
ORDER BY plan;
