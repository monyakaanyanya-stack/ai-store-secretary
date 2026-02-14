-- =============================================
-- AI Store Secretary - Database Schema
-- Supabase (PostgreSQL) 用
-- =============================================

-- users テーブル
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_user_id VARCHAR(255) UNIQUE NOT NULL,
  current_store_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_line_user_id ON users(line_user_id);

-- stores テーブル
CREATE TABLE stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  strength TEXT NOT NULL,
  tone VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  profit_margin DECIMAL(5,2) DEFAULT 0,
  share_data_for_learning BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_stores_user_id ON stores(user_id);
CREATE INDEX idx_stores_category ON stores(category);

-- users.current_store_id の外部キー（storesテーブル作成後に追加）
ALTER TABLE users
  ADD CONSTRAINT fk_users_current_store
  FOREIGN KEY (current_store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- post_history テーブル
CREATE TABLE post_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_data TEXT,
  likes_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  hashtags TEXT[],
  posted_at TIMESTAMP WITH TIME ZONE,
  image_features JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_post_history_store_id ON post_history(store_id);
CREATE INDEX idx_post_history_created_at ON post_history(created_at DESC);

-- learning_data テーブル
CREATE TABLE learning_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  original_content TEXT,
  feedback TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_learning_data_store_id ON learning_data(store_id);
CREATE INDEX idx_learning_data_created_at ON learning_data(created_at DESC);

-- collective_insights テーブル（Phase 2 用、スキーマのみ）
CREATE TABLE collective_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_type VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  pattern_name VARCHAR(255),
  success_metric DECIMAL(10,4),
  confidence_score DECIMAL(5,4),
  sample_size INTEGER,
  details JSONB,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_collective_insights_category ON collective_insights(category);
CREATE INDEX idx_collective_insights_type ON collective_insights(analysis_type);
