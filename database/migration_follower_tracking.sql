-- =============================================
-- Follower Tracking Migration
-- フォロワー数収集・履歴管理機能
-- =============================================

-- stores テーブルに follower_count カラムを追加
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS follower_count_updated_at TIMESTAMP WITH TIME ZONE;

-- フォロワー履歴テーブル
CREATE TABLE IF NOT EXISTS follower_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  follower_count INTEGER NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source VARCHAR(50) DEFAULT 'manual', -- manual, monthly_collection
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follower_history_store_id ON follower_history(store_id);
CREATE INDEX IF NOT EXISTS idx_follower_history_recorded_at ON follower_history(recorded_at DESC);

-- 月次フォロワー数収集リクエストテーブル
CREATE TABLE IF NOT EXISTS monthly_follower_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(50) DEFAULT 'awaiting_response', -- awaiting_response, completed, expired
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monthly_follower_requests_user_id ON monthly_follower_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_follower_requests_status ON monthly_follower_requests(status);
CREATE INDEX IF NOT EXISTS idx_monthly_follower_requests_sent_at ON monthly_follower_requests(sent_at DESC);
