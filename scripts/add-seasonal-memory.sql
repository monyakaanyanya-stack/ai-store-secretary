-- ================================================================
-- 季節記憶機能: post_history テーブルに月・季節カラムを追加
-- 実行方法: Supabase Dashboard > SQL Editor でこのスクリプトを実行
-- ================================================================

-- post_history に月・季節カラムを追加
ALTER TABLE post_history
  ADD COLUMN IF NOT EXISTS post_month int,          -- 1-12 (月)
  ADD COLUMN IF NOT EXISTS post_season text,        -- '春', '夏', '秋', '冬'
  ADD COLUMN IF NOT EXISTS engagement_score float;  -- 手動報告のエンゲージメントスコア（省略可）

-- 既存データの月・季節を埋める
UPDATE post_history
SET
  post_month = EXTRACT(MONTH FROM created_at)::int,
  post_season = CASE
    WHEN EXTRACT(MONTH FROM created_at) IN (3, 4, 5) THEN '春'
    WHEN EXTRACT(MONTH FROM created_at) IN (6, 7, 8) THEN '夏'
    WHEN EXTRACT(MONTH FROM created_at) IN (9, 10, 11) THEN '秋'
    ELSE '冬'
  END
WHERE post_month IS NULL;

-- 今後の INSERT で自動セットするトリガー
CREATE OR REPLACE FUNCTION set_post_season()
RETURNS TRIGGER AS $$
BEGIN
  NEW.post_month := EXTRACT(MONTH FROM NEW.created_at)::int;
  NEW.post_season := CASE
    WHEN NEW.post_month IN (3, 4, 5) THEN '春'
    WHEN NEW.post_month IN (6, 7, 8) THEN '夏'
    WHEN NEW.post_month IN (9, 10, 11) THEN '秋'
    ELSE '冬'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_post_season ON post_history;
CREATE TRIGGER trigger_set_post_season
  BEFORE INSERT ON post_history
  FOR EACH ROW EXECUTE FUNCTION set_post_season();

-- 確認クエリ
SELECT
  post_month,
  post_season,
  COUNT(*) AS count
FROM post_history
WHERE post_month IS NOT NULL
GROUP BY post_month, post_season
ORDER BY post_month;
