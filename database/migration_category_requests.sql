-- カテゴリーリクエストテーブル
-- ユーザーが「その他」を選んで自由入力した業種を蓄積し、
-- 管理者がリストに追加するかどうかを判断するためのテーブル

CREATE TABLE IF NOT EXISTS category_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,         -- ユーザーが入力した業種名
  parent_group TEXT,                   -- 選択した大カテゴリー（美容系・飲食系など）
  status TEXT DEFAULT 'pending',       -- pending / approved / rejected
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_category_requests_status ON category_requests(status);
CREATE INDEX IF NOT EXISTS idx_category_requests_category_name ON category_requests(category_name);
