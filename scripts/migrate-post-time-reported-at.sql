-- =============================================================
-- Migration: post_time を「真の投稿時刻」専用に整理
--            + reported_at（メトリクス報告時刻）カラムを追加
-- =============================================================
-- 実行場所: Supabase Dashboard > SQL Editor
-- 実行順序: このファイルを 1 回だけ実行
-- =============================================================

-- 1. reported_at カラムを追加（メトリクスを報告した時刻）
ALTER TABLE engagement_metrics
  ADD COLUMN IF NOT EXISTS reported_at timestamptz;

-- 2. 既存データの退避
--    post_time は "HH:MM:SS" 文字列で入っており日付が不明なため、
--    「いつ報告されたか」の近似値として created_at を reported_at に移す。
--    post_time は NULL にリセット（正確な投稿時刻が分からないため）
UPDATE engagement_metrics
SET
  reported_at = COALESCE(reported_at, created_at),
  post_time   = NULL
WHERE reported_at IS NULL;

-- 3. 新規レコードのデフォルト: reported_at は INSERT 時刻
--    （アプリ側で明示的に渡す。未設定時のフォールバックとして now() を使う）
ALTER TABLE engagement_metrics
  ALTER COLUMN reported_at SET DEFAULT now();

-- 4. インデックス（時系列分析に使う可能性があるため）
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_reported_at
  ON engagement_metrics (reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_engagement_metrics_post_time
  ON engagement_metrics (post_time)
  WHERE post_time IS NOT NULL;

-- 5. コメントで意味を明示
COMMENT ON COLUMN engagement_metrics.post_time IS
  '投稿を公開した時刻 (HH:MM:SS JST)。post_history.created_at から取得。不明な場合は NULL。';

COMMENT ON COLUMN engagement_metrics.reported_at IS
  'ユーザーがエンゲージメント数値を報告した時刻 (timestamptz)。';
