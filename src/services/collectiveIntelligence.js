import { supabase } from './supabaseService.js';
import { getCategoryGroup } from '../config/categoryGroups.js';
import { validateEngagementMetrics, isStatisticalOutlier } from '../config/validationRules.js';

/**
 * 同じカテゴリーの店舗から集合知を取得
 * @param {string} category - 詳細カテゴリー
 * @param {number} limit - 取得件数
 * @returns {Object} - 集合知データ
 */
export async function getCategoryInsights(category, limit = 100) {
  if (!category) return getDefaultInsights();

  const { data, error } = await supabase
    .from('engagement_metrics')
    .select('*')
    .eq('category', category)
    .order('engagement_rate', { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) {
    return getDefaultInsights();
  }

  return analyzeEngagementData(data);
}

/**
 * 大カテゴリーグループの集合知を取得
 * @param {string} categoryGroup - 大カテゴリーグループ名
 * @param {number} limit - 取得件数
 * @returns {Object} - 集合知データ
 */
export async function getGroupInsights(categoryGroup, limit = 200) {
  if (!categoryGroup) return getDefaultInsights();

  // category_group フィールドを使って検索
  const { data, error } = await supabase
    .from('engagement_metrics')
    .select('*')
    .eq('category_group', categoryGroup)
    .order('engagement_rate', { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) {
    return getDefaultInsights();
  }

  return analyzeEngagementData(data);
}

/**
 * エンゲージメントデータを分析して集合知を抽出
 * @param {Array} data - engagement_metrics データ
 * @returns {Object} - 分析結果
 */
function analyzeEngagementData(data) {
  if (!data || data.length === 0) return getDefaultInsights();

  // ハッシュタグ頻度分析
  const hashtagFrequency = {};
  data.forEach(post => {
    if (post.hashtags) {
      post.hashtags.forEach(tag => {
        hashtagFrequency[tag] = (hashtagFrequency[tag] || 0) + 1;
      });
    }
  });

  const topHashtags = Object.entries(hashtagFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  // 投稿長の傾向分析
  const avgLength = data.reduce((sum, post) => sum + (post.post_length || 0), 0) / data.length;

  // 絵文字使用頻度
  const avgEmojiCount = data.reduce((sum, post) => sum + (post.emoji_count || 0), 0) / data.length;

  // エンゲージメント率の高い投稿の特徴
  const topPosts = data.slice(0, 20);
  const topPostsAvgLength = topPosts.reduce((sum, post) => sum + (post.post_length || 0), 0) / topPosts.length;

  // 投稿時間帯の分析
  const timeDistribution = {};
  data.forEach(post => {
    if (post.post_time) {
      const hour = new Date(post.post_time).getHours();
      timeDistribution[hour] = (timeDistribution[hour] || 0) + 1;
    }
  });

  const bestPostingHours = Object.entries(timeDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  return {
    topHashtags,
    avgLength: Math.round(avgLength),
    avgEmojiCount: Math.round(avgEmojiCount),
    topPostsAvgLength: Math.round(topPostsAvgLength),
    bestPostingHours,
    sampleSize: data.length,
    avgEngagementRate: data.reduce((sum, post) => sum + (post.engagement_rate || 0), 0) / data.length,
  };
}

/**
 * ブレンド型集合知を取得（50% 自店舗 + 30% 同カテゴリー + 20% 大グループ）
 * @param {string} storeId - 店舗ID
 * @param {string} category - 詳細カテゴリー
 * @returns {Object} - ブレンドされた集合知
 */
export async function getBlendedInsights(storeId, category) {
  const categoryGroup = getCategoryGroup(category);

  // 自店舗の学習データ（50%）
  const ownData = await getOwnStoreInsights(storeId);

  // 同カテゴリーの集合知（30%）
  const categoryData = await getCategoryInsights(category);

  // 大グループの集合知（20%）
  const groupData = categoryGroup ? await getGroupInsights(categoryGroup) : getDefaultInsights();

  return {
    own: ownData,
    category: categoryData,
    group: groupData,
    categoryGroup,
    blendRatio: { own: 50, category: 30, group: 20 },
  };
}

/**
 * 自店舗の学習データを取得
 * @param {string} storeId - 店舗ID
 * @returns {Object} - 自店舗の学習データ
 */
async function getOwnStoreInsights(storeId) {
  const { data, error } = await supabase
    .from('engagement_metrics')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) {
    return getDefaultInsights();
  }

  return analyzeEngagementData(data);
}

/**
 * デフォルトの集合知データ
 * @returns {Object} - デフォルト値
 */
function getDefaultInsights() {
  return {
    topHashtags: [],
    avgLength: 200,
    avgEmojiCount: 3,
    topPostsAvgLength: 200,
    bestPostingHours: [12, 18, 20],
    sampleSize: 0,
    avgEngagementRate: 0,
  };
}

/**
 * エンゲージメントメトリクスを保存（バリデーション付き）
 * @param {string} storeId - 店舗ID
 * @param {string} category - カテゴリー
 * @param {Object} postData - 投稿データ
 * @param {Object} metrics - エンゲージメント指標
 * @returns {Object} - { success: boolean, validation: Object }
 */
export async function saveEngagementMetrics(storeId, category, postData, metrics = {}) {
  const categoryGroup = getCategoryGroup(category);

  // データ準備
  const metricsData = {
    store_id: storeId,
    post_id: postData.post_id || null,
    category,
    category_group: categoryGroup,
    post_content: postData.content,
    hashtags: extractHashtags(postData.content),
    post_length: postData.content?.length || 0,
    emoji_count: countEmojis(postData.content),
    likes_count: metrics.likes_count || 0,
    saves_count: metrics.saves_count || 0,
    comments_count: metrics.comments_count || 0,
    reach: metrics.reach || 0,
    engagement_rate: metrics.engagement_rate || 0,
    post_time: new Date().toISOString(),
    day_of_week: new Date().getDay(),
  };

  // バリデーション実行
  const validation = validateEngagementMetrics(metricsData, category);

  if (!validation.isValid) {
    console.warn('[CollectiveIntelligence] バリデーションエラー:', validation.errors);
    console.warn('[CollectiveIntelligence] 異常データを保存しません:', metricsData);

    return {
      success: false,
      validation,
      message: '異常なデータが検出されたため保存されませんでした',
    };
  }

  // 統計的外れ値チェック（同カテゴリーの過去データと比較）
  if (category && metrics.likes_count > 0) {
    const { data: categoryData } = await supabase
      .from('engagement_metrics')
      .select('likes_count, engagement_rate')
      .eq('category', category)
      .order('created_at', { ascending: false })
      .limit(30);

    if (categoryData && categoryData.length >= 3) {
      const likesValues = categoryData.map(d => d.likes_count);
      const isLikesOutlier = isStatisticalOutlier(likesValues, metrics.likes_count);

      if (isLikesOutlier) {
        console.warn('[CollectiveIntelligence] 統計的外れ値を検出（いいね数）:', {
          value: metrics.likes_count,
          category,
          mean: likesValues.reduce((sum, v) => sum + v, 0) / likesValues.length,
        });

        return {
          success: false,
          validation: {
            isValid: false,
            errors: [`いいね数が統計的外れ値です: ${metrics.likes_count}（カテゴリー平均から3σ以上離れています）`],
          },
          message: '統計的に異常なデータが検出されたため保存されませんでした',
        };
      }
    }
  }

  // バリデーション通過 → データベースに保存
  const { error } = await supabase
    .from('engagement_metrics')
    .insert(metricsData);

  if (error) {
    console.error('[CollectiveIntelligence] メトリクス保存エラー:', error.message);
    return {
      success: false,
      validation,
      message: `保存エラー: ${error.message}`,
    };
  }

  console.log(`[CollectiveIntelligence] メトリクス保存成功: store=${storeId}, category=${category}`);
  return {
    success: true,
    validation,
    message: 'エンゲージメントデータを保存しました',
  };
}

/**
 * ハッシュタグを抽出
 * @param {string} text - 投稿テキスト
 * @returns {string[]} - ハッシュタグの配列
 */
function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#[^\s#]+/g);
  return matches ? matches.map(tag => tag.trim()) : [];
}

/**
 * 絵文字の数をカウント
 * @param {string} text - 投稿テキスト
 * @returns {number} - 絵文字の数
 */
function countEmojis(text) {
  if (!text) return 0;
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
}
