import { supabase } from './supabaseService.js';

const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0';

/**
 * Instagram Graph API リクエスト共通関数
 */
async function graphApiRequest(path, accessToken, params = {}) {
  const url = new URL(`${GRAPH_API_BASE}${path}`);
  url.searchParams.set('access_token', accessToken);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    throw new Error(`Instagram API エラー: ${data.error.message} (code: ${data.error.code})`);
  }

  return data;
}

/**
 * 短期アクセストークンを長期トークンに交換
 * @param {string} shortToken - 短期トークン（ユーザーがOAuth後に取得）
 * @returns {Object} - { access_token, token_type, expires_in }
 */
export async function exchangeForLongLivedToken(shortToken) {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('INSTAGRAM_APP_ID または INSTAGRAM_APP_SECRET が設定されていません');
  }

  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('access_token', shortToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    throw new Error(`トークン交換失敗: ${data.error.message}`);
  }

  return data;
}

/**
 * Instagram アカウント情報を取得
 * @param {string} accessToken - アクセストークン
 * @returns {Object} - アカウント情報
 */
export async function getInstagramAccountInfo(accessToken) {
  return await graphApiRequest('/me', accessToken, {
    fields: 'id,username,followers_count,media_count,name,biography'
  });
}

/**
 * Instagram 連携を登録/更新
 * @param {string} storeId - 店舗ID
 * @param {string} accessToken - 長期アクセストークン
 * @returns {Object} - 連携結果
 */
export async function connectInstagramAccount(storeId, accessToken) {
  // アカウント情報を取得して検証
  const accountInfo = await getInstagramAccountInfo(accessToken);

  // トークン有効期限（60日後）
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 60);

  const { data, error } = await supabase
    .from('instagram_accounts')
    .upsert({
      store_id: storeId,
      instagram_user_id: accountInfo.id,
      instagram_username: accountInfo.username,
      access_token: accessToken,
      token_expires_at: expiresAt.toISOString(),
      followers_count: accountInfo.followers_count || 0,
      media_count: accountInfo.media_count || 0,
      last_synced_at: new Date().toISOString(),
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'store_id' })
    .select()
    .single();

  if (error) throw new Error(`連携登録失敗: ${error.message}`);

  return { account: data, accountInfo };
}

/**
 * 店舗のInstagram連携情報を取得
 * @param {string} storeId - 店舗ID
 * @returns {Object|null}
 */
export async function getInstagramAccount(storeId) {
  const { data } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .single();

  return data || null;
}

/**
 * Instagram の最新投稿を取得してDBに同期
 * @param {string} storeId - 店舗ID
 * @param {number} limit - 取得件数 (最大50)
 * @returns {number} - 同期した件数
 */
export async function syncInstagramPosts(storeId, limit = 25) {
  const account = await getInstagramAccount(storeId);
  if (!account) throw new Error('Instagram が連携されていません');

  // トークン有効期限チェック
  if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
    throw new Error('アクセストークンの有効期限が切れています。再連携が必要です');
  }

  // メディア一覧を取得
  const mediaList = await graphApiRequest(`/${account.instagram_user_id}/media`, account.access_token, {
    fields: 'id,caption,media_type,permalink,timestamp',
    limit: String(limit),
  });

  if (!mediaList.data || mediaList.data.length === 0) {
    return 0;
  }

  let synced = 0;

  for (const media of mediaList.data) {
    try {
      // 既に同期済みかチェック
      const { data: existing } = await supabase
        .from('instagram_posts')
        .select('id')
        .eq('media_id', media.id)
        .single();

      if (existing) continue;

      // インサイトデータを取得（ビジネスアカウントのみ）
      let insightsData = {};
      try {
        const insights = await graphApiRequest(`/${media.id}/insights`, account.access_token, {
          metric: 'likes,comments,saved,reach,impressions',
        });

        if (insights.data) {
          insights.data.forEach(metric => {
            insightsData[metric.name] = metric.values?.[0]?.value || 0;
          });
        }
      } catch (insightErr) {
        console.log(`[Instagram] インサイト取得スキップ: ${media.id} - ${insightErr.message}`);
      }

      const likes = insightsData.likes || 0;
      const comments = insightsData.comments || 0;
      const saves = insightsData.saved || 0;
      const reach = insightsData.reach || 0;
      const engagementRate = reach > 0
        ? parseFloat(((likes + comments + saves) / reach * 100).toFixed(2))
        : 0;

      const caption = media.caption || '';
      const hashtags = (caption.match(/#[^\s#]+/g) || []);
      const postDate = new Date(media.timestamp);
      const postMonth = postDate.getMonth() + 1;
      const seasons = { 3: '春', 4: '春', 5: '春', 6: '夏', 7: '夏', 8: '夏', 9: '秋', 10: '秋', 11: '秋' };
      const postSeason = seasons[postMonth] || '冬';

      await supabase.from('instagram_posts').insert({
        store_id: storeId,
        instagram_account_id: account.id,
        media_id: media.id,
        permalink: media.permalink,
        caption,
        media_type: media.media_type,
        timestamp: media.timestamp,
        likes_count: likes,
        comments_count: comments,
        saves_count: saves,
        reach,
        impressions: insightsData.impressions || 0,
        engagement_rate: engagementRate,
        hashtags,
        post_length: caption.replace(/#[^\s#]+/g, '').trim().length,
        emoji_count: (caption.match(/\p{Emoji}/gu) || []).length,
        post_month: postMonth,
        post_season: postSeason,
        synced_at: new Date().toISOString(),
      });

      synced++;
    } catch (postErr) {
      console.error(`[Instagram] 投稿同期エラー: ${media.id}`, postErr.message);
    }
  }

  // 最終同期日時を更新
  await supabase
    .from('instagram_accounts')
    .update({
      last_synced_at: new Date().toISOString(),
      followers_count: account.followers_count,
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id);

  console.log(`[Instagram] 同期完了: store=${storeId}, synced=${synced}件`);
  return synced;
}

/**
 * Instagram投稿の統計サマリーを取得
 * @param {string} storeId - 店舗ID
 * @returns {Object|null}
 */
export async function getInstagramStats(storeId) {
  const { data: posts } = await supabase
    .from('instagram_posts')
    .select('*')
    .eq('store_id', storeId)
    .order('timestamp', { ascending: false })
    .limit(50);

  if (!posts || posts.length === 0) return null;

  const totalLikes = posts.reduce((sum, p) => sum + (p.likes_count || 0), 0);
  const totalReach = posts.reduce((sum, p) => sum + (p.reach || 0), 0);
  const avgER = posts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / posts.length;

  // 人気ハッシュタグ（ER順）
  const hashtagMetrics = {};
  posts.forEach(p => {
    if (p.hashtags && p.engagement_rate != null) {
      p.hashtags.forEach(tag => {
        if (!hashtagMetrics[tag]) hashtagMetrics[tag] = { rates: [], count: 0 };
        hashtagMetrics[tag].rates.push(p.engagement_rate);
        hashtagMetrics[tag].count++;
      });
    }
  });

  const topHashtags = Object.entries(hashtagMetrics)
    .filter(([, d]) => d.count >= 2)
    .map(([tag, d]) => ({
      tag,
      avgER: d.rates.reduce((a, b) => a + b, 0) / d.rates.length,
    }))
    .sort((a, b) => b.avgER - a.avgER)
    .slice(0, 5)
    .map(item => item.tag);

  // 最高エンゲージメント投稿
  const topPost = [...posts].sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0))[0];

  return {
    totalPosts: posts.length,
    avgLikes: Math.round(totalLikes / posts.length),
    avgReach: Math.round(totalReach / posts.length),
    avgER: parseFloat(avgER.toFixed(2)),
    topHashtags,
    topPost,
    recentPosts: posts.slice(0, 5),
  };
}

/**
 * Instagram連携状態を確認するメッセージ
 * @param {string} storeId - 店舗ID
 * @returns {string}
 */
export async function getInstagramConnectionStatus(storeId) {
  const account = await getInstagramAccount(storeId);

  if (!account) {
    return `📸 Instagram連携

まだ連携されていません。

【連携方法】
1. Instagramをプロアカウント（ビジネス or クリエイター）に変換
2. Meta for Developers でアプリ作成後、アクセストークンを取得
3. 以下のコマンドで連携:

/instagram connect [アクセストークン]

詳しい手順は「ヘルプ」→「Instagram連携」をご覧ください。`;
  }

  const expiresAt = account.token_expires_at
    ? new Date(account.token_expires_at).toLocaleDateString('ja-JP')
    : '不明';

  const lastSynced = account.last_synced_at
    ? new Date(account.last_synced_at).toLocaleDateString('ja-JP')
    : '未同期';

  return `📸 Instagram連携状態

✅ 連携済み: @${account.instagram_username || account.instagram_user_id}
フォロワー: ${account.followers_count?.toLocaleString() || '不明'}人
投稿数: ${account.media_count?.toLocaleString() || '不明'}件
最終同期: ${lastSynced}
トークン期限: ${expiresAt}

【操作】
/instagram sync → 最新データを同期
/instagram stats → 投稿統計を表示
/instagram disconnect → 連携を解除`;
}
