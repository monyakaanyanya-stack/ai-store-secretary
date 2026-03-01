import { supabase } from './supabaseService.js';
import { encrypt, decrypt } from '../utils/security.js';

// Facebook Graph API（ビジネスアカウント経由のInstagram）
const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

/**
 * Facebook Graph API リクエスト共通関数
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
    throw new Error(`Graph API エラー: ${data.error.message} (code: ${data.error.code})`);
  }

  return data;
}

/**
 * Facebook User Access Token を長期トークンに交換（60日間有効）
 * @param {string} shortToken - Graph API Explorer で取得したトークン
 * @returns {{ access_token, token_type, expires_in }}
 */
export async function exchangeForLongLivedToken(shortToken) {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('INSTAGRAM_APP_ID または INSTAGRAM_APP_SECRET が設定されていません');
  }

  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', shortToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    throw new Error(`トークン交換失敗: ${data.error.message}`);
  }

  return data;
}

/**
 * 長期 User Token から Facebook Page の Access Token を取得
 * @param {string} userToken - 長期ユーザートークン
 * @returns {{ pageId, pageAccessToken, pageName }}
 */
async function getPageAccessToken(userToken) {
  const result = await graphApiRequest('/me/accounts', userToken);

  if (!result.data || result.data.length === 0) {
    throw new Error('接続されている Facebook ページが見つかりません。ページが作成済みか確認してください。');
  }

  // 最初のページを使用
  const page = result.data[0];
  return {
    pageId: page.id,
    pageAccessToken: page.access_token,
    pageName: page.name,
  };
}

/**
 * Facebook Page から Instagram Business Account ID を取得
 * @param {string} pageId - Facebook ページ ID
 * @param {string} pageAccessToken - ページアクセストークン
 * @returns {string} Instagram Business Account ID
 */
async function getInstagramBusinessAccountId(pageId, pageAccessToken) {
  const result = await graphApiRequest(`/${pageId}`, pageAccessToken, {
    fields: 'instagram_business_account,connected_instagram_account',
  });

  console.log(`[Instagram] IGアカウント検索: business=${JSON.stringify(result.instagram_business_account)}, connected=${JSON.stringify(result.connected_instagram_account)}`);

  // instagram_business_account を優先、なければ connected_instagram_account を使用
  const igAccount = result.instagram_business_account || result.connected_instagram_account;

  if (!igAccount?.id) {
    throw new Error('Instagram ビジネスアカウントが見つかりません。Instagram をプロアカウント（ビジネス）に変換して Facebook ページに接続してください。');
  }

  return igAccount.id;
}

/**
 * Instagram ビジネスアカウントの基本情報を取得
 * @param {string} igAccountId - Instagram Business Account ID
 * @param {string} pageAccessToken - ページアクセストークン
 */
async function getInstagramAccountInfo(igAccountId, pageAccessToken) {
  return await graphApiRequest(`/${igAccountId}`, pageAccessToken, {
    fields: 'id,username,followers_count,media_count,name,biography',
  });
}

/**
 * Instagram 連携を登録/更新
 * @param {string} storeId - 店舗ID
 * @param {string} userAccessToken - Graph API Explorer で取得したユーザートークン
 * @returns {{ account, accountInfo }}
 */
export async function connectInstagramAccount(storeId, userAccessToken, knownPageId = null) {
  // Instagram Business Login トークン（IGA/IGQ で始まる）は直接接続
  if (userAccessToken.startsWith('IGA') || userAccessToken.startsWith('IGQ') || userAccessToken.startsWith('IG')) {
    console.log('[Instagram] Instagram Business Login トークン検出 → 直接接続モード');
    const meInfo = await graphApiRequest('/me', userAccessToken, {
      fields: 'id,username,followers_count,media_count,name,biography',
    });
    if (!meInfo.id) throw new Error('Instagram トークンが無効です。');
    console.log(`[Instagram] Instagram アカウント: @${meInfo.username} (${meInfo.id})`);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);
    const encryptedToken = encrypt(userAccessToken);

    const { data, error } = await supabase
      .from('instagram_accounts')
      .upsert({
        store_id: storeId,
        instagram_user_id: meInfo.id,
        instagram_username: meInfo.username,
        access_token: encryptedToken,
        token_expires_at: expiresAt.toISOString(),
        followers_count: meInfo.followers_count || 0,
        media_count: meInfo.media_count || 0,
        last_synced_at: new Date().toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id' })
      .select()
      .single();
    if (error) throw new Error(`連携登録失敗: ${error.message}`);
    return { account: data, accountInfo: meInfo };
  }

  // 1. 長期トークンに交換（Facebook トークンの場合）
  let longLivedToken;
  try {
    const tokenData = await exchangeForLongLivedToken(userAccessToken);
    longLivedToken = tokenData.access_token;
    console.log('[Instagram] 長期トークン取得成功');
  } catch (err) {
    // App Secret が未設定の場合はそのまま使用（開発テスト用）
    console.warn('[Instagram] 長期トークン交換スキップ（テストモード）:', err.message);
    longLivedToken = userAccessToken;
  }

  // 2. Facebook ページ経由で Page Access Token を取得
  let pageId, pageAccessToken, pageName;

  if (knownPageId) {
    // ページIDが直接指定された場合：instagram_business_account も同時取得
    console.log(`[Instagram] ページID直接指定モード: ${knownPageId}`);
    const pageInfo = await graphApiRequest(`/${knownPageId}`, longLivedToken, {
      fields: 'id,name,access_token,instagram_business_account',
    });
    if (!pageInfo.id) throw new Error('指定されたページIDが無効です。');
    console.log(`[Instagram] ページ情報: access_token=${pageInfo.access_token ? 'あり' : 'なし'}, ig=${JSON.stringify(pageInfo.instagram_business_account)}`);
    pageId = pageInfo.id;
    pageAccessToken = pageInfo.access_token || longLivedToken;
    pageName = pageInfo.name || knownPageId;

    // instagram_business_account が直接取得できた場合はスキップ
    if (pageInfo.instagram_business_account?.id) {
      const igAccountId = pageInfo.instagram_business_account.id;
      console.log(`[Instagram] Instagram Business Account ID (直接取得): ${igAccountId}`);
      const accountInfo = await getInstagramAccountInfo(igAccountId, pageAccessToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 60);
      const encryptedToken = encrypt(pageAccessToken);
      const { data, error } = await supabase
        .from('instagram_accounts')
        .upsert({
          store_id: storeId,
          instagram_user_id: igAccountId,
          instagram_username: accountInfo.username,
          access_token: encryptedToken,
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
  } else {
    // 通常フロー: /me/accounts → 失敗時はページトークンとして試行
    try {
      const pageInfo = await getPageAccessToken(longLivedToken);
      pageId = pageInfo.pageId;
      pageAccessToken = pageInfo.pageAccessToken;
      pageName = pageInfo.pageName;
    } catch (userTokenErr) {
      console.warn('[Instagram] /me/accounts 失敗、ページトークンとして試行:', userTokenErr.message);
      const meInfo = await graphApiRequest('/me', longLivedToken, {
        fields: 'id,name',
      });
      if (!meInfo.id) throw new Error('トークンが無効です。ユーザートークンまたはページトークンを確認してください。');
      pageId = meInfo.id;
      pageAccessToken = longLivedToken;
      pageName = meInfo.name || 'Unknown Page';
    }
  }
  console.log(`[Instagram] ページ取得: ${pageName} (${pageId})`);

  // 3. Instagram Business Account ID を取得
  const igAccountId = await getInstagramBusinessAccountId(pageId, pageAccessToken);
  console.log(`[Instagram] Instagram Business Account ID: ${igAccountId}`);

  // 4. アカウント情報を取得
  const accountInfo = await getInstagramAccountInfo(igAccountId, pageAccessToken);

  // 5. トークン有効期限（60日後）
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 60);

  // 6. トークンを暗号化して保存
  const encryptedToken = encrypt(pageAccessToken);

  const { data, error } = await supabase
    .from('instagram_accounts')
    .upsert({
      store_id: storeId,
      instagram_user_id: igAccountId,
      instagram_username: accountInfo.username,
      access_token: encryptedToken,
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
 * 店舗の Instagram 連携情報を取得
 * @param {string} storeId - 店舗ID
 */
export async function getInstagramAccount(storeId) {
  const { data } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .single();

  if (!data) return null;

  if (data.access_token) {
    try {
      data.access_token = decrypt(data.access_token);
    } catch (decryptErr) {
      console.error('[Instagram] トークン復号失敗:', decryptErr.message);
      return null;
    }
  }

  return data;
}

/**
 * Instagram の最新投稿を取得して DB に同期
 * @param {string} storeId - 店舗ID
 * @param {number} limit - 取得件数（最大50）
 * @returns {number} - 同期した件数
 */
export async function syncInstagramPosts(storeId, limit = 25) {
  const account = await getInstagramAccount(storeId);
  if (!account) throw new Error('Instagram が連携されていません');

  if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
    throw new Error('アクセストークンの有効期限が切れています。再連携が必要です');
  }

  const igAccountId = account.instagram_user_id;
  const accessToken = account.access_token;

  // メディア一覧を取得（Facebook Graph API 経由）
  const mediaList = await graphApiRequest(`/${igAccountId}/media`, accessToken, {
    fields: 'id,caption,media_type,permalink,timestamp',
    limit: String(limit),
  });

  if (!mediaList.data || mediaList.data.length === 0) {
    return 0;
  }

  let synced = 0;

  for (const media of mediaList.data) {
    try {
      const { data: existing } = await supabase
        .from('instagram_posts')
        .select('id')
        .eq('media_id', media.id)
        .single();

      if (existing) continue;

      // インサイトデータを取得
      let insightsData = {};
      try {
        const insights = await graphApiRequest(`/${media.id}/insights`, accessToken, {
          metric: 'impressions,reach,saved,likes,comments',
        });

        if (insights.data) {
          insights.data.forEach(metric => {
            insightsData[metric.name] = metric.values?.[0]?.value || metric.value || 0;
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

  await supabase
    .from('instagram_accounts')
    .update({
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id);

  console.log(`[Instagram] 同期完了: store=${storeId?.slice(0, 4)}…, synced=${synced}件`);
  return synced;
}

/**
 * Instagram 投稿の統計サマリーを取得
 * @param {string} storeId - 店舗ID
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
 * Instagram 連携状態を確認するメッセージ
 * @param {string} storeId - 店舗ID
 */
export async function getInstagramConnectionStatus(storeId) {
  const account = await getInstagramAccount(storeId);

  if (!account) {
    return `📸 Instagram連携

まだ連携されていません。

【連携方法】
1. Meta for Developers (developers.facebook.com) でアプリ作成
2. Graph API Explorer でアクセストークンを生成
3. LINEで以下を送信:

/instagram connect [アクセストークン]

※ Instagram はプロアカウント（ビジネス）に変換し、Facebook ページと接続しておく必要があります。`;
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
