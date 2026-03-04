-- ============================================================
-- 週間コンテンツ計画テーブル
-- Premium ユーザーに毎週月曜に配信する5日分の撮影・投稿計画
-- Phase 16: Premium プラン価値リデザイン
-- ============================================================

CREATE TABLE IF NOT EXISTS weekly_content_plans (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start   DATE NOT NULL,
  plan_content JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, week_start)
);

-- RLS
ALTER TABLE weekly_content_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_plans_service_role_all" ON weekly_content_plans
  FOR ALL USING (auth.role() = 'service_role');

-- インデックス
CREATE INDEX IF NOT EXISTS idx_weekly_plans_store_week
  ON weekly_content_plans(store_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_user_id
  ON weekly_content_plans(user_id);
