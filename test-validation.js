import { validateEngagementMetrics } from './src/config/validationRules.js';

// テストケース
const testCases = [
  {
    name: '正常データ（カフェ）',
    category: 'カフェ',
    metrics: {
      likes_count: 500,
      saves_count: 100,
      comments_count: 20,
      reach: 5000,
      engagement_rate: 12.4,
      post_length: 150,
      emoji_count: 5,
      hashtags: ['#カフェ', '#コーヒー', '#おしゃれカフェ']
    }
  },
  {
    name: '異常データ（いいね数が多すぎる）',
    category: 'カフェ',
    metrics: {
      likes_count: 99999, // 異常値
      saves_count: 100,
      comments_count: 20,
      reach: 5000,
      engagement_rate: 12.4
    }
  },
  {
    name: '異常データ（エンゲージメント率が100%超え）',
    category: 'カフェ',
    metrics: {
      likes_count: 500,
      saves_count: 100,
      comments_count: 20,
      reach: 5000,
      engagement_rate: 150 // 異常値
    }
  },
  {
    name: '異常データ（ハッシュタグ数が多すぎる）',
    category: 'カフェ',
    metrics: {
      likes_count: 500,
      saves_count: 100,
      comments_count: 20,
      reach: 5000,
      engagement_rate: 12.4,
      hashtags: new Array(40).fill('#test') // 40個（上限30個）
    }
  }
];

console.log('🧪 異常データ検出のテスト開始\n');

testCases.forEach((testCase, index) => {
  console.log(`\n--- テスト ${index + 1}: ${testCase.name} ---`);
  const result = validateEngagementMetrics(testCase.metrics, testCase.category);

  if (result.isValid) {
    console.log('✅ 正常データとして判定');
  } else {
    console.log('❌ 異常データとして判定');
    console.log('エラー内容:');
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
});

console.log('\n\n✅ テスト完了');
