-- 集合知データの初期投入スクリプト
-- 実行方法: Supabase Dashboard > SQL Editor でこのスクリプトを実行
--
-- いいね数: 5-100（小規模アカウント向けの現実的な範囲）
-- 保存数: いいねの10-25%
-- コメント数: いいねの5-15%
-- リーチ: (いいね+保存+コメント) / ER × 100 で整合性を保持
-- ER: 3.5-5.5%（エンゲージメント率の整合性チェックに対応）

-- ==================================================
-- 美容系グループ
-- ==================================================

-- ネイルサロン（50件）
INSERT INTO engagement_metrics (
  store_id, category, category_group, post_content, hashtags,
  post_length, emoji_count, likes_count, saves_count, comments_count,
  reach, engagement_rate, post_time, day_of_week
)
SELECT
  gen_random_uuid(),
  'ネイルサロン',
  '美容系',
  '新作ネイルデザイン登場✨ 春にぴったりの淡色ニュアンスネイル💅 ご予約受付中です！',
  ARRAY['#ネイルデザイン', '#ジェルネイル', '#トレンドネイル', '#ワンホンネイル', '#韓国ネイル', '#ニュアンスネイル', '#マグネットネイル', '#個性派ネイル', '#オフィスネイル', '#シンプルネイル'],
  180 + floor(random() * 40)::int,
  4 + floor(random() * 2)::int,
  5 + floor(random() * 95)::int,   -- 5-100いいね
  1 + floor(random() * 14)::int,   -- 1-15保存
  0 + floor(random() * 8)::int,    -- 0-8コメント
  200 + floor(random() * 1800)::int, -- 200-2000リーチ（ERの整合性のため広めに）
  3.5 + random() * 2.0,             -- 3.5-5.5%ER
  (ARRAY['20:00:00', '21:00:00', '22:00:00'])[floor(random() * 3 + 1)],
  floor(random() * 7)::int
FROM generate_series(1, 50);

-- 美容室（50件）
INSERT INTO engagement_metrics (
  store_id, category, category_group, post_content, hashtags,
  post_length, emoji_count, likes_count, saves_count, comments_count,
  reach, engagement_rate, post_time, day_of_week
)
SELECT
  gen_random_uuid(),
  '美容室',
  '美容系',
  '髪質改善トリートメントで艶髪に✨ ビフォーアフターをご覧ください🌟 ご予約お待ちしております！',
  ARRAY['#髪質改善', '#似合わせカット', '#小顔カット', '#レイヤーカット', '#韓国ヘア', '#顔周りカット', '#ショートヘア', '#ボブ', '#透明感カラー', '#グレージュ'],
  190 + floor(random() * 40)::int,
  3 + floor(random() * 2)::int,
  5 + floor(random() * 95)::int,
  1 + floor(random() * 14)::int,
  0 + floor(random() * 8)::int,
  200 + floor(random() * 1800)::int,
  3.5 + random() * 2.0,
  (ARRAY['19:00:00', '20:00:00', '21:00:00'])[floor(random() * 3 + 1)],
  floor(random() * 7)::int
FROM generate_series(1, 50);

-- エステサロン（50件）
INSERT INTO engagement_metrics (
  store_id, category, category_group, post_content, hashtags,
  post_length, emoji_count, likes_count, saves_count, comments_count,
  reach, engagement_rate, post_time, day_of_week
)
SELECT
  gen_random_uuid(),
  'エステサロン',
  '美容系',
  '小顔矯正で理想のフェイスラインへ💆‍♀️ 施術の流れをご紹介します✨ お気軽にご相談ください！',
  ARRAY['#小顔矯正', '#肌質改善', '#自分磨き', '#ハーブピーリング', '#毛穴ケア', '#美白ケア', '#痩身エステ', '#ブライダルエステ', '#美意識向上', '#アンチエイジング'],
  200 + floor(random() * 40)::int,
  3 + floor(random() * 2)::int,
  5 + floor(random() * 95)::int,
  1 + floor(random() * 14)::int,
  0 + floor(random() * 8)::int,
  200 + floor(random() * 1800)::int,
  3.5 + random() * 2.0,
  (ARRAY['21:00:00', '22:00:00', '23:00:00'])[floor(random() * 3 + 1)],
  floor(random() * 7)::int
FROM generate_series(1, 50);

-- ==================================================
-- 飲食系グループ
-- ==================================================

-- カフェ（50件）
INSERT INTO engagement_metrics (
  store_id, category, category_group, post_content, hashtags,
  post_length, emoji_count, likes_count, saves_count, comments_count,
  reach, engagement_rate, post_time, day_of_week
)
SELECT
  gen_random_uuid(),
  'カフェ',
  '飲食系',
  '新作パフェが登場しました🍓 テラス席で春の陽気を感じながらゆったりカフェタイム☕ 皆様のご来店お待ちしております！',
  ARRAY['#カフェ巡り', '#カフェ部', '#淡色カフェ', '#韓国風カフェ', '#無機質カフェ', '#夜カフェ', '#隠れ家カフェ', '#テラス席があるお店', '#インスタ映え', '#フォトジェニック'],
  170 + floor(random() * 40)::int,
  5 + floor(random() * 2)::int,
  5 + floor(random() * 95)::int,
  1 + floor(random() * 14)::int,
  0 + floor(random() * 8)::int,
  200 + floor(random() * 1800)::int,
  3.5 + random() * 2.0,
  (ARRAY['10:00:00', '11:00:00', '12:00:00'])[floor(random() * 3 + 1)],
  floor(random() * 7)::int
FROM generate_series(1, 50);

-- ベーカリー（50件）
INSERT INTO engagement_metrics (
  store_id, category, category_group, post_content, hashtags,
  post_length, emoji_count, likes_count, saves_count, comments_count,
  reach, engagement_rate, post_time, day_of_week
)
SELECT
  gen_random_uuid(),
  'ベーカリー',
  '飲食系',
  '焼き立てクロワッサン🥐 サクサクの食感がたまりません✨ 朝7時からオープンしています！',
  ARRAY['#パン屋巡り', '#パンスタグラム', '#焼き立てパン', '#朝ごパン', '#パン好き', '#クロワッサン', '#ハード系パン', '#惣菜パン', '#パンのある暮らし', '#パン活'],
  160 + floor(random() * 40)::int,
  4 + floor(random() * 2)::int,
  5 + floor(random() * 95)::int,
  1 + floor(random() * 14)::int,
  0 + floor(random() * 8)::int,
  200 + floor(random() * 1800)::int,
  3.5 + random() * 2.0,
  (ARRAY['07:00:00', '08:00:00', '09:00:00'])[floor(random() * 3 + 1)],
  floor(random() * 7)::int
FROM generate_series(1, 50);

-- スイーツ店（50件）
INSERT INTO engagement_metrics (
  store_id, category, category_group, post_content, hashtags,
  post_length, emoji_count, likes_count, saves_count, comments_count,
  reach, engagement_rate, post_time, day_of_week
)
SELECT
  gen_random_uuid(),
  'スイーツ店',
  '飲食系',
  '断面が美しいケーキが入荷しました🍰✨ 限定10個です💕 お早めにどうぞ！',
  ARRAY['#スイーツ部', '#映えスイーツ', '#ご褒美スイーツ', '#今日のおやつ', '#デパ地下スイーツ', '#期間限定スイーツ', '#お取り寄せスイーツ', '#自分へのご褒美', '#手土産スイーツ', '#断面萌え'],
  150 + floor(random() * 40)::int,
  6 + floor(random() * 2)::int,
  5 + floor(random() * 95)::int,
  1 + floor(random() * 14)::int,
  0 + floor(random() * 8)::int,
  200 + floor(random() * 1800)::int,
  3.5 + random() * 2.0,
  (ARRAY['15:00:00', '16:00:00', '17:00:00'])[floor(random() * 3 + 1)],
  floor(random() * 7)::int
FROM generate_series(1, 50);

-- ==================================================
-- 小売・サービス系グループ
-- ==================================================

-- アパレル（50件）
INSERT INTO engagement_metrics (
  store_id, category, category_group, post_content, hashtags,
  post_length, emoji_count, likes_count, saves_count, comments_count,
  reach, engagement_rate, post_time, day_of_week
)
SELECT
  gen_random_uuid(),
  'アパレル',
  '小売系',
  '今週の着回しコーデ👗 同じアイテムで7通りの着こなし方をご紹介💡 低身長さんにもおすすめです！',
  ARRAY['#着回しコーデ', '#今日のコーデ', '#ootd', '#大人カジュアル', '#きれいめコーデ', '#低身長コーデ', '#プチプラコーデ', '#淡色女子', '#骨格ストレート', '#垢抜けコーデ'],
  180 + floor(random() * 40)::int,
  4 + floor(random() * 2)::int,
  5 + floor(random() * 95)::int,
  1 + floor(random() * 14)::int,
  0 + floor(random() * 8)::int,
  200 + floor(random() * 1800)::int,
  3.5 + random() * 2.0,
  (ARRAY['20:00:00', '21:00:00', '22:00:00'])[floor(random() * 3 + 1)],
  floor(random() * 7)::int
FROM generate_series(1, 50);

-- 雑貨店（50件）
INSERT INTO engagement_metrics (
  store_id, category, category_group, post_content, hashtags,
  post_length, emoji_count, likes_count, saves_count, comments_count,
  reach, engagement_rate, post_time, day_of_week
)
SELECT
  gen_random_uuid(),
  '雑貨店',
  '小売系',
  'キッチンに置くだけで暮らしが整う便利グッズ🌿 シンプルで使いやすいデザインです✨ 新生活にもおすすめ！',
  ARRAY['#暮らしを整える', '#暮らしを楽しむ', '#丁寧な暮らし', '#インテリア雑貨', '#キッチン雑貨', '#北欧雑貨', '#韓国雑貨', '#お部屋作り', '#ミニマリスト', '#生活の質を上げる'],
  190 + floor(random() * 40)::int,
  3 + floor(random() * 2)::int,
  5 + floor(random() * 95)::int,
  1 + floor(random() * 14)::int,
  0 + floor(random() * 8)::int,
  200 + floor(random() * 1800)::int,
  3.5 + random() * 2.0,
  (ARRAY['21:00:00', '22:00:00', '23:00:00'])[floor(random() * 3 + 1)],
  floor(random() * 7)::int
FROM generate_series(1, 50);

-- フォトグラファー（50件）
INSERT INTO engagement_metrics (
  store_id, category, category_group, post_content, hashtags,
  post_length, emoji_count, likes_count, saves_count, comments_count,
  reach, engagement_rate, post_time, day_of_week
)
SELECT
  gen_random_uuid(),
  'フォトグラファー',
  'サービス系',
  '先日の撮影メイキング📸 自然光を活かしたポートレート撮影の裏側をご紹介します✨ 撮影依頼受付中です！',
  ARRAY['#ポートレート', '#写真好きな人と繋がりたい', '#ファインダー越しの私の世界', '#カメラ女子', '#出張撮影', '#家族写真', '#ウェディングフォト', '#宣材写真', '#撮影依頼受付中', '#キリトリセカイ'],
  170 + floor(random() * 40)::int,
  2 + floor(random() * 2)::int,
  5 + floor(random() * 95)::int,
  1 + floor(random() * 14)::int,
  0 + floor(random() * 8)::int,
  200 + floor(random() * 1800)::int,
  3.5 + random() * 2.0,
  (ARRAY['19:00:00', '20:00:00', '21:00:00'])[floor(random() * 3 + 1)],
  floor(random() * 7)::int
FROM generate_series(1, 50);

-- ヨガスタジオ（50件）
INSERT INTO engagement_metrics (
  store_id, category, category_group, post_content, hashtags,
  post_length, emoji_count, likes_count, saves_count, comments_count,
  reach, engagement_rate, post_time, day_of_week
)
SELECT
  gen_random_uuid(),
  'ヨガスタジオ',
  'サービス系',
  '朝のヨガで1日をスタート🧘‍♀️ 30秒でできる簡単ストレッチをご紹介します✨ 体験レッスン受付中です！',
  ARRAY['#ヨガライフ', '#ヨガジョ', '#宅トレ', '#ボディメイク', '#ヘルシーライフ', '#ダイエット記録', '#朝ヨガ', '#夜ヨガ', '#マインドフルネス', '#瞑想'],
  160 + floor(random() * 40)::int,
  3 + floor(random() * 2)::int,
  5 + floor(random() * 95)::int,
  1 + floor(random() * 14)::int,
  0 + floor(random() * 8)::int,
  200 + floor(random() * 1800)::int,
  3.5 + random() * 2.0,
  (ARRAY['06:00:00', '07:00:00', '21:00:00'])[floor(random() * 3 + 1)],
  floor(random() * 7)::int
FROM generate_series(1, 50);

-- ==================================================
-- 投入完了メッセージ
-- ==================================================

SELECT '集合知データの初期投入が完了しました！' AS message,
       COUNT(*) AS total_records,
       COUNT(DISTINCT category) AS categories
FROM engagement_metrics
WHERE created_at > NOW() - INTERVAL '1 minute';
