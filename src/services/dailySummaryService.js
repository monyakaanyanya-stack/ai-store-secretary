import { supabase } from './supabaseService.js';

/**
 * 本日の統計データを集計
 */
export async function collectDailySummary() {
  const now = new Date();

  // JST の今日の開始・終了時刻を UTC に変換
  const jstOffset = 9 * 60 * 60 * 1000; // 9時間
  const todayStartJST = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEndJST = new Date(todayStartJST.getTime() + 24 * 60 * 60 * 1000);

  const todayStartUTC = new Date(todayStartJST.getTime() - jstOffset).toISOString();
  const todayEndUTC = new Date(todayEndJST.getTime() - jstOffset).toISOString();

  // 投稿生成数（本日分）
  const { count: postsGenerated } = await supabase
    .from('post_history')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStartUTC)
    .lt('created_at', todayEndUTC);

  // フィードバック数（本日分）
  const { count: feedbackCount } = await supabase
    .from('learning_data')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'feedback')
    .gte('created_at', todayStartUTC)
    .lt('created_at', todayEndUTC);

  // 新規店舗数（本日分）
  const { count: newStores } = await supabase
    .from('stores')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStartUTC)
    .lt('created_at', todayEndUTC);

  return {
    postsGenerated: postsGenerated || 0,
    feedbackCount: feedbackCount || 0,
    errorCount: 0, // 将来の拡張用（現在は0固定）
    newStores: newStores || 0,
  };
}
