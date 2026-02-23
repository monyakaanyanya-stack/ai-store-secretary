import { replyText } from '../services/lineService.js';
// L2修正: supabaseをstatic importに統一（8箇所のdynamic importを削除）
import { getStore, supabase } from '../services/supabaseService.js';
import { saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { applyEngagementToProfile } from '../services/personalizationEngine.js';
import { normalizeInput, safeParseInt } from '../utils/inputNormalizer.js';

/**
 * エンゲージメント報告のパース
 * 例: "報告: いいね120, 保存15, コメント5"
 * 例: "報告: いいね120, 保存15, コメント5, リーチ:800"  ← リーチは任意
 */
function parseEngagementReport(text) {
  // 全角コロン・全角数字を正規化
  const normalized = normalizeInput(text);

  // "報告:" で始まるかチェック（正規化済みなので半角のみ）
  if (!normalized.match(/^報告:/)) {
    return null;
  }

  const result = {
    likes: 0,
    saves: 0,
    comments: 0,
    reach: null, // null = 入力なし（推定しない）
  };

  // いいね数を抽出（NaN防止: safeParseInt使用）
  const likesMatch = normalized.match(/(?:いいね|イイネ|like)[\s:]*(\d+)/i);
  if (likesMatch) result.likes = safeParseInt(likesMatch[1], 0);

  // 保存数を抽出
  const savesMatch = normalized.match(/(?:保存|save)[\s:]*(\d+)/i);
  if (savesMatch) result.saves = safeParseInt(savesMatch[1], 0);

  // コメント数を抽出
  const commentsMatch = normalized.match(/(?:コメント|comment)[\s:]*(\d+)/i);
  if (commentsMatch) result.comments = safeParseInt(commentsMatch[1], 0);

  // リーチ数を抽出（任意入力）
  const reachMatch = normalized.match(/(?:リーチ|reach)[\s:]*(\d+)/i);
  if (reachMatch) result.reach = safeParseInt(reachMatch[1], null);

  return result;
}

/**
 * 正直な指標を計算（いいね×10推定は使わない）
 *
 * 保存強度指数 = 保存 ÷ いいね
 *   → 高いほどアルゴリズム評価が高い投稿
 *
 * 反応指数 = (いいね + 保存×3) ÷ フォロワー × 100
 *   → フォロワー数がある場合のみ算出
 *
 * エンゲージメント率 = (いいね + 保存 + コメント) ÷ リーチ × 100
 *   → 実リーチが入力された場合のみ算出
 */
function calculateMetrics(metrics, followerCount = null) {
  const { likes, saves, comments, reach } = metrics;

  // 保存強度指数（常時算出）
  const saveIntensity = likes > 0 ? parseFloat((saves / likes).toFixed(4)) : 0;

  // 反応指数（フォロワー数があるときだけ）
  let reactionIndex = 0;
  if (followerCount && followerCount > 0) {
    reactionIndex = parseFloat(((likes + saves * 3) / followerCount * 100).toFixed(4));
  }

  // エンゲージメント率（実リーチ入力があるときだけ）
  let engagementRate = null;
  if (reach && reach > 0) {
    engagementRate = parseFloat(((likes + saves + comments) / reach * 100).toFixed(2));
  }

  return { saveIntensity, reactionIndex, engagementRate };
}

/**
 * 報告ハンドラー（最新投稿に自動適用）
 */
export async function handleEngagementReport(user, text, replyToken) {
  // 店舗が未設定の場合
  if (!user.current_store_id) {
    return await replyText(replyToken,
      '店舗が選択されていません。\n\nまず店舗を登録してください。'
    );
  }

  try {
    // 報告内容をパース
    const metrics = parseEngagementReport(text);

    if (!metrics) {
      return await replyText(replyToken,
        '報告の形式が正しくありません。\n\n正しい形式:\n報告: いいね120, 保存15, コメント5'
      );
    }

    // 数値チェック
    if (metrics.likes === 0 && metrics.saves === 0 && metrics.comments === 0) {
      return await replyText(replyToken,
        '少なくとも1つの数値を入力してください。\n\n例:\n報告: いいね120, 保存15, コメント5'
      );
    }

    // H12/H14修正: 数値上限チェック（入力ミス or 攻撃的入力の防止）
    const MAX_METRIC_VALUE = 10_000_000; // 1000万
    if (metrics.likes > MAX_METRIC_VALUE || metrics.saves > MAX_METRIC_VALUE ||
        metrics.comments > MAX_METRIC_VALUE || (metrics.reach && metrics.reach > MAX_METRIC_VALUE)) {
      return await replyText(replyToken,
        '数値が大きすぎます。入力内容を確認してください。'
      );
    }

    // 店舗情報を取得
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '選択中の店舗が見つかりません。');
    }

    // 最新の投稿を取得
    const recentPosts = await getRecentPostHistory(user.id, store.id, 1);

    if (!recentPosts || recentPosts.length === 0) {
      return await replyText(replyToken,
        'まだ投稿履歴がありません。\n\n先に投稿を生成してから報告してください。'
      );
    }

    const latestPost = recentPosts[0];

    // 共通処理: DB保存 + 返信
    await applyEngagementMetrics(user, store, metrics, latestPost, replyToken);
  } catch (err) {
    console.error('[Report] エンゲージメント報告エラー:', err);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
  }
}

/**
 * エンゲージメント指標を DB に保存してユーザーに結果を返す（共通処理）
 * handleEngagementReport と imageHandler（インサイトOCR）の両方から呼ばれる
 *
 * @param {Object} user      - ユーザーオブジェクト
 * @param {Object} store     - 店舗オブジェクト
 * @param {{ likes, saves, comments, reach }} metrics - 数値
 * @param {{ id, content }}  latestPost - 対象の投稿
 * @param {string}           replyToken - LINE reply token
 */
export async function applyEngagementMetrics(user, store, metrics, latestPost, replyToken) {
  const followerCount = parseInt(store.follower_count, 10) || null;
  const { saveIntensity, reactionIndex, engagementRate } = calculateMetrics(metrics, followerCount);

  const postData = { post_id: latestPost.id, content: latestPost.content };
  const metricsData = {
    likes_count: metrics.likes,
    saves_count: metrics.saves,
    comments_count: metrics.comments,
    reach_actual: metrics.reach || 0,
    reach: metrics.reach || 0,
    engagement_rate: engagementRate || 0,
    save_intensity: saveIntensity,
    reaction_index: reactionIndex,
  };

  await saveEngagementMetrics(store.id, store.category || 'その他', postData, metricsData);
  await applyEngagementToProfile(store.id, latestPost.content, metricsData);

  console.log(`[Report] エンゲージメント報告完了: store=${store.name}, likes=${metrics.likes}, save_intensity=${saveIntensity}`);

  const reportCount = await getMonthlyReportCount(user.id, store.id);
  const postContent = (latestPost.content || '').split('#')[0].trim().slice(0, 50);

  let saveComment = '';
  if (saveIntensity >= 0.3) saveComment = '🔥 保存率がかなり高い！アルゴリズム評価◎';
  else if (saveIntensity >= 0.15) saveComment = '✨ 保存率が良好です';
  else if (saveIntensity >= 0.05) saveComment = '👍 標準的な保存率';
  else if (metrics.likes > 0) saveComment = '💡 保存を増やすと伸びやすくなります';

  let reactionLine = '';
  if (followerCount && followerCount > 0 && reactionIndex > 0) {
    reactionLine = `\n📊 反応指数: ${reactionIndex.toFixed(2)}（フォロワー${followerCount.toLocaleString()}人比）`;
  }

  let engagementLine = '';
  if (engagementRate !== null) {
    engagementLine = `\n📈 エンゲージメント率: ${engagementRate}%（実リーチ${metrics.reach?.toLocaleString()}より算出）`;
  }

  const feedbackMessage = `✅ 報告完了！（最新の投稿に適用されました）

【報告内容】
❤️ いいね: ${metrics.likes}
💾 保存: ${metrics.saves}
💬 コメント: ${metrics.comments}
💾 保存強度: ${saveIntensity.toFixed(2)}（保存÷いいね）${reactionLine}${engagementLine}
${saveComment}

📝 対象の投稿:
${postContent}...

🌱 集合知データベースに追加されました！
今月の報告回数: ${reportCount}回

💡 リーチがわかる場合は「リーチ:800」を追加すると精度が上がります`;

  await replyText(replyToken, feedbackMessage);
}

/**
 * 投稿番号選択のハンドラー
 */
export async function handlePostSelection(user, postNumber, replyToken) {
  if (!user.current_store_id) {
    return null; // 他のハンドラーに処理を委譲
  }

  try {
    // pending_reportを取得
    const pendingReport = await getPendingReport(user.id, user.current_store_id);

    if (!pendingReport) {
      // 期限切れのpending_reportがあれば通知してクリーンアップ
      const num = parseInt(postNumber, 10);
      if (!isNaN(num) && num >= 1 && num <= 10) {
        const expiredReport = await getExpiredPendingReport(user.id, user.current_store_id);
        if (expiredReport) {
          await cleanupExpiredReports(user.id, user.current_store_id);
          await replyText(replyToken, '⏰ 投稿選択の期限が切れました。\n\nもう一度「報告: いいね○○, 保存○○, コメント○○」から始めてください。');
          return true;
        }
      }
      return null; // pending_reportがない場合はこのハンドラーをスキップ
    }

    // 投稿番号をパース
    const selectedIndex = parseInt(postNumber, 10) - 1;
    if (isNaN(selectedIndex) || selectedIndex < 0) {
      return null; // 数値でない場合はスキップ
    }

    // 最近の投稿一覧を取得
    const recentPosts = await getRecentPostHistory(user.id, user.current_store_id, 5);

    if (selectedIndex >= recentPosts.length) {
      return await replyText(replyToken, `投稿番号が範囲外です。1〜${recentPosts.length} の範囲で選択してください。`);
    }

    const selectedPost = recentPosts[selectedIndex];

    // 店舗情報を取得（フォロワー数を含む）
    const store = await getStore(user.current_store_id);

    // 投稿内容からハッシュタグを抽出
    let postContent = selectedPost.content.split('#')[0].trim().slice(0, 50);
    const hashtags = extractHashtags(selectedPost.content);

    // 正直な指標を計算
    const metrics = {
      likes: pendingReport.likes_count,
      saves: pendingReport.saves_count,
      comments: pendingReport.comments_count,
      reach: pendingReport.reach_actual || null,
    };
    const followerCount = parseInt(store.follower_count, 10) || null;
    const { saveIntensity, reactionIndex, engagementRate } = calculateMetrics(metrics, followerCount);

    // 集合知データベースに保存
    const postData = {
      post_id: selectedPost.id,
      content: selectedPost.content,
    };

    const metricsData = {
      likes_count: metrics.likes,
      saves_count: metrics.saves,
      comments_count: metrics.comments,
      reach_actual: metrics.reach || 0,
      reach: metrics.reach || 0,
      engagement_rate: engagementRate || 0,
      save_intensity: saveIntensity,
      reaction_index: reactionIndex,
    };

    await saveEngagementMetrics(store.id, store.category || 'その他', postData, metricsData);

    // エンゲージメント実績を個別学習プロファイルに反映
    await applyEngagementToProfile(store.id, selectedPost.content, metricsData);

    // pending_reportを完了にする
    await completePendingReport(pendingReport.id);

    console.log(`[Report] エンゲージメント報告完了: store=${store.name}, post_index=${selectedIndex}, likes=${metrics.likes}, save_intensity=${saveIntensity}`);

    // 今月の報告回数を取得
    const reportCount = await getMonthlyReportCount(user.id, store.id);

    // 保存強度の評価コメント
    let saveComment = '';
    if (saveIntensity >= 0.3) saveComment = '🔥 保存率がかなり高い！アルゴリズム評価◎';
    else if (saveIntensity >= 0.15) saveComment = '✨ 保存率が良好です';
    else if (saveIntensity >= 0.05) saveComment = '👍 標準的な保存率';
    else if (metrics.likes > 0) saveComment = '💡 保存を増やすと伸びやすくなります';

    // 反応指数の表示
    let reactionLine = '';
    if (followerCount && followerCount > 0 && reactionIndex > 0) {
      reactionLine = `\n📊 反応指数: ${reactionIndex.toFixed(2)}（フォロワー${followerCount.toLocaleString()}人比）`;
    }

    // リーチ入力があった場合のみエンゲージメント率を表示
    let engagementLine = '';
    if (engagementRate !== null) {
      engagementLine = `\n📈 エンゲージメント率: ${engagementRate}%（実リーチ${metrics.reach?.toLocaleString()}より算出）`;
    }

    // フィードバックメッセージ
    const feedbackMessage = `✅ 報告完了！

【報告内容】
❤️ いいね: ${metrics.likes}
💾 保存: ${metrics.saves}
💬 コメント: ${metrics.comments}
💾 保存強度: ${saveIntensity.toFixed(2)}（保存÷いいね）${reactionLine}${engagementLine}
${saveComment}

📝 選択した投稿:
${postContent}...

🌱 集合知データベースに追加されました！
今月の報告回数: ${reportCount}回

💡 リーチがわかる場合は「リーチ:800」を追加すると精度が上がります`;

    await replyText(replyToken, feedbackMessage);
    return true; // 処理完了
  } catch (err) {
    console.error('[Report] 投稿選択エラー:', err);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
    return true;
  }
}

/**
 * ハッシュタグを抽出
 */
function extractHashtags(text) {
  const hashtagRegex = /#[^\s#]+/g;
  const matches = text.match(hashtagRegex);
  return matches || [];
}

// L9修正: getLatestPostHistory削除（getRecentPostHistory(userId, storeId, 1)と重複）

/**
 * 今月の報告回数を取得
 */
async function getMonthlyReportCount(userId, storeId) {
  // L2修正: static importを使用

  // 今月の開始日をJST基準で取得（UTC+9）
  const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const monthStartJST = new Date(Date.UTC(nowJST.getUTCFullYear(), nowJST.getUTCMonth(), 1));
  // JST月初 → UTC に戻す（-9時間）
  const monthStartUTC = new Date(monthStartJST.getTime() - 9 * 60 * 60 * 1000);

  // S10修正: 全件SELECTではなくDB側でカウント（データ転送削減）
  const { count, error } = await supabase
    .from('engagement_metrics')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('status', '報告済')
    .gte('created_at', monthStartUTC.toISOString());

  if (error) {
    console.error('[Report] 報告回数取得エラー:', error.message);
    return 0;
  }

  return count || 0;
}

/**
 * pending_reportsにメトリクスを保存
 * C4注記: 現在未使用（handleEngagementReportが最新投稿に直接適用するため）
 * マルチ投稿選択フロー実装時に有効化する予定
 * C15修正: 既存の awaiting_post_selection を先にクリーンアップ（競合防止）
 */
async function savePendingReport(userId, storeId, metrics) {
  // L2修正: static importを使用

  // 既存の awaiting_post_selection を expired に変更（競合防止）
  await supabase
    .from('pending_reports')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .eq('status', 'awaiting_post_selection');

  const { data, error } = await supabase
    .from('pending_reports')
    .insert({
      user_id: userId,
      store_id: storeId,
      likes_count: metrics.likes,
      saves_count: metrics.saves,
      comments_count: metrics.comments,
      status: 'awaiting_post_selection'
    })
    .select()
    .single();

  if (error) {
    console.error('[Report] pending_reports保存エラー:', error.message);
    throw new Error('報告の保存に失敗しました');
  }

  console.log(`[Report] pending_report作成`);
  return data;
}

/**
 * 最近の投稿履歴を取得（複数件）
 */
async function getRecentPostHistory(userId, storeId, limit = 5) {
  // L2修正: static importを使用

  const { data, error } = await supabase
    .from('post_history')
    .select('*')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Report] 投稿履歴取得エラー:', error.message);
    return [];
  }

  return data || [];
}

/**
 * ユーザーのpending_reportを取得
 */
async function getPendingReport(userId, storeId) {
  // L2修正: static importを使用

  const { data, error } = await supabase
    .from('pending_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .eq('status', 'awaiting_post_selection')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    // データがない場合はnullを返す（エラーではない）
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Report] pending_report取得エラー:', error.message);
    return null;
  }

  return data;
}

/**
 * pending_reportを完了にする
 */
async function completePendingReport(pendingReportId) {
  // L2修正: static importを使用

  const { error } = await supabase
    .from('pending_reports')
    .update({ status: 'completed' })
    .eq('id', pendingReportId);

  if (error) {
    console.error('[Report] pending_report完了エラー:', error.message);
  }
}

/**
 * 期限切れのpending_reportを取得（直近24時間以内に期限切れしたもの）
 */
async function getExpiredPendingReport(userId, storeId) {
  // L2修正: static importを使用

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('pending_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .eq('status', 'awaiting_post_selection')
    .lte('expires_at', new Date().toISOString())
    .gte('expires_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    return null;
  }

  return data;
}

/**
 * 期限切れのpending_reportをクリーンアップ（expired → completed）
 */
async function cleanupExpiredReports(userId, storeId) {
  // L2修正: static importを使用

  const { error } = await supabase
    .from('pending_reports')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .eq('status', 'awaiting_post_selection')
    .lte('expires_at', new Date().toISOString());

  if (error) {
    console.error('[Report] 期限切れreportクリーンアップエラー:', error.message);
  }
}
