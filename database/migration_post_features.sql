-- Migration: post_features テーブル（Premium分析AI Phase 1）
-- 写真特徴を構造化タグとして保存し、エンゲージメント結果と紐づける

CREATE TABLE IF NOT EXISTS post_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id),
  post_id UUID NOT NULL REFERENCES post_history(id),
  -- MVP 6特徴量
  main_subject TEXT,          -- food/person/hands/workspace/interior/coffee/drink/product/other
  scene_type TEXT,            -- meal/cooking/cafe_work/portrait/conversation/empty_space/display/other
  has_person BOOLEAN DEFAULT FALSE,
  action_type TEXT,           -- eating/kneading/holding/drinking/talking/looking_out/arranging/serving/none
  lighting_type TEXT,         -- natural_soft/warm_indoor/hard_backlight/low_light/bright_daylight
  camera_angle TEXT,          -- eye_level/top_down/side/diagonal/close_crop
  -- Phase 2以降で追加予定
  secondary_subject TEXT,
  shot_distance TEXT,
  mood_type TEXT,
  composition_type TEXT,
  person_count INTEGER DEFAULT 0,
  keywords_json JSONB DEFAULT '[]'::jsonb,
  -- メタ
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- post_idユニーク（1投稿1特徴）
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_features_post_id ON post_features(post_id);
-- 集計用インデックス
CREATE INDEX IF NOT EXISTS idx_post_features_store_id ON post_features(store_id);
CREATE INDEX IF NOT EXISTS idx_post_features_main_subject ON post_features(main_subject);
CREATE INDEX IF NOT EXISTS idx_post_features_scene_type ON post_features(scene_type);

-- RLS
ALTER TABLE post_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own store features" ON post_features
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access on post_features" ON post_features
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 集計RPC関数: タグ別の平均保存率・エンゲージメント率を集計
-- ============================================================
CREATE OR REPLACE FUNCTION analyze_post_features(p_store_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE(
  feature_name TEXT,
  feature_value TEXT,
  avg_save_rate NUMERIC,
  avg_engagement_rate NUMERIC,
  post_count BIGINT
) AS $$
BEGIN
  -- main_subject別
  RETURN QUERY
  SELECT 'main_subject'::TEXT, pf.main_subject,
    ROUND(AVG(em.save_intensity)::NUMERIC, 4),
    ROUND(AVG(em.engagement_rate)::NUMERIC, 4),
    COUNT(*)
  FROM post_features pf
  JOIN engagement_metrics em ON pf.post_id = em.post_id
  WHERE pf.store_id = p_store_id
    AND em.status = '報告済'
    AND pf.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY pf.main_subject HAVING COUNT(*) >= 3;

  -- scene_type別
  RETURN QUERY
  SELECT 'scene_type'::TEXT, pf.scene_type,
    ROUND(AVG(em.save_intensity)::NUMERIC, 4),
    ROUND(AVG(em.engagement_rate)::NUMERIC, 4),
    COUNT(*)
  FROM post_features pf
  JOIN engagement_metrics em ON pf.post_id = em.post_id
  WHERE pf.store_id = p_store_id
    AND em.status = '報告済'
    AND pf.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY pf.scene_type HAVING COUNT(*) >= 3;

  -- has_person別
  RETURN QUERY
  SELECT 'has_person'::TEXT, pf.has_person::TEXT,
    ROUND(AVG(em.save_intensity)::NUMERIC, 4),
    ROUND(AVG(em.engagement_rate)::NUMERIC, 4),
    COUNT(*)
  FROM post_features pf
  JOIN engagement_metrics em ON pf.post_id = em.post_id
  WHERE pf.store_id = p_store_id
    AND em.status = '報告済'
    AND pf.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY pf.has_person HAVING COUNT(*) >= 3;

  -- action_type別
  RETURN QUERY
  SELECT 'action_type'::TEXT, pf.action_type,
    ROUND(AVG(em.save_intensity)::NUMERIC, 4),
    ROUND(AVG(em.engagement_rate)::NUMERIC, 4),
    COUNT(*)
  FROM post_features pf
  JOIN engagement_metrics em ON pf.post_id = em.post_id
  WHERE pf.store_id = p_store_id
    AND em.status = '報告済'
    AND pf.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY pf.action_type HAVING COUNT(*) >= 3;

  -- lighting_type別
  RETURN QUERY
  SELECT 'lighting_type'::TEXT, pf.lighting_type,
    ROUND(AVG(em.save_intensity)::NUMERIC, 4),
    ROUND(AVG(em.engagement_rate)::NUMERIC, 4),
    COUNT(*)
  FROM post_features pf
  JOIN engagement_metrics em ON pf.post_id = em.post_id
  WHERE pf.store_id = p_store_id
    AND em.status = '報告済'
    AND pf.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY pf.lighting_type HAVING COUNT(*) >= 3;

  -- camera_angle別
  RETURN QUERY
  SELECT 'camera_angle'::TEXT, pf.camera_angle,
    ROUND(AVG(em.save_intensity)::NUMERIC, 4),
    ROUND(AVG(em.engagement_rate)::NUMERIC, 4),
    COUNT(*)
  FROM post_features pf
  JOIN engagement_metrics em ON pf.post_id = em.post_id
  WHERE pf.store_id = p_store_id
    AND em.status = '報告済'
    AND pf.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY pf.camera_angle HAVING COUNT(*) >= 3;
END;
$$ LANGUAGE plpgsql;
