import { replyText } from '../services/lineService.js';
import { supabase } from '../services/supabaseService.js';
import { getStore } from '../services/supabaseService.js';
import { saveEngagementMetrics } from '../services/collectiveIntelligence.js';

/**
 * 管理者かどうかをチェック
 */
function isAdmin(lineUserId) {
  const ADMIN_LINE_IDS = (process.env.ADMIN_LINE_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
  return ADMIN_LINE_IDS.includes(lineUserId);
}

/**
 * 管理者用: テストデータ投入
 * コマンド: /admin test-data カフェ 5
 */
export async function handleAdminTestData(user, args, replyToken) {
  if (!isAdmin(user.line_user_id)) {
    // 管理者以外には何も表示しない（コマンドを隠す）
    return false;
  }

  try {
    const [category, countStr] = args.trim().split(/\s+/);
    const count = parseInt(countStr, 10) || 5;

    if (!category) {
      await replyText(replyToken, '⚙️ 使い方: /admin test-data カフェ 5');
      return true;
    }

    // テストデータを生成
    const testPosts = generateTestData(category, count);

    let inserted = 0;
    for (const post of testPosts) {
      console.log('[Admin] テスト投稿データ:', post);

      const postData = {
        content: post.content,
      };

      const metricsData = {
        likes_count: post.likes,
        saves_count: post.saves,
        comments_count: post.comments,
        reach: post.likes * 10,
        engagement_rate: post.engagementRate,
      };

      console.log('[Admin] postData:', postData);
      console.log('[Admin] metricsData:', metricsData);

      await saveEngagementMetrics(null, category, postData, metricsData);
      inserted++;
    }

    await replyText(replyToken, `✅ テストデータ投入完了\n\n業種: ${category}\n件数: ${inserted}件`);
    return true;
  } catch (err) {
    console.error('[Admin] テストデータ投入エラー:', err.message);
    await replyText(replyToken, `❌ エラー: ${err.message}`);
    return true;
  }
}

/**
 * 管理者用: データベースクリア
 * コマンド: /admin clear-data
 */
export async function handleAdminClearData(user, replyToken) {
  if (!isAdmin(user.line_user_id)) {
    return false;
  }

  try {
    const { error, count } = await supabase
      .from('engagement_metrics')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 全削除

    if (error) throw error;

    await replyText(replyToken, `✅ データベースクリア完了\n\n削除件数: ${count || 0}件`);
    return true;
  } catch (err) {
    console.error('[Admin] データクリアエラー:', err.message);
    await replyText(replyToken, `❌ エラー: ${err.message}`);
    return true;
  }
}

/**
 * 管理者用メニュー
 */
export async function handleAdminMenu(user, replyToken) {
  if (!isAdmin(user.line_user_id)) {
    return false;
  }

  const message = `⚙️ 管理者メニュー

【テストデータ投入】
/admin test-data カフェ 5
→ カフェのテストデータを5件投入

【データベースクリア】
/admin clear-data
→ 全データを削除

【データ確認】
データ確認
→ 通常コマンドで確認`;

  await replyText(replyToken, message);
  return true;
}

/**
 * テストデータ生成
 */
function generateTestData(category, count) {
  const templates = {
    'カフェ': {
      contents: [
        '本日のおすすめブレンド☕',
        '新作ケーキが登場しました🍰',
        'ランチタイム限定セット開始',
        '自家焙煎コーヒー豆入荷',
        '季節のフルーツパフェ好評販売中',
      ],
      hashtags: [
        ['#カフェ', '#コーヒー', '#カフェ巡り'],
        ['#スイーツ', '#ケーキ', '#カフェスタグラム'],
        ['#ランチ', '#カフェランチ', '#おしゃれカフェ'],
        ['#コーヒー好き', '#珈琲', '#自家焙煎'],
        ['#パフェ', '#フルーツパフェ', '#カフェ好き'],
      ],
    },
    'ネイルサロン': {
      contents: [
        '春の新作デザイン💅',
        'シンプルワンカラーネイル',
        'ラメグラデーション人気です✨',
        '持ち込みデザインOK',
        '定額コース6000円から',
      ],
      hashtags: [
        ['#ネイル', '#ネイルデザイン', '#春ネイル'],
        ['#ワンカラーネイル', '#シンプルネイル', '#ジェルネイル'],
        ['#ラメネイル', '#グラデーションネイル', '#ネイルアート'],
        ['#ネイルサロン', '#持ち込みデザイン', '#ネイル好き'],
        ['#定額ネイル', '#お得ネイル', '#ネイルサロン'],
      ],
    },
    'ベーカリー': {
      contents: [
        '焼きたてクロワッサン🥐',
        '天然酵母の食パン販売中',
        '季節限定いちごデニッシュ',
        'ランチにサンドイッチはいかが',
        '明日の予約受付中です',
      ],
      hashtags: [
        ['#パン', '#ベーカリー', '#クロワッサン'],
        ['#食パン', '#天然酵母', '#パン屋'],
        ['#デニッシュ', '#いちご', '#パン好き'],
        ['#サンドイッチ', '#ランチ', '#パン屋さん'],
        ['#予約', '#焼きたてパン', '#ベーカリー'],
      ],
    },
  };

  const template = templates[category] || templates['カフェ'];
  const results = [];

  for (let i = 0; i < count; i++) {
    const idx = i % template.contents.length;
    const likes = Math.floor(Math.random() * 200) + 50;
    const saves = Math.floor(Math.random() * 30) + 5;
    const comments = Math.floor(Math.random() * 10) + 1;
    const reach = likes * 10;
    const engagement = ((likes + saves + comments) / reach * 100).toFixed(2);

    results.push({
      content: template.contents[idx],
      hashtags: template.hashtags[idx],
      likes,
      saves,
      comments,
      engagementRate: parseFloat(engagement),
      postTime: `${10 + Math.floor(Math.random() * 8)}:00`,
      dayOfWeek: Math.floor(Math.random() * 7),
    });
  }

  return results;
}
