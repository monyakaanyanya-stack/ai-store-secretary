-- engagement_metrics.post_id に UNIQUE 制約を追加
-- collectiveIntelligence.js の upsert({ onConflict: 'post_id' }) が正しく動作するために必要
--
-- 注意: 既存の重複 post_id がある場合は先にクリーンアップが必要
-- 以下のクエリで重複を確認:
--   SELECT post_id, COUNT(*) FROM engagement_metrics WHERE post_id IS NOT NULL GROUP BY post_id HAVING COUNT(*) > 1;

-- NULL は UNIQUE 制約では重複扱いされないため、post_id が NULL のレコードは複数存在可能
ALTER TABLE engagement_metrics
  ADD CONSTRAINT engagement_metrics_post_id_unique UNIQUE (post_id);
