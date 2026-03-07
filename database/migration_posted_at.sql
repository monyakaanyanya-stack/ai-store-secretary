-- ============================================================
-- AI Store Secretary - posted_at Migration
-- 投稿の公開タイムスタンプ (TIMESTAMPTZ) を追加
-- SNS Consultant AI 基盤（カテゴリー別投稿時間最適化）
-- ============================================================

-- 1. posted_at カラムを追加
--    既存の post_time (VARCHAR "HH:MM:SS") / day_of_week (INTEGER 0-6) は
--    JST の時刻と曜日だけ持つため、日付を跨いだトレンド分析ができない。
--    posted_at は post_history.created_at から取得した完全なタイムスタンプ。
ALTER TABLE engagement_metrics
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;

-- 2. 既存データのバックフィル
--    post_history.created_at から完全なタイムスタンプを復元する。
--    post_id が NULL のレコードは対象外。
UPDATE engagement_metrics em
SET posted_at = (
  SELECT ph.created_at
  FROM post_history ph
  WHERE ph.id = em.post_id
)
WHERE em.posted_at IS NULL
  AND em.post_id IS NOT NULL;

-- 3. インデックス（カテゴリー × 投稿日時の複合インデックス）
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_posted_at
  ON engagement_metrics (posted_at DESC)
  WHERE posted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_engagement_metrics_category_posted_at
  ON engagement_metrics (category, posted_at DESC)
  WHERE posted_at IS NOT NULL AND status = '報告済';

-- 4. コメント
COMMENT ON COLUMN engagement_metrics.posted_at IS
  '投稿が公開された完全なタイムスタンプ (TIMESTAMPTZ)。post_history.created_at から取得。post_time (HH:MM:SS) と day_of_week (0-6) の元データ。';
