-- =============================================
-- AI Store Secretary - Status Column Migration
-- 報告ステータスカラムの追加
-- =============================================

-- engagement_metrics に status カラムを追加
ALTER TABLE engagement_metrics
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT '未報告';

-- 既存データの整理：いいね or 保存が入っているレコードは「報告済」に
UPDATE engagement_metrics
  SET status = '報告済'
  WHERE (likes_count > 0 OR saves_count > 0)
    AND (status IS NULL OR status = '未報告');

-- インデックス追加（status でのフィルタリング用）
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_status
  ON engagement_metrics (status);

-- コメント
COMMENT ON COLUMN engagement_metrics.status IS
  '報告ステータス: 未報告（投稿生成時のデフォルト） / 報告済（エンゲージメント数値が入力された）。学習・集合知の分析は報告済のみを対象にする。';
