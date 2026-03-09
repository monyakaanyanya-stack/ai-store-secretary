import { supabase } from './supabaseService.js';
import { getInstagramAccount, graphApiRequestBase, INSTAGRAM_API_BASE, GRAPH_API_BASE } from './instagramService.js';
import { saveEngagementMetrics } from './collectiveIntelligence.js';
import { applyEngagementToProfile } from './personalizationEngine.js';
import { analyzeEngagementWithClaude } from './advancedPersonalization.js';

/**
 * 夜間エンゲージメント自動同期
 *
 * 毎晩 JST 2:00（UTC 17:00）にスケジューラーから呼ばれる
 * Instagram連携済みの全店舗の投稿メトリクスを取得し、
 * 学習パイプラインに流して次の投稿生成に自動反映する
 *
 * - Instagram API でいいね/保存/リーチを取得
 * - instagram_posts テーブルを最新メトリクスで更新
 * - post_history とマッチした投稿 → 集合知DB + 個人学習 + Claude分析
 * - LINE通知なし（サイレントバッチ）
 */
export async function runNightlyEngagementSync() {
  console.log('[NightlySync] エンゲージメント自動同期 開始');

  try {
    // Instagram連携済みの全アカウント取得
    const { data: accounts, error: accError } = await supabase
      .from('instagram_accounts')
      .select('*, stores!inner(id, name, category, follower_count)')
      .eq('is_active', true);

    if (accError) {
      console.error('[NightlySync] アカウント取得エラー:', accError.message);
      return;
    }

    if (!accounts || accounts.length === 0) {
      console.log('[NightlySync] Instagram連携済みアカウントなし');
      return;
    }

    let syncedStores = 0;
    let learnedPosts = 0;
    let updatedPosts = 0;
    let skippedStores = 0;
    let errorCount = 0;

    for (const account of accounts) {
      try {
        const result = await syncStoreEngagement(account);
        syncedStores++;
        learnedPosts += result.learned;
        updatedPosts += result.updated;

        // APIレート制限対策: 店舗間に500ms待機
        await sleep(500);
      } catch (err) {
        const storeName = account.stores?.name || account.store_id?.slice(0, 4);
        if (err.message.includes('有効期限')) {
          console.warn(`[NightlySync] トークン期限切れ: ${storeName} → スキップ`);
          skippedStores++;
        } else {
          console.error(`[NightlySync] 同期エラー: ${storeName}`, err.message);
          errorCount++;
        }
      }
    }

    console.log(`[NightlySync] 完了: 同期=${syncedStores}店舗, メトリクス更新=${updatedPosts}件, 学習=${learnedPosts}件, スキップ=${skippedStores}, エラー=${errorCount}`);
  } catch (err) {
    console.error('[NightlySync] 致命的エラー:', err.message);
  }
}

// ==================== 内部関数 ====================

/**
 * 1店舗分のエンゲージメント同期
 */
async function syncStoreEngagement(account) {
  const store = account.stores;
  const storeId = store.id;

  // トークン有効期限チェック
  if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
    throw new Error('アクセストークンの有効期限が切れています');
  }

  const igAccountId = account.instagram_user_id;
  const accessToken = account.access_token;

  // APIベース判定（IG トークン or Facebook トークン）
  const apiBase = accessToken.startsWith('IG') ? INSTAGRAM_API_BASE : GRAPH_API_BASE;

  // 直近10件の投稿メトリクスを取得
  const igPosts = await fetchLatestMetrics(apiBase, igAccountId, accessToken, 10);

  if (igPosts.length === 0) {
    return { updated: 0, learned: 0 };
  }

  let updated = 0;
  let learned = 0;

  for (const igPost of igPosts) {
    try {
      // instagram_posts テーブルを最新メトリクスで更新（既存レコード）
      const wasUpdated = await updateInstagramPostMetrics(igPost);
      if (wasUpdated) updated++;

      // learning_synced 済みならスキップ
      const { data: existingIgPost } = await supabase
        .from('instagram_posts')
        .select('id, learning_synced')
        .eq('media_id', igPost.mediaId)
        .single();

      if (existingIgPost?.learning_synced) continue;

      // いいねも保存もゼロなら学習対象外（投稿直後の可能性）
      if (igPost.likes === 0 && igPost.saves === 0) continue;

      // post_history とマッチング
      const matchedPost = await matchWithPostHistory(storeId, igPost);
      if (!matchedPost) continue;

      // 学習パイプライン実行
      await applyMetricsSilently(store, matchedPost, igPost);
      learned++;

      // learning_synced フラグを立てる
      if (existingIgPost) {
        await supabase
          .from('instagram_posts')
          .update({
            learning_synced: true,
            learning_synced_at: new Date().toISOString(),
          })
          .eq('id', existingIgPost.id);
      }
    } catch (postErr) {
      console.warn(`[NightlySync] 投稿処理エラー: ${igPost.mediaId}`, postErr.message);
    }
  }

  return { updated, learned };
}

/**
 * Instagram APIから直近投稿のメトリクスを取得
 */
async function fetchLatestMetrics(apiBase, igAccountId, accessToken, limit) {
  const apiRequest = (path, params) => graphApiRequestBase(apiBase, path, accessToken, params);

  const mediaList = await apiRequest(`/${igAccountId}/media`, {
    fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count',
    limit: String(limit),
  });

  if (!mediaList.data || mediaList.data.length === 0) {
    return [];
  }

  const results = [];

  for (const media of mediaList.data) {
    const likes = media.like_count || 0;
    const comments = media.comments_count || 0;

    // インサイト取得（reach, saved）
    let saves = 0;
    let reach = 0;
    try {
      const insights = await apiRequest(`/${media.id}/insights`, {
        metric: 'reach,saved',
      });
      if (insights.data) {
        insights.data.forEach(metric => {
          if (metric.name === 'saved') saves = metric.values?.[0]?.value ?? metric.value ?? 0;
          if (metric.name === 'reach') reach = metric.values?.[0]?.value ?? metric.value ?? 0;
        });
      }
    } catch (insightErr) {
      // インサイト取得失敗は警告のみ（古い投稿やリールで起きうる）
      console.log(`[NightlySync] インサイト取得スキップ: ${media.id}`);
    }

    results.push({
      mediaId: media.id,
      caption: media.caption || '',
      permalink: media.permalink,
      timestamp: media.timestamp,
      likes,
      comments,
      saves,
      reach,
    });
  }

  return results;
}

/**
 * instagram_posts テーブルの既存レコードをメトリクスで更新
 */
async function updateInstagramPostMetrics(igPost) {
  const engagementRate = igPost.reach > 0
    ? parseFloat(((igPost.likes + igPost.comments + igPost.saves) / igPost.reach * 100).toFixed(2))
    : 0;

  const { data, error } = await supabase
    .from('instagram_posts')
    .update({
      likes_count: igPost.likes,
      comments_count: igPost.comments,
      saves_count: igPost.saves,
      reach: igPost.reach,
      engagement_rate: engagementRate,
      synced_at: new Date().toISOString(),
    })
    .eq('media_id', igPost.mediaId)
    .select('id');

  if (error) {
    console.warn(`[NightlySync] メトリクス更新エラー: ${igPost.mediaId}`, error.message);
    return false;
  }

  return data && data.length > 0;
}

/**
 * instagram投稿を post_history とマッチング
 * キャプション先頭100文字の一致で紐づける
 */
async function matchWithPostHistory(storeId, igPost) {
  if (!igPost.caption) return null;

  // キャプションの先頭部分（ハッシュタグ除去）で検索
  const captionStart = igPost.caption.split('#')[0].trim().slice(0, 80);
  if (captionStart.length < 10) return null; // 短すぎるキャプションはマッチ不可

  const { data: posts } = await supabase
    .from('post_history')
    .select('id, content, store_id')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!posts || posts.length === 0) return null;

  // post_history の content と Instagram キャプションの先頭部分を比較
  for (const post of posts) {
    if (!post.content) continue;
    const postContentStart = post.content.split('#')[0].trim().slice(0, 80);
    // 先頭50文字以上が一致すればマッチとみなす
    if (postContentStart.length >= 50 && captionStart.startsWith(postContentStart.slice(0, 50))) {
      return post;
    }
    if (captionStart.length >= 50 && postContentStart.startsWith(captionStart.slice(0, 50))) {
      return post;
    }
  }

  return null;
}

/**
 * 学習パイプラインをサイレント実行（LINE返信なし）
 * reportHandler.applyEngagementMetrics と同じ処理を LINE通知なしで実行
 */
async function applyMetricsSilently(store, post, igPost) {
  const likes = igPost.likes;
  const saves = igPost.saves;
  const comments = igPost.comments;
  const reach = igPost.reach;

  // 保存強度・反応指数を計算
  const saveIntensity = likes > 0 ? saves / likes : 0;
  const followerCount = parseInt(store.follower_count, 10) || null;
  const reactionIndex = followerCount && followerCount > 0
    ? (likes + saves * 3) / followerCount * 100
    : 0;
  const engagementRate = reach > 0
    ? parseFloat(((likes + comments + saves) / reach * 100).toFixed(2))
    : 0;

  const postData = { post_id: post.id, content: post.content };
  const metricsData = {
    likes_count: likes,
    saves_count: saves,
    comments_count: comments,
    reach_actual: reach,
    reach: reach,
    engagement_rate: engagementRate,
    save_intensity: saveIntensity,
    reaction_index: reactionIndex,
  };

  // 1. 集合知DBに保存
  const saveResult = await saveEngagementMetrics(store.id, store.category || 'その他', postData, metricsData);
  if (!saveResult.success) {
    console.warn(`[NightlySync] 集合知保存失敗: ${saveResult.message}`);
    return;
  }

  // 2. 個人学習プロファイル更新
  await applyEngagementToProfile(store.id, post.content, metricsData);

  // 3. Claude自動分析（高/低パフォーマンスのみ発火）
  try {
    const { data: storeMetrics } = await supabase
      .from('engagement_metrics')
      .select('save_intensity')
      .eq('store_id', store.id)
      .eq('status', '報告済')
      .not('save_intensity', 'is', null);

    const avgSaveIntensity = storeMetrics?.length > 0
      ? storeMetrics.reduce((sum, m) => sum + m.save_intensity, 0) / storeMetrics.length
      : 0.05;

    await analyzeEngagementWithClaude(
      store.id,
      post.content,
      { likes, saves, comments },
      avgSaveIntensity,
    );
  } catch (err) {
    console.warn(`[NightlySync] Claude自動分析エラー（続行）:`, err.message);
  }

  console.log(`[NightlySync] 学習完了: store=${store.name}, post=${post.id.slice(0, 8)}…, save_intensity=${saveIntensity.toFixed(3)}`);
}

/**
 * スリープ関数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
