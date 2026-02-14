-- =============================================
-- AI Store Secretary - Learning System Migration
-- 集合知システム + パーソナライゼーション機能
-- =============================================

-- 1. stores テーブルに category フィールドを追加（まだない場合）
ALTER TABLE stores ADD COLUMN IF NOT EXISTS category VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_stores_category ON stores(category);

-- 2. learning_profiles テーブル（店舗ごとの学習プロファイル）
CREATE TABLE IF NOT EXISTS learning_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  profile_data JSONB DEFAULT '{
    "word_preferences": {},
    "emoji_style": "moderate",
    "tone_adjustments": {},
    "hashtag_patterns": [],
    "length_preferences": {},
    "topic_themes": []
  }',
  interaction_count INTEGER DEFAULT 0,
  last_feedback_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_profiles_store_id ON learning_profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_learning_profiles_interaction_count ON learning_profiles(interaction_count DESC);

-- 3. engagement_metrics テーブル（エンゲージメント指標）
CREATE TABLE IF NOT EXISTS engagement_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES post_history(id) ON DELETE CASCADE,
  category VARCHAR(100),
  post_content TEXT,
  hashtags TEXT[],
  post_length INTEGER,
  emoji_count INTEGER DEFAULT 0,

  -- エンゲージメント指標
  likes_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,

  -- 分析用フィールド
  post_time TIME,
  day_of_week INTEGER,
  sentiment_score DECIMAL(3,2),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_metrics_store_id ON engagement_metrics(store_id);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_category ON engagement_metrics(category);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_engagement_rate ON engagement_metrics(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_created_at ON engagement_metrics(created_at DESC);

-- 4. collective_insights テーブル更新（既存テーブルの拡張）
ALTER TABLE collective_insights ADD COLUMN IF NOT EXISTS category_group VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_collective_insights_category_group ON collective_insights(category_group);

-- 5. post_history テーブルに learning_applied フラグを追加
ALTER TABLE post_history ADD COLUMN IF NOT EXISTS learning_applied JSONB DEFAULT '{
  "own_learning": false,
  "category_insights": false,
  "group_insights": false,
  "personalization_level": 0
}';

-- 6. トリガー: learning_profiles の updated_at 自動更新
CREATE OR REPLACE FUNCTION update_learning_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_learning_profiles_updated_at ON learning_profiles;
CREATE TRIGGER trigger_update_learning_profiles_updated_at
  BEFORE UPDATE ON learning_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_learning_profiles_updated_at();

-- 7. ビュー: カテゴリー別の平均エンゲージメント率
CREATE OR REPLACE VIEW category_engagement_summary AS
SELECT
  category,
  COUNT(*) as total_posts,
  AVG(engagement_rate) as avg_engagement_rate,
  AVG(likes_count) as avg_likes,
  AVG(saves_count) as avg_saves,
  AVG(comments_count) as avg_comments,
  AVG(reach) as avg_reach
FROM engagement_metrics
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY category;
