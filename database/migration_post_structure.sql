-- =============================================
-- AI Store Secretary - Post Structure Migration
-- 投稿骨格の解析データを保存するカラム追加
-- =============================================

-- engagement_metrics テーブルに post_structure カラムを追加
ALTER TABLE engagement_metrics
  ADD COLUMN IF NOT EXISTS post_structure JSONB DEFAULT NULL;

-- インデックス追加（hook_typeでの検索用）
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_post_structure
  ON engagement_metrics USING GIN (post_structure);

-- コメント
COMMENT ON COLUMN engagement_metrics.post_structure IS
  '投稿の骨格データ: { hook_type, has_cta, cta_position, line_break_density, opening_word, line_count, avg_line_length, body_length }';
