-- pending_command: 「直し」「学習」ボタンを押した後の入力待ち状態を保存
-- 'revision' = 次のメッセージを「直し:」として処理
-- 'style_learning' = 次のメッセージを「学習:」として処理
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_command VARCHAR(32);
