import { supabase } from './supabaseService.js';
import { encrypt, decrypt } from '../utils/security.js';

// Facebook Graph API（ビジネスアカウント経由のInstagram）
const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';
// Instagram Business Login API
const INSTAGRAM_API_BASE = 'https://graph.instagram.com/v21.0';

/**
 * Graph API リクエスト共通関数
 * @param {string} baseUrl - API ベース URL
 */
async function graphApiRequestBase(baseUrl, path, accessToken, params = {}) {
  const url = new URL(`${baseUrl}${path}`);
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
    const meInfo = await graphApiRequestBase(INSTAGRAM_API_BASE, '/me', userAccessToken, {
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

  // Instagram Business Login トークンか Facebook トークンかで API ベースを切り替え
  const apiBase = accessToken.startsWith('IG') ? INSTAGRAM_API_BASE : GRAPH_API_BASE;
  const apiRequest = (path, token, params) => graphApiRequestBase(apiBase, path, token, params);

  // メディア一覧を取得（like_count/comments_count をメディアフィールドから直接取得）
  // media_product_type: REELS / POST / IGTV など
  const mediaList = await apiRequest(`/${igAccountId}/media`, accessToken, {
    fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count',
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

      // メディアフィールドからいいね・コメントを直接取得
      const likes = media.like_count || 0;
      const comments = media.comments_count || 0;

      // インサイトデータを取得（全タイプ共通: reach,saved）
      // ※ impressions は REELS 非対応、plays も基本権限では非対応のため除外
      const isReel = media.media_product_type === 'REELS' || media.media_product_type === 'REEL';

      let insightsData = {};
      try {
        const insights = await apiRequest(`/${media.id}/insights`, accessToken, {
          metric: 'reach,saved',
        });

        if (insights.data) {
          insights.data.forEach(metric => {
            insightsData[metric.name] = metric.values?.[0]?.value ?? metric.value ?? 0;
          });
        }
      } catch (insightErr) {
        console.log(`[Instagram] インサイト取得スキップ: ${media.id} - ${insightErr.message}`);
      }

      const saves = insightsData.saved || 0;
      const reach = insightsData.reach || 0;
      const impressions = 0; // 基本権限では取得不可
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
        impressions,
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
// ============================================================
// Content Publishing API（投稿機能）
// ============================================================

/**
 * Graph API POST リクエスト共通関数
 */
async function graphApiPostBase(baseUrl, path, accessToken, bodyParams = {}) {
  const url = `${baseUrl}${path}`;
  const body = { access_token: accessToken, ...bodyParams };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Graph API POST エラー: ${data.error.message} (code: ${data.error.code})`);
  }
  return data;
}

/**
 * メディアコンテナを作成（ステップ1）
 * @param {object} account - getInstagramAccount() の返り値
 * @param {string} imageUrl - 公開アクセス可能な画像URL
 * @param {string} caption - 投稿キャプション
 * @returns {Promise<{id: string}>} コンテナID
 */
export async function createMediaContainer(account, imageUrl, caption) {
  const apiBase = account.access_token.startsWith('IG') ? INSTAGRAM_API_BASE : GRAPH_API_BASE;
  return await graphApiPostBase(apiBase, `/${account.instagram_user_id}/media`, account.access_token, {
    image_url: imageUrl,
    caption,
  });
}

/**
 * コンテナのステータスを確認
 */
export async function checkContainerStatus(account, containerId) {
  const apiBase = account.access_token.startsWith('IG') ? INSTAGRAM_API_BASE : GRAPH_API_BASE;
  return await graphApiRequestBase(apiBase, `/${containerId}`, account.access_token, {
    fields: 'status_code',
  });
}

/**
 * コンテナが FINISHED になるまでポーリング
 * @param {object} account
 * @param {string} containerId
 * @param {number} maxAttempts - 最大試行回数（デフォルト10回 = 最大20秒）
 */
async function waitForContainerReady(account, containerId, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await checkContainerStatus(account, containerId);
    console.log(`[Instagram] コンテナ状態確認 (${i + 1}/${maxAttempts}): ${status.status_code}`);
    if (status.status_code === 'FINISHED') return true;
    if (status.status_code === 'ERROR') {
      throw new Error(`メディアコンテナ作成に失敗しました (status: ${JSON.stringify(status)})`);
    }
    // 3秒待機（Instagram側の処理時間を確保）
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error('メディアコンテナ作成がタイムアウトしました（45秒経過）');
}

/**
 * メディアコンテナを公開（ステップ2）
 * @param {object} account
 * @param {string} containerId
 * @returns {Promise<{id: string}>} 公開されたメディアID
 */
export async function publishMediaContainer(account, containerId) {
  const apiBase = account.access_token.startsWith('IG') ? INSTAGRAM_API_BASE : GRAPH_API_BASE;
  return await graphApiPostBase(apiBase, `/${account.instagram_user_id}/media_publish`, account.access_token, {
    creation_id: containerId,
  });
}

/**
 * Instagram に画像投稿するオーケストレーター
 * @param {string} storeId - 店舗ID
 * @param {string} imageUrl - Supabase Storage の公開URL
 * @param {string} caption - 投稿キャプション
 * @returns {Promise<{id: string}>} 投稿結果
 */
export async function publishToInstagram(storeId, imageUrl, caption) {
  const account = await getInstagramAccount(storeId);
  if (!account) throw new Error('Instagramが連携されていません');

  console.log(`[Instagram] 投稿開始: store=${storeId}`);

  // ステップ1: メディアコンテナ作成
  const container = await createMediaContainer(account, imageUrl, caption);
  console.log(`[Instagram] コンテナ作成: id=${container.id}`);

  // ステータスポーリング
  await waitForContainerReady(account, container.id);

  // FINISHED後もInstagram側の内部処理があるため少し待つ
  await new Promise(resolve => setTimeout(resolve, 3000));

  // ステップ2: 公開（リトライあり — 9007エラー対策）
  let published;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      published = await publishMediaContainer(account, container.id);
      break;
    } catch (err) {
      if (attempt < 3 && err.message.includes('9007')) {
        console.warn(`[Instagram] 公開リトライ (${attempt}/3): ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        throw err;
      }
    }
  }
  console.log(`[Instagram] 投稿完了: media_id=${published.id}`);

  // instagram_posts テーブルに記録
  await supabase.from('instagram_posts').insert({
    store_id: storeId,
    instagram_account_id: account.id,
    media_id: published.id,
    caption,
    media_type: 'IMAGE',
    published_via: 'app',
  });

  return published;
}

// ============================================================
// Instagram OAuth フロー（自動連携）
// ============================================================

/**
 * OAuth state パラメータを生成（AES-256-GCM で暗号化）
 */
export function createOAuthState(lineUserId, storeId) {
  const payload = JSON.stringify({ lineUserId, storeId, ts: Date.now() });
  return encodeURIComponent(encrypt(payload));
}

/**
 * OAuth state パラメータを復号・検証（10分有効）
 */
export function verifyOAuthState(encryptedState, maxAgeMs = 10 * 60 * 1000) {
  const decrypted = decrypt(decodeURIComponent(encryptedState));
  const payload = JSON.parse(decrypted);

  if (!payload.lineUserId || !payload.storeId || !payload.ts) {
    throw new Error('不正な state パラメータ');
  }
  if (Date.now() - payload.ts > maxAgeMs) {
    throw new Error('認証リクエストの有効期限が切れています');
  }
  return { lineUserId: payload.lineUserId, storeId: payload.storeId };
}

/**
 * Instagram OAuth 認証URLを生成
 */
export function buildInstagramAuthUrl(lineUserId, storeId) {
  const appId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!appId) throw new Error('INSTAGRAM_APP_ID が設定されていません');
  if (!redirectUri) throw new Error('INSTAGRAM_REDIRECT_URI が設定されていません');

  const state = createOAuthState(lineUserId, storeId);
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'instagram_business_basic,instagram_business_content_publish');
  url.searchParams.set('state', state);
  return url.toString();
}

/**
 * 認証コード → 短期トークン（Instagram Login API）
 */
export async function exchangeCodeForIGToken(code) {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    throw new Error('Instagram OAuth 環境変数が不足しています');
  }

  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  });
  const data = await res.json();
  if (data.error_type || data.error_message) {
    throw new Error(`トークン交換失敗: ${data.error_message || data.error_type}`);
  }
  if (!data.access_token) {
    throw new Error('トークン交換失敗: access_token が返されませんでした');
  }
  return data; // { access_token, user_id }
}

/**
 * 短期→長期トークン（Instagram Login API、60日間有効）
 */
export async function exchangeIGShortForLongLived(shortToken) {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) throw new Error('INSTAGRAM_APP_SECRET が設定されていません');

  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('access_token', shortToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) {
    throw new Error(`長期トークン交換失敗: ${data.error.message}`);
  }
  return data; // { access_token, token_type, expires_in }
}

/**
 * OAuth コールバック処理（code→短期→長期→DB保存）
 * @returns {{ success, username, lineUserId, followersCount }}
 */
export async function handleOAuthCallback(code, state) {
  const { lineUserId, storeId } = verifyOAuthState(state);
  const { access_token: shortToken } = await exchangeCodeForIGToken(code);
  const { access_token: longToken } = await exchangeIGShortForLongLived(shortToken);
  const { account, accountInfo } = await connectInstagramAccount(storeId, longToken);

  return {
    success: true,
    username: accountInfo.username || account.instagram_user_id,
    lineUserId,
    storeId,
    followersCount: accountInfo.followers_count,
  };
}

// ============================================================
// 接続状態確認
// ============================================================

export async function getInstagramConnectionStatus(storeId) {
  const account = await getInstagramAccount(storeId);

  if (!account) {
    return `📸 Instagram連携

まだ連携されていません。

LINEで以下を送信してください:

/instagram connect

または「インスタ連携」と入力してください。`;
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
