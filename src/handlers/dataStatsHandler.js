import { replyText } from '../services/lineService.js';
import { supabase } from '../services/supabaseService.js';
import { getStore } from '../services/supabaseService.js';

/**
 * 集合知データ統計を表示
 */
export async function handleDataStats(user, replyToken) {
  try {
    // 全体のデータ件数
    const { count: totalCount } = await supabase
      .from('engagement_metrics')
      .select('*', { count: 'exact', head: true });

    // 業種別のデータ件数
    const { data: categoryStats } = await supabase
      .from('engagement_metrics')
      .select('category')
      .order('category');

    // 業種ごとにカウント
    const categoryCounts = {};
    if (categoryStats) {
      categoryStats.forEach(item => {
        const cat = item.category || 'その他';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
    }

    // 自分の貢献データ件数
    let myContribution = 0;
    if (user.current_store_id) {
      const store = await getStore(user.current_store_id);
      if (store) {
        const { count } = await supabase
          .from('engagement_metrics')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', store.id);
        myContribution = count || 0;
      }
    }

    // カテゴリー別トップ5
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, count]) => `  ${cat}: ${count}件`)
      .join('\n');

    const message = `📊 集合知データベースの状況

━━━━━━━━━━━━━━━
【全体統計】
━━━━━━━━━━━━━━━

🌍 総データ件数: ${totalCount || 0}件

【業種別データ件数 TOP5】
${topCategories || '  データなし'}

━━━━━━━━━━━━━━━
【あなたの貢献】
━━━━━━━━━━━━━━━

✨ あなたの報告: ${myContribution}件

━━━━━━━━━━━━━━━

${totalCount === 0 ?
  '📝 まだデータがありません。\n「報告: いいね〇〇, 保存〇〇, コメント〇〇」\nで集合知を育てましょう！' :
  '🌱 みんなで育てる集合知が成長中！\nあなたの報告が、他のユーザーの投稿を改善します✨'}`;

    await replyText(replyToken, message);
  } catch (err) {
    console.error('[DataStats] データ統計取得エラー:', err.message);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
  }
}
