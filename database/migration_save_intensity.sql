-- =============================================
-- AI Store Secretary - Save Intensity Migration
-- いいね×10推定を廃止し、正直な指標に変更
-- =============================================

-- engagement_metrics テーブルに新指標カラムを追加
ALTER TABLE engagement_metrics
  ADD COLUMN IF NOT EXISTS save_intensity DECIMAL(6,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reaction_index DECIMAL(8,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reach_actual INTEGER DEFAULT 0;
-- reach_actual: ユーザーが実際に入力したリーチ数（任意）
-- save_intensity: 保存 ÷ いいね（算出値）
-- reaction_index: (いいね + 保存×3) ÷ フォロワー × 100（フォロワー数あるときのみ）

-- インデックス追加（ランキング用）
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_save_intensity
  ON engagement_metrics(save_intensity DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_reaction_index
  ON engagement_metrics(reaction_index DESC);

-- ビューを更新して新指標を反映
CREATE OR REPLACE VIEW category_engagement_summary AS
SELECT
  category,
  COUNT(*) as total_posts,
  AVG(save_intensity) as avg_save_intensity,
  AVG(reaction_index) as avg_reaction_index,
  -- engagement_rate はリーチ実入力がある投稿のみ平均
  AVG(CASE WHEN reach_actual > 0 THEN engagement_rate ELSE NULL END) as avg_engagement_rate_real,
  AVG(likes_count) as avg_likes,
  AVG(saves_count) as avg_saves,
  AVG(comments_count) as avg_comments,
  MAX(save_intensity) as max_save_intensity
FROM engagement_metrics
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY category;
