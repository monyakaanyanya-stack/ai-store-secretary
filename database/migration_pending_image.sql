-- 画像投稿フローの「一言ヒント質問」機能用
-- users テーブルに pending_image_context カラムを追加

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pending_image_context JSONB;

-- 格納データ例:
-- {
--   "messageId": "LINE_MESSAGE_ID",
--   "imageDescription": "AIが分析した画像説明テキスト",
--   "storeId": "UUID",
--   "createdAt": "2026-02-26T10:00:00Z"
-- }
