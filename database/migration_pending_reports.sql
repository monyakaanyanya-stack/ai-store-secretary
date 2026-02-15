-- =============================================
-- Pending Reports Table for Post Selection Flow
-- 報告時の投稿選択フローのための一時データ保存
-- =============================================

CREATE TABLE IF NOT EXISTS pending_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,

  -- 報告されたメトリクス
  likes_count INTEGER NOT NULL,
  saves_count INTEGER NOT NULL,
  comments_count INTEGER NOT NULL,

  -- ステータス管理
  status VARCHAR(50) DEFAULT 'awaiting_post_selection', -- awaiting_post_selection, completed, expired

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_pending_reports_user_id ON pending_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_reports_status ON pending_reports(status);
CREATE INDEX IF NOT EXISTS idx_pending_reports_expires_at ON pending_reports(expires_at);

-- 古いpending_reportsを自動削除するクリーンアップ関数（オプション）
CREATE OR REPLACE FUNCTION cleanup_expired_pending_reports()
RETURNS void AS $$
BEGIN
  DELETE FROM pending_reports
  WHERE expires_at < NOW() OR status = 'completed';
END;
$$ LANGUAGE plpgsql;
