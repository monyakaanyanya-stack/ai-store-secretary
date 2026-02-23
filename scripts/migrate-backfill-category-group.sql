-- =============================================================
-- Migration: engagement_metrics.category_group の NULL を補完
-- =============================================================
-- 実行場所: Supabase Dashboard > SQL Editor
-- 実行順序: このファイルを 1 回だけ実行
--
-- 背景:
--   saveEngagementMetrics() は保存時に category_group を設定しているが、
--   このマイグレーション以前に投入されたデータは category_group = NULL のまま。
--   getGroupInsights() は category_group で検索するため、NULL データは
--   グループレベルの集合知に使われない（BUG #5）。
-- =============================================================

-- 1. まず現状を確認
SELECT
  category_group,
  COUNT(*) AS count
FROM engagement_metrics
GROUP BY category_group
ORDER BY count DESC;

-- 2. 既知カテゴリーに category_group を割り当てる
--    ※ カテゴリーグループのマッピングを直接更新

-- 美容系（beauty）
UPDATE engagement_metrics
SET category_group = '美容系'
WHERE category_group IS NULL
  AND category IN (
    'ネイルサロン', 'ヘアサロン', '美容室', 'エステサロン', '脱毛サロン',
    'まつ毛サロン', 'アイラッシュ', '美容クリニック', '眉毛サロン',
    'リラクゼーション', 'マッサージ', 'リラクゼーションサロン',
    'ネイル', '美容院', 'ヘア'
  );

-- 飲食系（food）
UPDATE engagement_metrics
SET category_group = '飲食系'
WHERE category_group IS NULL
  AND category IN (
    'カフェ', 'コーヒースタンド', 'コーヒー専門店', 'ベーカリー', 'パン屋',
    'ケーキ屋', 'スイーツショップ', 'パティスリー', '和菓子店',
    'レストラン', '居酒屋', 'バー', 'ラーメン店', '寿司店',
    '焼き鳥', 'イタリアン', 'フレンチ', 'ビストロ', '食堂', '定食屋',
    'テイクアウト専門店', 'フードトラック', 'ファストフード',
    '弁当店', 'デリカテッセン'
  );

-- 小売系（retail）
UPDATE engagement_metrics
SET category_group = '小売系'
WHERE category_group IS NULL
  AND category IN (
    'アパレルショップ', 'セレクトショップ', '古着屋', 'リサイクルショップ',
    '雑貨店', 'インテリアショップ', '書店', '文具店', 'おもちゃ店',
    'アクセサリーショップ', 'ジュエリーショップ', '靴屋', 'バッグ店',
    'スポーツ用品店', 'アウトドアショップ', 'コスメショップ',
    'フラワーショップ', '花屋', 'ペットショップ', '食料品店'
  );

-- サービス系（service）
UPDATE engagement_metrics
SET category_group = 'サービス系'
WHERE category_group IS NULL
  AND category IN (
    'ヨガスタジオ', 'フィットネスジム', 'ピラティススタジオ', 'ダンススタジオ',
    '写真スタジオ', 'フォトスタジオ', '学習塾', 'スクール', 'カルチャースクール',
    '音楽教室', '料理教室', 'アートスクール', 'ゴルフスクール',
    'ビューティースクール', 'カイロプラクティック', '整体', '接骨院',
    'クリーニング店', 'リペアショップ', 'カーサービス'
  );

-- 専門職系（professional）
UPDATE engagement_metrics
SET category_group = '専門職系'
WHERE category_group IS NULL
  AND category IN (
    '税理士事務所', '司法書士', '弁護士事務所', '社会保険労務士',
    '不動産会社', 'コンサルタント', 'ファイナンシャルプランナー',
    '建築設計事務所', 'ITサービス', 'ウェブ制作', 'マーケティング会社'
  );

-- クリエイティブ系（creative）
UPDATE engagement_metrics
SET category_group = 'クリエイティブ系'
WHERE category_group IS NULL
  AND category IN (
    'ハンドメイド作家', 'アーティスト', 'イラストレーター', 'デザイナー',
    'フォトグラファー', '陶芸家', 'ガラス工芸', 'アクセサリー作家',
    'キャンドル作家', 'レザークラフト', '木工作家'
  );

-- 3. 上記に当てはまらなかった NULL は 'other' で補完
UPDATE engagement_metrics
SET category_group = 'other'
WHERE category_group IS NULL;

-- 4. 補完結果を確認
SELECT
  category_group,
  COUNT(*) AS count
FROM engagement_metrics
GROUP BY category_group
ORDER BY count DESC;

-- =============================================================
-- 注意: 手動で管理者コマンド経由で投入したテストデータの
-- category が辞書外の場合は 'other' になります。
-- カテゴリー辞書を参照して必要に応じて手動で修正してください。
-- =============================================================
