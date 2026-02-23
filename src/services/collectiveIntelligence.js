import { supabase } from './supabaseService.js';
import { getCategoryGroup, normalizeCategory } from '../config/categoryDictionary.js';
import { validateEngagementMetrics, isStatisticalOutlier } from '../config/validationRules.js';
import { analyzePostStructure, extractWinningPattern } from '../utils/postAnalyzer.js';

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
    .eq('status', '報告済')                          // 未報告（数値ゼロ）を除外
    .order('save_intensity', { ascending: false })  // 保存強度でランキング
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
    .eq('status', '報告済')                          // 未報告（数値ゼロ）を除外
    .order('save_intensity', { ascending: false })  // 保存強度でランキング
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

  // ハッシュタグの保存強度分析（使用回数ではなく保存強度で判定）
  const hashtagMetrics = {};
  data.forEach(post => {
    // H3修正: saves_countがnullの場合のNaN防止（null/N = NaN → 集計が壊れる）
    const intensity = post.save_intensity != null ? post.save_intensity
      : (post.likes_count > 0 && post.saves_count != null ? (post.saves_count / post.likes_count) : 0);

    if (Array.isArray(post.hashtags)) {
      post.hashtags.forEach(tag => {
        if (!hashtagMetrics[tag]) hashtagMetrics[tag] = { intensities: [], count: 0 };
        hashtagMetrics[tag].intensities.push(intensity);
        hashtagMetrics[tag].count++;
      });
    }
  });

  // 平均保存強度でソート（データが少ない場合は1件からでも反映）
  const minCount = Object.values(hashtagMetrics).some(d => d.count >= 3) ? 3 : 1;
  const topHashtags = Object.entries(hashtagMetrics)
    .filter(([, d]) => d.count >= minCount)
    .map(([tag, d]) => ({
      tag,
      avgSaveIntensity: d.intensities.reduce((a, b) => a + b, 0) / d.intensities.length,
    }))
    .sort((a, b) => b.avgSaveIntensity - a.avgSaveIntensity)
    .slice(0, 10)
    .map(item => item.tag);

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

  // 保存強度の平均（メイン指標）— H3修正: NaN防止
  const avgSaveIntensity = data.reduce((sum, post) => {
    const si = post.save_intensity != null ? post.save_intensity
      : (post.likes_count > 0 && post.saves_count != null ? post.saves_count / post.likes_count : 0);
    return sum + si;
  }, 0) / data.length;

  // 上位20件の保存強度平均 — H3修正: NaN防止
  const topPostsAvgSaveIntensity = topPosts.reduce((sum, post) => {
    const si = post.save_intensity != null ? post.save_intensity
      : (post.likes_count > 0 && post.saves_count != null ? post.saves_count / post.likes_count : 0);
    return sum + si;
  }, 0) / topPosts.length;

  // 全データからスコア順で「勝ちパターン」を抽出（最低10件必要）
  // extractWinningPattern内でscore=保存×3+いいねでソート・上位30%のみ抽出
  const winningPattern = extractWinningPattern(data, 10);

  return {
    topHashtags,
    avgLength: Math.round(avgLength),
    avgEmojiCount: Math.round(avgEmojiCount),
    topPostsAvgLength: Math.round(topPostsAvgLength),
    avgSaveIntensity: parseFloat(avgSaveIntensity.toFixed(3)),
    topPostsAvgSaveIntensity: parseFloat(topPostsAvgSaveIntensity.toFixed(3)),
    winningPattern, // 勝ちパターン（10件以上でないとnull）
    bestPostingHours,
    sampleSize: data.length,
    // engagement_rate は実リーチ入力ありのデータのみ平均（信頼性のある値だけ使う）
    avgEngagementRate: (() => {
      const realReachData = data.filter(p => p.reach_actual > 0 && p.engagement_rate > 0);
      if (realReachData.length === 0) return null;
      return parseFloat((realReachData.reduce((sum, p) => sum + p.engagement_rate, 0) / realReachData.length).toFixed(2));
    })(),
  };
}

/**
 * ブレンド型集合知を取得（50% 自店舗 + 30% 同カテゴリー + 20% 大グループ）
 * @param {string} storeId - 店舗ID
 * @param {string} category - 詳細カテゴリー
 * @returns {Object} - ブレンドされた集合知
 */
export async function getBlendedInsights(storeId, category) {
  const categoryGroup = getCategoryGroup(category) ?? 'other';

  // 自店舗の学習データ（50%）
  const ownData = await getOwnStoreInsights(storeId);

  // 同カテゴリーの集合知（30%）
  const categoryData = await getCategoryInsights(category);

  // 大グループの集合知（20%）
  const groupData = await getGroupInsights(categoryGroup);

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
    .eq('status', '報告済')          // 未報告（数値ゼロ）を除外
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
    avgSaveIntensity: 0,
    topPostsAvgSaveIntensity: 0,
    winningPattern: null,
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
  // ラベルを正規化（表記ゆれ吸収: "cafe"→"カフェ", "カフェ "→"カフェ"）
  const normalizedCategory = normalizeCategory(category) || category;
  const categoryGroup = getCategoryGroup(normalizedCategory) ?? 'other';

  // NaN防止: 数値フィールドをサニタイズ（NaNが入るとDB全体の集計が壊れる）
  const safeLikes = Number.isFinite(metrics.likes_count) ? metrics.likes_count : 0;
  const safeSaves = Number.isFinite(metrics.saves_count) ? metrics.saves_count : 0;
  const safeComments = Number.isFinite(metrics.comments_count) ? metrics.comments_count : 0;
  const safeReach = Number.isFinite(metrics.reach) ? metrics.reach : 0;
  const safeReachActual = Number.isFinite(metrics.reach_actual) ? metrics.reach_actual : 0;
  const safeEngRate = Number.isFinite(metrics.engagement_rate) ? metrics.engagement_rate : 0;
  const safeSaveIntensity = Number.isFinite(metrics.save_intensity) ? metrics.save_intensity : 0;
  const safeReactionIndex = Number.isFinite(metrics.reaction_index) ? metrics.reaction_index : 0;

  // ステータス判定：いいね or 保存が入っていれば「報告済」、なければ「未報告」
  // 未報告レコードは集合知・勝ちパターンの学習対象から除外される
  const isReported = (safeLikes > 0 || safeSaves > 0);

  // データ準備
  const metricsData = {
    store_id: storeId,
    post_id: postData.post_id || null,
    category: normalizedCategory,
    category_group: categoryGroup,
    post_content: postData.content,
    hashtags: extractHashtags(postData.content),
    post_length: postData.content?.length || 0,
    emoji_count: countEmojis(postData.content),
    likes_count: safeLikes,
    saves_count: safeSaves,
    comments_count: safeComments,
    reach: safeReach,
    reach_actual: safeReachActual,
    engagement_rate: safeEngRate,
    save_intensity: safeSaveIntensity,
    reaction_index: safeReactionIndex,
    post_structure: analyzePostStructure(postData.content), // 投稿骨格を解析して保存
    post_time: new Date().toTimeString().slice(0, 8),
    day_of_week: new Date().getDay(),
    status: isReported ? '報告済' : '未報告',
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
        // C18修正: 外れ値の詳細をログに残す（デバッグ用）
        const mean = likesValues.reduce((sum, v) => sum + v, 0) / likesValues.length;
        const variance = likesValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / likesValues.length;
        const stdDev = Math.sqrt(variance);
        console.warn('[CollectiveIntelligence] 統計的外れ値を検出（いいね数）:', {
          value: metrics.likes_count,
          category,
          mean: Math.round(mean),
          stdDev: Math.round(stdDev),
          threshold: `${Math.round(mean + 3 * stdDev)}以下が正常範囲`,
          sampleSize: likesValues.length,
        });

        return {
          success: false,
          validation: {
            isValid: false,
            errors: [`いいね数 ${metrics.likes_count} が統計的外れ値です（カテゴリー平均${Math.round(mean)}、3σ=${Math.round(mean + 3 * stdDev)}）`],
          },
          message: `統計的に異常なデータが検出されたため保存されませんでした（いいね数: ${metrics.likes_count}、カテゴリー平均: ${Math.round(mean)}）`,
        };
      }
    }
  }

  // バリデーション通過 → データベースに保存
  // C12修正: TOCTOU レース条件を排除 — upsert で原子的に処理
  let error;

  if (metricsData.post_id) {
    // post_idがある場合: upsert（存在すれば更新、なければ作成）
    // ※ DB側に engagement_metrics.post_id の UNIQUE制約が必要
    //   なければ INSERT で重複が出るが、UPDATE の select→update 間の
    //   レース条件よりは安全
    const { error: upsertError } = await supabase
      .from('engagement_metrics')
      .upsert(metricsData, { onConflict: 'post_id', ignoreDuplicates: false });
    error = upsertError;

    // H5修正: 演算子優先順位バグ修正（&&が||より先に評価されていた）
    if (error && (error.message?.includes('unique') || error.message?.includes('constraint'))) {
      console.warn('[CollectiveIntelligence] upsert失敗、フォールバック:', error.message);
      const { data: existing } = await supabase
        .from('engagement_metrics')
        .select('id')
        .eq('post_id', metricsData.post_id)
        .single();

      if (existing) {
        const { error: updateError } = await supabase
          .from('engagement_metrics')
          .update(metricsData)
          .eq('id', existing.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('engagement_metrics')
          .insert(metricsData);
        error = insertError;
      }
    }

    if (!error) {
      console.log(`[CollectiveIntelligence] メトリクスupsert成功`);
    }
  } else {
    // post_idがない場合は常に新規作成
    const { error: insertError } = await supabase
      .from('engagement_metrics')
      .insert(metricsData);
    error = insertError;
    if (!error) {
      console.log(`[CollectiveIntelligence] メトリクス新規作成（post_idなし）`);
    }
  }

  if (error) {
    console.error('[CollectiveIntelligence] メトリクス保存エラー:', error.message);
    return {
      success: false,
      validation,
      message: `保存エラー: ${error.message}`,
    };
  }

  console.log(`[CollectiveIntelligence] メトリクス保存成功: store=${storeId?.slice(0, 4)}…, category=${category}`);
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

/**
 * 'other' グループ内で店舗数が閾値を超えたカテゴリーを検出
 * @param {number} threshold - 店舗数の閾値（デフォルト5）
 * @returns {Array<{category: string, storeCount: number}>} - 昇格候補リスト
 */
export async function detectPopularOtherCategories(threshold = 5) {
  // H16修正: ページング制限を追加（メモリ溢れ防止）
  const { data, error } = await supabase
    .from('engagement_metrics')
    .select('category, store_id')
    .eq('category_group', 'other')
    .limit(5000);

  if (error || !data) {
    console.error('[CollectiveIntelligence] other カテゴリー検出エラー:', error?.message);
    return [];
  }

  // カテゴリーごとにユニーク店舗数をカウント
  const categoryStores = {};
  for (const row of data) {
    if (!categoryStores[row.category]) {
      categoryStores[row.category] = new Set();
    }
    categoryStores[row.category].add(row.store_id);
  }

  return Object.entries(categoryStores)
    .filter(([, stores]) => stores.size >= threshold)
    .map(([category, stores]) => ({ category, storeCount: stores.size }))
    .sort((a, b) => b.storeCount - a.storeCount);
}
