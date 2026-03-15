-- migration_post_features_v2.sql
-- post_features テーブルに3カラム追加: color_tone, subject_density, composition_type

ALTER TABLE post_features ADD COLUMN IF NOT EXISTS color_tone TEXT DEFAULT 'neutral';
ALTER TABLE post_features ADD COLUMN IF NOT EXISTS subject_density TEXT DEFAULT 'single';
ALTER TABLE post_features ADD COLUMN IF NOT EXISTS composition_type TEXT DEFAULT 'center';
