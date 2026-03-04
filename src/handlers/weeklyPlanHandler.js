import { replyText, pushMessage } from '../services/lineService.js';
import { isFeatureEnabled } from '../services/subscriptionService.js';
import { generateWeeklyPlan, getLatestWeeklyPlan, formatWeeklyPlanMessage } from '../services/weeklyPlanService.js';
import { supabase } from '../services/supabaseService.js';

/** JST日付から今週の月曜日を取得 */
function getMonday(jstDate) {
  const d = new Date(jstDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 「今週の計画」コマンドハンドラー
 * - Premium: 最新の計画を表示（なければオンデマンド生成）
 * - 非Premium: アップグレード案内
 */
export async function handleWeeklyPlan(user, replyToken) {
  // Premium チェック
  const enabled = await isFeatureEnabled(user.id, 'weeklyContentPlan');
  if (!enabled) {
    return await replyText(replyToken,
      '📋 週間コンテンツ計画はプレミアムプランの機能です。\n\n「アップグレード」でプランを確認できます。');
  }

  if (!user.current_store_id) {
    return await replyText(replyToken,
      '先に店舗を登録してください。「登録」と送信すると始められます。');
  }

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('id', user.current_store_id)
    .single();

  if (!store) {
    return await replyText(replyToken, '店舗情報が見つかりません。');
  }

  try {
    // 今週の計画が既にあるか確認
    const existing = await getLatestWeeklyPlan(store.id);

    const JST_OFFSET = 9 * 60 * 60 * 1000;
    const nowJst = new Date(Date.now() + JST_OFFSET);
    const currentMonday = getMonday(nowJst);

    if (existing && new Date(existing.week_start).getTime() >= currentMonday.getTime()) {
      // 今週の計画がある → そのまま表示
      const message = formatWeeklyPlanMessage(existing);
      return await replyText(replyToken, message);
    }

    // 今週の計画がない → オンデマンド生成
    await replyText(replyToken, '📋 今週の計画を作成中です...（30秒ほどお待ちください）');

    const planContent = await generateWeeklyPlan(store, user.id);
    if (!planContent) {
      return await pushMessage(user.line_user_id, [{
        type: 'text',
        text: '計画の生成に失敗しました。しばらくしてからもう一度お試しください。',
      }]);
    }

    const plan = await getLatestWeeklyPlan(store.id);
    const message = formatWeeklyPlanMessage(plan);
    return await pushMessage(user.line_user_id, [{
      type: 'text',
      text: message,
    }]);
  } catch (err) {
    console.error('[WeeklyPlan] コマンドエラー:', err.message);
    try {
      await pushMessage(user.line_user_id, [{
        type: 'text',
        text: '計画の取得中にエラーが発生しました。しばらくしてからお試しください。',
      }]);
    } catch {
      // replyToken が使えるか試す
    }
  }
}
