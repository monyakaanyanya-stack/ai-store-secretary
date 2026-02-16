# マイグレーションガイド

## 会話履歴機能の追加（2024/01/16）

会話履歴テーブルを追加して、自然な会話を可能にします。

### Supabaseでマイグレーションを実行

1. Supabaseダッシュボードにログイン
2. **SQL Editor** を開く
3. 以下のSQLを実行：

```sql
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
```

### 確認

以下のクエリで、テーブルが正しく作成されたか確認できます：

```sql
SELECT * FROM conversation_history LIMIT 1;
```

### ロールバック（元に戻す場合）

```sql
DROP TABLE IF EXISTS conversation_history CASCADE;
```

## 機能説明

この更新により、以下が可能になります：

- **自然な会話**: 「昨日の投稿見せて」「これって何ができるの？」など、自然な言葉で質問できる
- **文脈の保持**: 過去の会話を覚えているので、「それ」「あれ」などの代名詞も理解できる
- **柔軟な応答**: Claudeが店舗情報や投稿履歴を考慮して、適切に応答

従来のコマンド（「登録」「報告:」など）も引き続き使用できます。
