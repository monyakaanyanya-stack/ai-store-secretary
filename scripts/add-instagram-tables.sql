-- ================================================================
-- Instagram Graph API連携テーブル
-- 実行方法: Supabase Dashboard > SQL Editor でこのスクリプトを実行
-- ================================================================

-- Instagram アカウント連携テーブル
CREATE TABLE IF NOT EXISTS instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  instagram_user_id text NOT NULL,         -- Instagram ビジネスアカウントID
  instagram_username text,                  -- @ユーザー名
  access_token text NOT NULL,              -- 長期アクセストークン（暗号化推奨）
  token_expires_at timestamptz,            -- トークン有効期限
  followers_count int,                     -- フォロワー数（最終取得時）
  media_count int,                         -- 投稿数（最終取得時）
  last_synced_at timestamptz,              -- 最終同期日時
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id)
);

-- Instagram 投稿データテーブル（Graph APIから自動取得）
CREATE TABLE IF NOT EXISTS instagram_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  instagram_account_id uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  media_id text NOT NULL UNIQUE,           -- Instagram メディアID
  permalink text,                          -- 投稿URL
  caption text,                            -- キャプション（本文）
  media_type text,                         -- 'IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'
  timestamp timestamptz,                   -- 投稿日時
  -- エンゲージメントデータ
  likes_count int DEFAULT 0,
  comments_count int DEFAULT 0,
  saves_count int DEFAULT 0,
  reach int DEFAULT 0,
  impressions int DEFAULT 0,
  engagement_rate float,
  -- 分析済みデータ
  hashtags text[],
  post_length int,
  emoji_count int,
  post_month int,
  post_season text,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_instagram_posts_store_id ON instagram_posts(store_id);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_timestamp ON instagram_posts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_media_id ON instagram_posts(media_id);
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_store_id ON instagram_accounts(store_id);

-- RLS有効化（enable-rls.sqlを実行済みの場合）
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;

-- 確認クエリ
SELECT 'instagram_accounts テーブル作成完了' AS message;
SELECT 'instagram_posts テーブル作成完了' AS message;
