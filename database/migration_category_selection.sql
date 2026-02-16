-- =============================================
-- Category Selection Migration
-- オンボーディング状態テーブルの作成とカテゴリー選択用カラムを追加
-- =============================================

-- onboarding_state テーブルを作成（存在しない場合）
CREATE TABLE IF NOT EXISTS onboarding_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  step VARCHAR(50) NOT NULL,
  selected_group VARCHAR(50),
  selected_category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスを追加（検索効率化）
CREATE INDEX IF NOT EXISTS idx_onboarding_state_user_id ON onboarding_state(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_state_step ON onboarding_state(step);
