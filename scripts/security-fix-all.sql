-- ================================================================
-- セキュリティ包括修正スクリプト
-- Supabase Security Advisor の全警告に対応
--
-- 実行方法: Supabase Dashboard > SQL Editor でこのスクリプトを実行
-- 前提: SUPABASE_SERVICE_ROLE_KEY を使用していること
-- ================================================================

-- ================================================================
-- 1. 全テーブルに RLS を有効化（既に有効なら無害）
-- ================================================================

-- 初期テーブル（enable-rls.sql カバー済み → 念のため再実行）
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_history ENABLE ROW LEVEL SECURITY;

-- Phase 10: Instagram テーブル
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;

-- Phase 5: サブスクリプション
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- カテゴリリクエスト（RLS なかった）
ALTER TABLE category_requests ENABLE ROW LEVEL SECURITY;

-- Pending Reports（RLS なかった）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_reports') THEN
    EXECUTE 'ALTER TABLE pending_reports ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Phase 16: 週間コンテンツ計画
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'weekly_content_plans') THEN
    EXECUTE 'ALTER TABLE weekly_content_plans ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ================================================================
-- 2. anon ロールからのアクセスを完全遮断
--    service_role は RLS をバイパスするためポリシー不要
--    ただし明示的に deny ポリシーがないと Supabase が警告する
-- ================================================================

-- category_requests: service_role only
DROP POLICY IF EXISTS "category_requests_service_role_all" ON category_requests;
CREATE POLICY "category_requests_service_role_all" ON category_requests
  FOR ALL USING (auth.role() = 'service_role');

-- pending_reports: service_role only
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_reports') THEN
    EXECUTE 'DROP POLICY IF EXISTS "pending_reports_service_role_all" ON pending_reports';
    EXECUTE 'CREATE POLICY "pending_reports_service_role_all" ON pending_reports FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- instagram_accounts: service_role only
DROP POLICY IF EXISTS "instagram_accounts_service_role_all" ON instagram_accounts;
CREATE POLICY "instagram_accounts_service_role_all" ON instagram_accounts
  FOR ALL USING (auth.role() = 'service_role');

-- instagram_posts: service_role only
DROP POLICY IF EXISTS "instagram_posts_service_role_all" ON instagram_posts;
CREATE POLICY "instagram_posts_service_role_all" ON instagram_posts
  FOR ALL USING (auth.role() = 'service_role');

-- 初期テーブルにもポリシーを追加（enable-rls.sql ではポリシーなしだった）
DROP POLICY IF EXISTS "users_service_role_all" ON users;
CREATE POLICY "users_service_role_all" ON users
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "stores_service_role_all" ON stores;
CREATE POLICY "stores_service_role_all" ON stores
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "post_history_service_role_all" ON post_history;
CREATE POLICY "post_history_service_role_all" ON post_history
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "engagement_metrics_service_role_all" ON engagement_metrics;
CREATE POLICY "engagement_metrics_service_role_all" ON engagement_metrics
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "learning_profiles_service_role_all" ON learning_profiles;
CREATE POLICY "learning_profiles_service_role_all" ON learning_profiles
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "learning_data_service_role_all" ON learning_data;
CREATE POLICY "learning_data_service_role_all" ON learning_data
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "conversation_history_service_role_all" ON conversation_history;
CREATE POLICY "conversation_history_service_role_all" ON conversation_history
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "onboarding_state_service_role_all" ON onboarding_state;
CREATE POLICY "onboarding_state_service_role_all" ON onboarding_state
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "follower_history_service_role_all" ON follower_history;
CREATE POLICY "follower_history_service_role_all" ON follower_history
  FOR ALL USING (auth.role() = 'service_role');

-- ================================================================
-- 3. 関数の search_path を固定（SQL injection 防止）
-- ================================================================

-- set_post_season: search_path 追加
CREATE OR REPLACE FUNCTION set_post_season()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.post_month := EXTRACT(MONTH FROM NEW.created_at)::int;
  NEW.post_season := CASE
    WHEN NEW.post_month IN (3, 4, 5) THEN '春'
    WHEN NEW.post_month IN (6, 7, 8) THEN '夏'
    WHEN NEW.post_month IN (9, 10, 11) THEN '秋'
    ELSE '冬'
  END;
  RETURN NEW;
END;
$$;

-- cleanup_expired_pending_reports: search_path 追加
CREATE OR REPLACE FUNCTION cleanup_expired_pending_reports()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM pending_reports
  WHERE expires_at < NOW() OR status = 'completed';
END;
$$;

-- ================================================================
-- 4. 機密カラムのアクセス制限
--    instagram_accounts.access_token を anon/authenticated から遮断
-- ================================================================

REVOKE SELECT ON instagram_accounts FROM anon;
REVOKE SELECT ON instagram_accounts FROM authenticated;
REVOKE INSERT ON instagram_accounts FROM anon;
REVOKE INSERT ON instagram_accounts FROM authenticated;
REVOKE UPDATE ON instagram_accounts FROM anon;
REVOKE UPDATE ON instagram_accounts FROM authenticated;
REVOKE DELETE ON instagram_accounts FROM anon;
REVOKE DELETE ON instagram_accounts FROM authenticated;

-- ================================================================
-- 5. 既存の anon ポリシーをクリーンアップ
-- ================================================================

-- enable-rls.sql で作成された可能性のある古いポリシーを削除
DROP POLICY IF EXISTS "anon_users_select" ON users;
DROP POLICY IF EXISTS "anon_users_insert" ON users;
DROP POLICY IF EXISTS "anon_users_update" ON users;
DROP POLICY IF EXISTS "anon_stores_select" ON stores;
DROP POLICY IF EXISTS "anon_stores_insert" ON stores;
DROP POLICY IF EXISTS "anon_stores_update" ON stores;
DROP POLICY IF EXISTS "anon_post_history_select" ON post_history;
DROP POLICY IF EXISTS "anon_post_history_insert" ON post_history;
DROP POLICY IF EXISTS "anon_engagement_metrics_select" ON engagement_metrics;
DROP POLICY IF EXISTS "anon_engagement_metrics_insert" ON engagement_metrics;
DROP POLICY IF EXISTS "anon_engagement_metrics_update" ON engagement_metrics;
DROP POLICY IF EXISTS "anon_engagement_metrics_delete" ON engagement_metrics;
DROP POLICY IF EXISTS "anon_learning_profiles_select" ON learning_profiles;
DROP POLICY IF EXISTS "anon_learning_profiles_insert" ON learning_profiles;
DROP POLICY IF EXISTS "anon_learning_profiles_update" ON learning_profiles;
DROP POLICY IF EXISTS "anon_learning_data_select" ON learning_data;
DROP POLICY IF EXISTS "anon_learning_data_insert" ON learning_data;
DROP POLICY IF EXISTS "anon_conversation_history_select" ON conversation_history;
DROP POLICY IF EXISTS "anon_conversation_history_insert" ON conversation_history;
DROP POLICY IF EXISTS "anon_conversation_history_delete" ON conversation_history;
DROP POLICY IF EXISTS "anon_onboarding_state_select" ON onboarding_state;
DROP POLICY IF EXISTS "anon_onboarding_state_insert" ON onboarding_state;
DROP POLICY IF EXISTS "anon_onboarding_state_update" ON onboarding_state;
DROP POLICY IF EXISTS "anon_onboarding_state_delete" ON onboarding_state;
DROP POLICY IF EXISTS "anon_follower_history_select" ON follower_history;
DROP POLICY IF EXISTS "anon_follower_history_insert" ON follower_history;

-- ================================================================
-- 6. VIEW のアクセス制限
--    VIEW は RLS を持てないため REVOKE で直接制限する
-- ================================================================

-- category_engagement_summary: 集合知用集計ビュー（service_role のみ）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'category_engagement_summary'
  ) THEN
    EXECUTE 'REVOKE SELECT ON category_engagement_summary FROM anon';
    EXECUTE 'REVOKE SELECT ON category_engagement_summary FROM authenticated';
  END IF;
END $$;

-- monthly_generation_counts: 月間生成数ビュー（service_role のみ）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'monthly_generation_counts'
  ) THEN
    EXECUTE 'REVOKE SELECT ON monthly_generation_counts FROM anon';
    EXECUTE 'REVOKE SELECT ON monthly_generation_counts FROM authenticated';
  END IF;
END $$;

-- ================================================================
-- 7. subscriptions テーブルの追加保護
--    RLS + ポリシーに加え、REVOKE で二重保護
-- ================================================================

REVOKE SELECT ON subscriptions FROM anon;
REVOKE SELECT ON subscriptions FROM authenticated;
REVOKE INSERT ON subscriptions FROM anon;
REVOKE INSERT ON subscriptions FROM authenticated;
REVOKE UPDATE ON subscriptions FROM anon;
REVOKE UPDATE ON subscriptions FROM authenticated;
REVOKE DELETE ON subscriptions FROM anon;
REVOKE DELETE ON subscriptions FROM authenticated;

-- ================================================================
-- 8. 確認クエリ: 全テーブルの RLS 状態を表示
-- ================================================================

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- VIEW の権限確認
SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('category_engagement_summary', 'monthly_generation_counts')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;
