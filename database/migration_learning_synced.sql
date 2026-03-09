-- 夜間エンゲージメント自動同期: 学習済みフラグ
-- instagram_posts テーブルに learning_synced カラムを追加
-- 同じ投稿を毎晩学習し直さないための重複防止

ALTER TABLE instagram_posts ADD COLUMN IF NOT EXISTS learning_synced BOOLEAN DEFAULT FALSE;
ALTER TABLE instagram_posts ADD COLUMN IF NOT EXISTS learning_synced_at TIMESTAMPTZ;
