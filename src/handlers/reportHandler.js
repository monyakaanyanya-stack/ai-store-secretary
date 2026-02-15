import { replyText } from '../services/lineService.js';
import { getStore } from '../services/supabaseService.js';
import { saveEngagementMetrics } from '../services/collectiveIntelligence.js';

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
 * 報告ハンドラー（投稿選択式）
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

    // pending_reportsに保存
    await savePendingReport(user.id, store.id, metrics);

    // 最近の投稿一覧を取得（5件）
    const recentPosts = await getRecentPostHistory(user.id, store.id, 5);

    if (!recentPosts || recentPosts.length === 0) {
      return await replyText(replyToken,
        'まだ投稿履歴がありません。\n\n先に投稿を生成してから報告してください。'
      );
    }

    // 投稿一覧をフォーマット
    const postList = recentPosts.map((post, index) => {
      const preview = post.content.split('\n')[0].slice(0, 30) + '...';
      const date = new Date(post.created_at).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
      return `${index + 1}. ${preview}（${date}）`;
    }).join('\n');

    const message = `📊 報告を受け付けました！
❤️ いいね: ${metrics.likes}
💾 保存: ${metrics.saves}
💬 コメント: ${metrics.comments}

どの投稿の報告ですか？
番号を送ってください↓

${postList}

※ 10分以内に番号を選択してください`;

    await replyText(replyToken, message);
  } catch (err) {
    console.error('[Report] エンゲージメント報告エラー:', err.message);
    await replyText(replyToken, `エラーが発生しました: ${err.message}`);
  }
}

/**
 * 投稿番号選択のハンドラー
 */
export async function handlePostSelection(user, postNumber, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    // pending_reportを取得
    const pendingReport = await getPendingReport(user.id, user.current_store_id);

    if (!pendingReport) {
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

    // 店舗情報を取得
    const store = await getStore(user.current_store_id);

    // 投稿内容からハッシュタグを抽出
    let postContent = selectedPost.content.split('#')[0].trim().slice(0, 50);
    const hashtags = extractHashtags(selectedPost.content);

    // エンゲージメント率を計算
    const metrics = {
      likes: pendingReport.likes_count,
      saves: pendingReport.saves_count,
      comments: pendingReport.comments_count
    };
    const engagementRate = calculateEngagementRate(metrics);

    // 集合知データベースに保存
    const metricsData = {
      category: store.category || 'その他',
      post_content: postContent,
      hashtags: hashtags,
      likes_count: metrics.likes,
      saves_count: metrics.saves,
      comments_count: metrics.comments,
      reach: metrics.likes * 10, // 仮の推定値
      engagement_rate: parseFloat(engagementRate),
      post_time: new Date(selectedPost.created_at).toTimeString().slice(0, 5),
      day_of_week: new Date(selectedPost.created_at).getDay()
    };

    await saveEngagementMetrics(store.id, store.category || 'その他', metricsData);

    // pending_reportを完了にする
    await completePendingReport(pendingReport.id);

    console.log(`[Report] エンゲージメント報告完了: store=${store.name}, post_index=${selectedIndex}, likes=${metrics.likes}`);

    // 今月の報告回数を取得
    const reportCount = await getMonthlyReportCount(user.id, store.id);

    // フィードバックメッセージ
    const feedbackMessage = `✅ 報告完了！

【報告内容】
❤️ いいね: ${metrics.likes}
💾 保存: ${metrics.saves}
💬 コメント: ${metrics.comments}
📈 エンゲージメント率: ${engagementRate}%

📝 選択した投稿:
${postContent}...

🌱 集合知データベースに追加されました！

今月の報告回数: ${reportCount}回
みんなで育てる集合知が成長しています✨`;

    await replyText(replyToken, feedbackMessage);
    return true; // 処理完了
  } catch (err) {
    console.error('[Report] 投稿選択エラー:', err.message);
    await replyText(replyToken, `エラーが発生しました: ${err.message}`);
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

/**
 * pending_reportsにメトリクスを保存
 */
async function savePendingReport(userId, storeId, metrics) {
  const { supabase } = await import('../services/supabaseService.js');

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

  console.log(`[Report] pending_report作成: id=${data.id}`);
  return data;
}

/**
 * 最近の投稿履歴を取得（複数件）
 */
async function getRecentPostHistory(userId, storeId, limit = 5) {
  const { supabase } = await import('../services/supabaseService.js');

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
  const { supabase } = await import('../services/supabaseService.js');

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
  const { supabase } = await import('../services/supabaseService.js');

  const { error } = await supabase
    .from('pending_reports')
    .update({ status: 'completed' })
    .eq('id', pendingReportId);

  if (error) {
    console.error('[Report] pending_report完了エラー:', error.message);
  }
}
