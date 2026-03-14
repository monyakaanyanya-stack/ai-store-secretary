-- 投稿ストック + 予約投稿用マイグレーション
-- post_history に post_status と scheduled_at カラムを追加

-- post_status: 投稿の状態管理
--   'active'    = 通常の投稿（既存レコード全て・デフォルト）
--   'draft'     = ストック保存（下書き）
--   'scheduled' = 予約投稿待ち
--   'posted'    = Instagram投稿済み
ALTER TABLE post_history ADD COLUMN IF NOT EXISTS post_status text DEFAULT 'active';

-- scheduled_at: 予約投稿の投稿予定時刻（scheduledの時のみ使用）
ALTER TABLE post_history ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- 予約投稿チェック用インデックス（cronジョブで高速検索）
CREATE INDEX IF NOT EXISTS idx_post_history_scheduled
  ON post_history (post_status, scheduled_at)
  WHERE post_status = 'scheduled';

-- ストック一覧取得用インデックス
CREATE INDEX IF NOT EXISTS idx_post_history_draft
  ON post_history (store_id, created_at DESC)
  WHERE post_status IN ('draft', 'scheduled');
