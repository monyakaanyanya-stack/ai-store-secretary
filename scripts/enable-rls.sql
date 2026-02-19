-- ================================================================
-- RLS（Row Level Security）有効化スクリプト
-- 実行方法: Supabase Dashboard > SQL Editor でこのスクリプトを実行
--
-- 注意: このスクリプトを実行する前に、バックエンドが
-- SUPABASE_SERVICE_ROLE_KEY を使用するよう .env を更新してください。
-- anon キーでは RLS 有効後にアクセスできなくなります。
-- ================================================================

-- ================================================================
-- 1. RLS を有効化
-- ================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_history ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 2. service_role（バックエンド）からのフルアクセスポリシー
--
-- service_role はデフォルトで RLS をバイパスするため、
-- 明示的にポリシーを定義しなくてもアクセス可能です。
-- ただし、anon ロールからのアクセスを完全に遮断するため
-- anon 向けのポリシーは一切作成しません。
-- ================================================================

-- users テーブル: service_role のみアクセス可
-- (ポリシー不要 - service_role は RLS をバイパス)

-- ================================================================
-- 3. 既存ポリシーのクリーンアップ（念のため）
-- ================================================================

-- users
DROP POLICY IF EXISTS "anon_users_select" ON users;
DROP POLICY IF EXISTS "anon_users_insert" ON users;
DROP POLICY IF EXISTS "anon_users_update" ON users;

-- stores
DROP POLICY IF EXISTS "anon_stores_select" ON stores;
DROP POLICY IF EXISTS "anon_stores_insert" ON stores;
DROP POLICY IF EXISTS "anon_stores_update" ON stores;

-- post_history
DROP POLICY IF EXISTS "anon_post_history_select" ON post_history;
DROP POLICY IF EXISTS "anon_post_history_insert" ON post_history;

-- engagement_metrics
DROP POLICY IF EXISTS "anon_engagement_metrics_select" ON engagement_metrics;
DROP POLICY IF EXISTS "anon_engagement_metrics_insert" ON engagement_metrics;
DROP POLICY IF EXISTS "anon_engagement_metrics_update" ON engagement_metrics;
DROP POLICY IF EXISTS "anon_engagement_metrics_delete" ON engagement_metrics;

-- learning_profiles
DROP POLICY IF EXISTS "anon_learning_profiles_select" ON learning_profiles;
DROP POLICY IF EXISTS "anon_learning_profiles_insert" ON learning_profiles;
DROP POLICY IF EXISTS "anon_learning_profiles_update" ON learning_profiles;

-- learning_data
DROP POLICY IF EXISTS "anon_learning_data_select" ON learning_data;
DROP POLICY IF EXISTS "anon_learning_data_insert" ON learning_data;

-- conversation_history
DROP POLICY IF EXISTS "anon_conversation_history_select" ON conversation_history;
DROP POLICY IF EXISTS "anon_conversation_history_insert" ON conversation_history;
DROP POLICY IF EXISTS "anon_conversation_history_delete" ON conversation_history;

-- onboarding_state
DROP POLICY IF EXISTS "anon_onboarding_state_select" ON onboarding_state;
DROP POLICY IF EXISTS "anon_onboarding_state_insert" ON onboarding_state;
DROP POLICY IF EXISTS "anon_onboarding_state_update" ON onboarding_state;
DROP POLICY IF EXISTS "anon_onboarding_state_delete" ON onboarding_state;

-- follower_history
DROP POLICY IF EXISTS "anon_follower_history_select" ON follower_history;
DROP POLICY IF EXISTS "anon_follower_history_insert" ON follower_history;

-- ================================================================
-- 4. 確認クエリ
-- ================================================================

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'stores', 'post_history', 'engagement_metrics',
    'learning_profiles', 'learning_data', 'conversation_history',
    'onboarding_state', 'follower_history'
  )
ORDER BY tablename;
