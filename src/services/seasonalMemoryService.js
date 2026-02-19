import { supabase } from './supabaseService.js';

const SEASON_MAP = {
  1: '冬', 2: '冬', 3: '春', 4: '春', 5: '春',
  6: '夏', 7: '夏', 8: '夏', 9: '秋', 10: '秋',
  11: '秋', 12: '冬',
};

const MONTH_NAMES = {
  1: '1月', 2: '2月', 3: '3月', 4: '4月', 5: '5月', 6: '6月',
  7: '7月', 8: '8月', 9: '9月', 10: '10月', 11: '11月', 12: '12月',
};

/**
 * 前年同月の高エンゲージメント投稿を取得
 * @param {string} storeId - 店舗ID
 * @param {number} [targetMonth] - 対象月 (省略時は今月)
 * @returns {Object|null} - 季節提案データ
 */
export async function getLastYearSameMonthPosts(storeId, targetMonth = null) {
  const now = new Date();
  const month = targetMonth || now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const lastYear = currentYear - 1;
  const season = SEASON_MAP[month];

  // 前年同月の投稿を取得
  const lastYearStart = new Date(lastYear, month - 1, 1).toISOString();
  const lastYearEnd = new Date(lastYear, month, 0, 23, 59, 59).toISOString();

  const { data: lastYearPosts } = await supabase
    .from('post_history')
    .select('id, content, created_at, engagement_score, post_month, post_season')
    .eq('store_id', storeId)
    .gte('created_at', lastYearStart)
    .lte('created_at', lastYearEnd)
    .order('engagement_score', { ascending: false, nullsFirst: false })
    .limit(5);

  // 同シーズンの過去投稿も取得（前年のデータが少ない場合の補完用）
  const { data: seasonPosts } = await supabase
    .from('post_history')
    .select('id, content, created_at, engagement_score, post_month, post_season')
    .eq('store_id', storeId)
    .eq('post_season', season)
    .lt('created_at', new Date(currentYear, 0, 1).toISOString()) // 今年以前
    .order('engagement_score', { ascending: false, nullsFirst: false })
    .limit(3);

  // 来月の提案（今月のラスト週あたりに次の月のヒントを出す）
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextSeason = SEASON_MAP[nextMonth];
  const upcomingHint = nextMonth !== month && nextSeason !== season
    ? `次の${nextSeason}（${MONTH_NAMES[nextMonth]}〜）に向けた準備も始めましょう！`
    : null;

  return {
    month,
    monthName: MONTH_NAMES[month],
    season,
    lastYearPosts: lastYearPosts || [],
    seasonPosts: (seasonPosts || []).filter(p =>
      !(lastYearPosts || []).some(lp => lp.id === p.id)
    ),
    upcomingHint,
  };
}

/**
 * 季節提案メッセージを生成（投稿生成プロンプト用）
 * @param {string} storeId - 店舗ID
 * @returns {string} - プロンプトに追加するセクション
 */
export async function getSeasonalMemoryPromptAddition(storeId) {
  try {
    const data = await getLastYearSameMonthPosts(storeId);

    if (!data) return '';

    const { monthName, season, lastYearPosts, seasonPosts } = data;

    const relevantPosts = lastYearPosts.length > 0 ? lastYearPosts : seasonPosts;

    if (relevantPosts.length === 0) return '';

    const postExamples = relevantPosts
      .slice(0, 2)
      .map(p => `「${p.content.slice(0, 60)}${p.content.length > 60 ? '...' : ''}」`)
      .join('\n');

    return `\n【季節の参考情報】\n昨年${monthName}（${season}）の投稿例:\n${postExamples}\n※ この時期らしい表現を自然に取り入れてください`;
  } catch (err) {
    console.error('[SeasonalMemory] プロンプト追加エラー:', err.message);
    return '';
  }
}

/**
 * 「今月のひとこと秘書提案」メッセージを生成（スケジューラーから呼び出す）
 * @param {string} storeId - 店舗ID
 * @param {string} storeName - 店舗名
 * @returns {string|null} - 提案メッセージ (データなければ null)
 */
export async function generateSeasonalSuggestion(storeId, storeName) {
  try {
    const data = await getLastYearSameMonthPosts(storeId);

    if (!data) return null;

    const { monthName, season, lastYearPosts, seasonPosts, upcomingHint } = data;

    const relevantPosts = lastYearPosts.length > 0 ? lastYearPosts : seasonPosts;

    if (relevantPosts.length === 0) return null;

    const topPost = relevantPosts[0];
    const preview = topPost.content.slice(0, 80) + (topPost.content.length > 80 ? '...' : '');

    let message = `📅 ${monthName}の秘書メモ

昨年の${monthName}（${season}）に投稿した内容が好評でした✨

▶ 「${preview}」

今年の${monthName}も同じようなテーマで投稿してみませんか？`;

    if (upcomingHint) {
      message += `\n\n💡 ${upcomingHint}`;
    }

    message += '\n\n※ 「学習状況」で詳しく確認できます';

    return message;
  } catch (err) {
    console.error('[SeasonalMemory] 提案生成エラー:', err.message);
    return null;
  }
}

/**
 * 季節記憶の表示（ユーザーが「季節提案」と送信した時）
 * @param {string} storeId - 店舗ID
 * @returns {string} - メッセージ
 */
export async function getSeasonalMemoryStatus(storeId) {
  try {
    const data = await getLastYearSameMonthPosts(storeId);

    if (!data) {
      return '📅 季節記憶\n\nまだデータがありません。\n\n投稿を続けることで、来年の今頃には「去年のこの時期はこんな投稿が好評でした」という提案ができるようになります！';
    }

    const { monthName, season, lastYearPosts, seasonPosts } = data;
    const relevantPosts = lastYearPosts.length > 0 ? lastYearPosts : seasonPosts;

    if (relevantPosts.length === 0) {
      return `📅 ${monthName}の季節記憶\n\n昨年の${monthName}（${season}）のデータはまだありません。\n\n投稿を続けると来年の参考になります！`;
    }

    const postList = relevantPosts
      .slice(0, 3)
      .map((p, i) => `${i + 1}. ${p.content.slice(0, 50)}${p.content.length > 50 ? '...' : ''}`)
      .join('\n\n');

    return `📅 ${monthName}（${season}）の記憶

昨年の${monthName}の投稿 ${relevantPosts.length}件:

${postList}

💡 この時期らしいキーワードや雰囲気を活かして投稿してみましょう！
画像を送ると自動的に季節感を反映した投稿を生成します。`;
  } catch (err) {
    console.error('[SeasonalMemory] 表示エラー:', err.message);
    return 'エラーが発生しました。';
  }
}
