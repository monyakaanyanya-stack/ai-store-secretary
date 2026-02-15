-- =============================================
-- Daily Reminder Feature
-- デイリーリマインダー機能
-- =============================================

-- users テーブルに reminder_enabled カラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT true;

-- インデックス作成（リマインダー有効ユーザーの検索用）
CREATE INDEX IF NOT EXISTS idx_users_reminder_enabled ON users(reminder_enabled);

COMMENT ON COLUMN users.reminder_enabled IS 'デイリーリマインダーの有効/無効フラグ（デフォルト: true）';
