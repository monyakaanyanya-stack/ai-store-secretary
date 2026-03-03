-- Instagram投稿機能用マイグレーション
-- 実行タイミング: Supabase SQL Editor で手動実行

-- post_history に image_url カラム追加（Supabase Storage の公開URL）
ALTER TABLE post_history ADD COLUMN IF NOT EXISTS image_url text;

-- instagram_posts に published_via カラム追加（sync = API同期, app = アプリ投稿）
ALTER TABLE instagram_posts ADD COLUMN IF NOT EXISTS published_via text DEFAULT 'sync';

-- instagram_posts の一部カラムを nullable に（アプリ投稿時は timestamp, synced_at 不要）
DO $$
BEGIN
  -- timestamp カラムが NOT NULL の場合のみ変更
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'instagram_posts' AND column_name = 'timestamp' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE instagram_posts ALTER COLUMN "timestamp" DROP NOT NULL;
  END IF;

  -- synced_at カラムが NOT NULL の場合のみ変更
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'instagram_posts' AND column_name = 'synced_at' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE instagram_posts ALTER COLUMN synced_at DROP NOT NULL;
  END IF;
END $$;
