import { supabase } from './supabaseService.js';
import { askClaude } from './claudeService.js';
import { getBlendedInsights, getCategoryInsights } from './collectiveIntelligence.js';
import { getAdvancedPersonalizationPrompt } from './advancedPersonalization.js';
import { pushMessage } from './lineService.js';
import { normalizeCategory } from '../config/categoryDictionary.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** JST日付から今週の月曜日を取得（プロンプトの月〜金日付計算用） */
function getMonday(jstDate) {
  const d = new Date(jstDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** JST日付から今週の日曜日を取得（キャッシュ・DB保存の週境界用） */
function getWeekStartSunday(jstDate) {
  const d = new Date(jstDate);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 現在のJST日時を取得 */
function getNowJst() {
  const JST_OFFSET = 9 * 60 * 60 * 1000;
  return new Date(Date.now() + JST_OFFSET);
}

// ── 異業種インサイト取得 ──────────────────────────────────

/**
 * 自店と違うカテゴリーから成功パターンを1件取得
 * @param {string} storeCategory - 店舗カテゴリー
 * @returns {Promise<Object|null>}
 */
async function getCrossIndustryInsight(storeCategory) {
  try {
    const normalizedOwn = normalizeCategory(storeCategory) || storeCategory;

    // 異業種の高パフォーマンス投稿を集計
    const { data, error } = await supabase
      .from('engagement_metrics')
      .select('category, save_intensity, post_content, hashtags')
      .neq('category', normalizedOwn)
      .eq('status', '報告済')
      .order('save_intensity', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return null;

    // カテゴリーごとに平均保存強度を計算
    const categoryStats = {};
    for (const row of data) {
      if (!categoryStats[row.category]) {
        categoryStats[row.category] = { total: 0, count: 0, topContent: row.post_content };
      }
      categoryStats[row.category].total += row.save_intensity;
      categoryStats[row.category].count++;
    }

    // 最も保存強度が高いカテゴリーを選択
    let bestCategory = null;
    let bestAvg = 0;
    for (const [cat, stats] of Object.entries(categoryStats)) {
      const avg = stats.total / stats.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestCategory = cat;
      }
    }

    if (!bestCategory) return null;

    return {
      category: bestCategory,
      avgSaveIntensity: bestAvg.toFixed(2),
      sampleContent: categoryStats[bestCategory].topContent?.slice(0, 80) || '',
    };
  } catch (err) {
    console.error('[WeeklyPlan] 異業種インサイト取得エラー:', err.message);
    return null;
  }
}

/**
 * 過去テーマのプロンプトセクションを構築
 */
function buildPastThemesSection(pastThemes) {
  if (!pastThemes || pastThemes.length === 0) return '';

  const lines = pastThemes.map(w =>
    `- ${w.weekStart}週: ${w.themes.join('、')}`
  ).join('\n');

  return `
【過去の計画テーマ（重複を避けること）】
${lines}
→ 上記と同じテーマ・切り口は使わず、新しい視点で計画すること
`;
}

// ── プロンプト構築 ──────────────────────────────────

/**
 * 週間計画用のClaude APIプロンプトを構築
 */
function buildWeeklyPlanPrompt(store, blendedInsights, crossIndustryData, personalization, pastThemes = []) {
  // 自店舗データが十分にある場合は自店舗の最適時間を優先
  // データが溜まるほど、その店舗固有の最適時間に収束する
  const ownHours = blendedInsights?.own?.bestPostingHours;
  const ownSampleSize = blendedInsights?.own?.sampleSize || 0;
  const bestHours = (ownSampleSize >= 5 && ownHours?.length > 0)
    ? ownHours
    : blendedInsights?.category?.bestPostingHours
      || blendedInsights?.group?.bestPostingHours
      || [12, 18, 20];

  const winningPattern = blendedInsights?.own?.winningPattern
    || blendedInsights?.category?.winningPattern;

  let winPatternSection = '';
  if (winningPattern) {
    winPatternSection = `
【この店舗のデータ傾向】
- 保存されやすい書き出し: ${winningPattern.dominantHookType || '未取得'}
- 保存されやすい文字数帯: ${winningPattern.dominantCharBucket || '未取得'}
- サンプル数: ${winningPattern.sampleSize || 0}件`;
  }

  let crossIndustrySection = '';
  if (crossIndustryData) {
    crossIndustrySection = `
【異業種インサイト（1つだけ計画に混ぜること）】
業種: ${crossIndustryData.category}
平均保存強度: ${crossIndustryData.avgSaveIntensity}
→ これを${store.category}の文脈に翻訳して、5日のうち1日に組み込む`;
  }

  const nowJst = getNowJst();
  const monday = getMonday(nowJst);
  const dayNames = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日'];
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    days.push(`${dayNames[i]} (${d.getMonth() + 1}/${d.getDate()})`);
  }

  const datesForJson = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    datesForJson.push(d.toISOString().split('T')[0]);
  }

  return `${personalization}
あなたは${store.name}（${store.category}）の「影の秘書」です。
今週（${days[0]}〜${days[4]}）の5日間のInstagramコンテンツ計画を作成してください。

【店舗情報】
- 店名: ${store.name}
- 業種: ${store.category}
- こだわり: ${store.strength || '未設定'}
- 口調: ${store.tone || 'casual'}

【最適投稿時間帯（${ownSampleSize >= 5 ? 'この店舗の実績データ' : '同業種の傾向データ'}に基づく）】
${bestHours.map(h => `${h}:00`).join(', ')}
※ データソース: ${ownSampleSize >= 5 ? `自店舗${ownSampleSize}件のエンゲージメント分析` : ownSampleSize > 0 ? `自店舗${ownSampleSize}件+同業種データ（5件以上で自店舗優先に切替）` : '同業種の全体傾向'}
${winPatternSection}
${crossIndustrySection}
${buildPastThemesSection(pastThemes)}
【出力ルール】
以下のJSON形式のみ出力。説明文や前置きは一切不要。

{
  "days": [
    {
      "dayOfWeek": "${dayNames[0]}",
      "date": "${datesForJson[0]}",
      "theme": "テーマ名（5-15文字）",
      "shootingInstruction": "具体的な撮影指示（何を・どのアングルで・どのタイミングで撮るか。50-100文字）",
      "bestPostingTime": "HH:00",
      "reason": "このテーマが効く理由（データ根拠があれば含める。30-50文字）"
    }
  ],
  "crossIndustryInsight": {
    "sourceCategory": "異業種名",
    "insight": "異業種の成功パターンをこの店に翻訳した提案（50-80文字）",
    "applicableDay": "適用する曜日"
  }
}

【計画の質を高めるルール】
1. 5日間で同じテーマの繰り返しを避ける（日常系・商品系・ストーリー系・裏側系・お客様系などバリエーション）
2. 撮影指示は「具体的な被写体・アングル・タイミング」を指定。曖昧指示は禁止
3. 異業種インサイトがある場合は必ず1日分に組み込む
4. 各日の投稿時間は bestPostingHours のデータに基づいて選ぶ
5. テーマは店主が「それ面白いかも」と思える具体性があること
6. crossIndustryInsight がない場合は null にする
7. 撮影指示には必ず「完璧ではない、生きた事実」を1つ混ぜる。
   完成品や理想の瞬間ではなく、使い込まれた痕跡・作業途中の手元・閉店後の静けさなど「その場にいないと気づかないリアル」を切り取らせる。
   ただし「傷」「汚れ」などの直接的な言葉は使わず、どの業種でも自然に当てはまる表現で指示すること。
   例: ×「道具の傷を撮れ」 → ○「毎日触れているからこそ手に馴染んだ道具を、作業の流れの中で」
8. 撮影指示にカメラ機材・レンズ・専門用語を使わない。店主はスマホで撮る前提。
   「マクロレンズで」「広角で」ではなく、身体の動作で伝える。
   例: ×「マクロレンズで接写」 → ○「スマホをぐっと近づけて、指先が写り込むくらいの距離で」
   例: ×「引きの広角で全体を」 → ○「2歩下がって、お店の空気ごと1枚に収める感じで」`;
}

// ── 計画生成・保存 ──────────────────────────────────

/**
 * 週間コンテンツ計画を生成（1店舗分）
 * @param {Object} store - stores テーブルの行
 * @param {string} userId - users.id
 * @returns {Promise<Object|null>} - 生成された計画データ
 */
export async function generateWeeklyPlan(store, userId) {
  try {
    console.log(`[WeeklyPlan] 生成開始: store=${store.name} (${store.id})`);

    // 並列でデータ取得
    const [blendedInsights, personalization, crossIndustryData, pastThemes] = await Promise.all([
      getBlendedInsights(store.id, store.category).catch(() => null),
      getAdvancedPersonalizationPrompt(store.id).catch(() => ''),
      getCrossIndustryInsight(store.category),
      getPastWeeklyThemes(store.id, 3).catch(() => []),
    ]);

    const prompt = buildWeeklyPlanPrompt(store, blendedInsights, crossIndustryData, personalization, pastThemes);

    const response = await askClaude(prompt, {
      max_tokens: 2048,
      temperature: 0.7,
    });

    // JSONを抽出（Claude がJSON以外のテキストを含む場合の対策）
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[WeeklyPlan] JSON抽出失敗:', response.slice(0, 200));
      return null;
    }

    const planContent = JSON.parse(jsonMatch[0]);

    // バリデーション
    if (!planContent.days || !Array.isArray(planContent.days) || planContent.days.length === 0) {
      console.error('[WeeklyPlan] 不正な計画構造:', planContent);
      return null;
    }

    // DB保存（週の境界は日曜基準）
    const nowJst = getNowJst();
    const weekStart = getWeekStartSunday(nowJst);
    await saveWeeklyPlan(store.id, userId, weekStart, planContent);

    console.log(`[WeeklyPlan] 生成完了: store=${store.name}, ${planContent.days.length}日分`);
    return planContent;
  } catch (err) {
    console.error(`[WeeklyPlan] 生成エラー (store=${store.name}):`, err.message);
    return null;
  }
}

/**
 * 計画をDBに保存（UPSERT: 同じ店舗・同じ週は上書き）
 */
async function saveWeeklyPlan(storeId, userId, weekStart, planContent) {
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const { error } = await supabase
    .from('weekly_content_plans')
    .upsert({
      store_id: storeId,
      user_id: userId,
      week_start: weekStartStr,
      plan_content: planContent,
    }, {
      onConflict: 'store_id,week_start',
    });

  if (error) {
    throw new Error(`週間計画保存エラー: ${error.message}`);
  }
}

/**
 * 過去N週分のテーマ一覧を取得（重複回避用）
 */
async function getPastWeeklyThemes(storeId, weeks = 3) {
  const { data } = await supabase
    .from('weekly_content_plans')
    .select('week_start, plan_content')
    .eq('store_id', storeId)
    .order('week_start', { ascending: false })
    .limit(weeks);

  if (!data || data.length === 0) return [];

  return data.map(row => ({
    weekStart: row.week_start,
    themes: (row.plan_content?.days || []).map(d => d.theme).filter(Boolean),
  }));
}

// ── 計画取得・表示 ──────────────────────────────────

/**
 * 最新の週間計画を取得
 * @param {string} storeId
 * @returns {Promise<Object|null>}
 */
export async function getLatestWeeklyPlan(storeId) {
  const { data, error } = await supabase
    .from('weekly_content_plans')
    .select('*')
    .eq('store_id', storeId)
    .order('week_start', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * 週間計画をLINEメッセージフォーマットに変換
 * @param {Object} plan - weekly_content_plans の行
 * @returns {string}
 */
export function formatWeeklyPlanMessage(plan) {
  const content = plan.plan_content;
  const days = content.days || [];

  let message = '📋 今週のコンテンツ計画\n━━━━━━━━━━━━━━━\n';

  for (const day of days) {
    message += `\n📅 ${day.dayOfWeek} (${day.date?.slice(5).replace('-', '/')})\n`;
    message += `テーマ: ${day.theme}\n`;
    message += `📸 ${day.shootingInstruction}\n`;
    message += `⏰ 投稿: ${day.bestPostingTime}\n`;
    if (day.reason) {
      message += `💡 ${day.reason}\n`;
    }
  }

  if (content.crossIndustryInsight) {
    const ci = content.crossIndustryInsight;
    message += `\n━━━━━━━━━━━━━━━\n`;
    message += `🌐 異業種ヒント（${ci.applicableDay || '今週'}に活用）\n`;
    message += `${ci.sourceCategory}業界: ${ci.insight}\n`;
  }

  message += `\n━━━━━━━━━━━━━━━`;
  message += `\n\nまた確認したいときは【今週の計画】とお伝えください`;
  return message;
}

// ── Cron用: 全Premiumユーザーに送信 ──────────────────────────────────

/**
 * 全Premiumユーザーに週間計画を生成・送信
 * scheduler.js の cron ジョブから呼ばれる
 */
export async function sendWeeklyPlansToAllPremium() {
  const SUBSCRIPTION_ENABLED = process.env.SUBSCRIPTION_ENABLED === 'true';

  let targetUsers;

  if (SUBSCRIPTION_ENABLED) {
    // サブスク有効: premium ユーザーのみ
    const { data: subs, error: subErr } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('plan', 'premium')
      .in('status', ['active', 'trialing']);

    if (subErr || !subs || subs.length === 0) {
      console.log('[WeeklyPlan] 対象Premiumユーザーなし');
      return;
    }

    const userIds = subs.map(s => s.user_id);
    const { data: users, error: userErr } = await supabase
      .from('users')
      .select('id, line_user_id, current_store_id')
      .in('id', userIds);

    if (userErr || !users) {
      console.error('[WeeklyPlan] ユーザー取得エラー:', userErr?.message);
      return;
    }
    targetUsers = users;
  } else {
    // サブスク無効: 全ユーザーが対象（全員premium扱い）
    const { data: users, error: userErr } = await supabase
      .from('users')
      .select('id, line_user_id, current_store_id')
      .not('current_store_id', 'is', null);

    if (userErr || !users) {
      console.error('[WeeklyPlan] ユーザー取得エラー:', userErr?.message);
      return;
    }
    targetUsers = users;
  }

  console.log(`[WeeklyPlan] 対象ユーザー: ${targetUsers.length}人`);

  let sentCount = 0;
  let errorCount = 0;

  for (const user of targetUsers) {
    try {
      if (!user.current_store_id) continue;

      const { data: store } = await supabase
        .from('stores')
        .select('*')
        .eq('id', user.current_store_id)
        .single();

      if (!store) continue;

      const planContent = await generateWeeklyPlan(store, user.id);
      if (!planContent) {
        errorCount++;
        continue;
      }

      const plan = await getLatestWeeklyPlan(store.id);
      if (!plan) continue;

      const message = formatWeeklyPlanMessage(plan);
      await pushMessage(user.line_user_id, [{
        type: 'text',
        text: message,
      }]);

      sentCount++;
      await sleep(100);
    } catch (err) {
      console.error(`[WeeklyPlan] 送信エラー (user=${user.id}):`, err.message);
      errorCount++;
    }
  }

  console.log(`[WeeklyPlan] 完了: 送信=${sentCount}, エラー=${errorCount}`);
}
