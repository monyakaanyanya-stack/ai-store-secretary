-- 会話履歴テーブル
CREATE TABLE IF NOT EXISTS conversation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_conversation_history_user_id ON conversation_history(user_id);
CREATE INDEX idx_conversation_history_created_at ON conversation_history(created_at);

-- RLS (Row Level Security) 有効化
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;

-- ポリシー: 認証不要（LINEボット用）
CREATE POLICY "Allow all operations for service role" ON conversation_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE conversation_history IS '会話履歴テーブル - ユーザーとAIの会話を記録';
COMMENT ON COLUMN conversation_history.role IS 'ロール: user（ユーザー） または assistant（AI）';
COMMENT ON COLUMN conversation_history.content IS '会話内容';
