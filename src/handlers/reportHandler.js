import { replyText } from '../services/lineService.js';
import { getStore } from '../services/supabaseService.js';
import { saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { getLatestPostHistory } from '../services/supabaseService.js';

/**
 * エンゲージメント報告のパース
 * 例: "報告: いいね120, 保存15, コメント5"
 */
function parseEngagementReport(text) {
  // "報告:" または "報告：" で始まるかチェック
  if (!text.match(/^報告[：:]/)) {
    return null;
  }

  const result = {
    likes: 0,
    saves: 0,
    comments: 0
  };

  // いいね数を抽出
  const likesMatch = text.match(/(?:いいね|イイネ|like)[\s:：]*(\d+)/i);
  if (likesMatch) {
    result.likes = parseInt(likesMatch[1], 10);
  }

  // 保存数を抽出
  const savesMatch = text.match(/(?:保存|save)[\s:：]*(\d+)/i);
  if (savesMatch) {
    result.saves = parseInt(savesMatch[1], 10);
  }

  // コメント数を抽出
  const commentsMatch = text.match(/(?:コメント|comment)[\s:：]*(\d+)/i);
  if (commentsMatch) {
    result.comments = parseInt(commentsMatch[1], 10);
  }

  return result;
}

/**
 * エンゲージメント率を計算
 */
function calculateEngagementRate(metrics, reach = null) {
  const totalEngagement = metrics.likes + metrics.saves + metrics.comments;

  // リーチが不明な場合は、いいね数を基準に推定
  const estimatedReach = reach || metrics.likes * 10; // 仮の推定

  if (estimatedReach === 0) return 0;

  return (totalEngagement / estimatedReach * 100).toFixed(2);
}

/**
 * 報告ハンドラー
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

    // 店舗情報を取得
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '選択中の店舗が見つかりません。');
    }

    // 最新の投稿履歴を取得
    const latestPost = await getLatestPostHistory(user.id, store.id);

    let postContent = '';
    if (latestPost && latestPost.content) {
      // 投稿内容から最初の50文字を取得（ハッシュタグを除く）
      postContent = latestPost.content.split('#')[0].trim().slice(0, 50);
    }

    // エンゲージメント率を計算
    const engagementRate = calculateEngagementRate(metrics);

    // 集合知データベースに保存
    const metricsData = {
      category: store.category || 'その他',
      post_content: postContent,
      hashtags: latestPost?.content ? extractHashtags(latestPost.content) : [],
      likes_count: metrics.likes,
      saves_count: metrics.saves,
      comments_count: metrics.comments,
      reach: metrics.likes * 10, // 仮の推定値
      engagement_rate: parseFloat(engagementRate),
      post_time: new Date().toTimeString().slice(0, 5),
      day_of_week: new Date().getDay()
    };

    await saveEngagementMetrics(store.id, store.category || 'その他', metricsData);

    console.log(`[Report] エンゲージメント報告: store=${store.name}, likes=${metrics.likes}, saves=${metrics.saves}, comments=${metrics.comments}`);

    // 今月の報告回数を取得
    const reportCount = await getMonthlyReportCount(user.id, store.id);

    // フィードバックメッセージ
    const feedbackMessage = `📊 報告ありがとうございます！

【報告内容】
❤️ いいね: ${metrics.likes}
💾 保存: ${metrics.saves}
💬 コメント: ${metrics.comments}
📈 エンゲージメント率: ${engagementRate}%

🌱 集合知データベースに追加されました！

今月の報告回数: ${reportCount}回
みんなで育てる集合知が成長しています✨`;

    await replyText(replyToken, feedbackMessage);
  } catch (err) {
    console.error('[Report] エンゲージメント報告エラー:', err.message);
    await replyText(replyToken, `エラーが発生しました: ${err.message}`);
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

/**
 * 最新の投稿履歴を取得（supabaseServiceに追加予定）
 */
async function getLatestPostHistory(userId, storeId) {
  const { supabase } = await import('../services/supabaseService.js');

  const { data, error } = await supabase
    .from('post_history')
    .select('*')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.log('[Report] 最新投稿履歴なし');
    return null;
  }

  return data;
}

/**
 * 今月の報告回数を取得
 */
async function getMonthlyReportCount(userId, storeId) {
  const { supabase } = await import('../services/supabaseService.js');

  // 今月の開始日を取得
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, error } = await supabase
    .from('engagement_metrics')
    .select('id')
    .eq('store_id', storeId)
    .gte('created_at', monthStart.toISOString());

  if (error) {
    console.error('[Report] 報告回数取得エラー:', error.message);
    return 0;
  }

  return data ? data.length : 0;
}
