-- PDCA自動チューニング: 全ユーザーのフィードバック傾向を集約したグローバルプロンプトルール
-- 毎週日曜にbelief_logsを分析し、3店舗以上に共通するパターンを自動抽出

CREATE TABLE IF NOT EXISTS global_prompt_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_summary TEXT,
  analyzed_store_count INTEGER DEFAULT 0,
  analyzed_belief_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 最新のルールを素早く取得するためのインデックス
CREATE INDEX IF NOT EXISTS idx_global_prompt_rules_created_at
ON global_prompt_rules (created_at DESC);

-- コメント
COMMENT ON TABLE global_prompt_rules IS '全ユーザーのフィードバック傾向から自動抽出されたプロンプトルール（PDCA自動チューニング）';
COMMENT ON COLUMN global_prompt_rules.rules IS 'ルール配列 例: ["文字数は控えめに", "絵文字は2個以内"]';
COMMENT ON COLUMN global_prompt_rules.analysis_summary IS '分析結果の要約（管理者向け）';
