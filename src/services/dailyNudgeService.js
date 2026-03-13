import { supabase } from './supabaseService.js';
import { pushMessage } from './lineService.js';
import { getUserSubscription } from './subscriptionService.js';
import { askClaude } from './claudeService.js';
import { findCategoryByLabel } from '../config/categoryDictionary.js';
import { getTemplatesForGroup } from '../config/nudgeTemplates.js';
import { getBlendedInsights } from './collectiveIntelligence.js';
import { buildStrategicAdvice } from '../utils/promptBuilder.js';

/**
 * デイリー撮影ナッジ: 今日まだ投稿を生成していないStandard/Premiumユーザーに
 * カテゴリ別の具体的な撮影提案を送信する
 *
 * - 17:00 JST（UTC 8:00）にスケジューラーから呼ばれる
 * - Freeプランはスキップ（LINE Push通数削減）
 * - 今日投稿済みのユーザーはスキップ
 * - Standard: テンプレートベースの撮影提案
 * - Premium: Claude APIで個別生成（失敗時テンプレートにフォールバック）
 */
export async function sendDailyPhotoNudges() {
  console.log('[DailyNudge] 撮影ナッジ送信開始');

  try {
    // リマインダー有効なユーザーを取得（reminder_enabled が null または true）
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .or('reminder_enabled.is.null,reminder_enabled.eq.true');

    if (userError) {
      console.error('[DailyNudge] ユーザー取得エラー:', userError.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('[DailyNudge] 対象ユーザーなし');
      return;
    }

    // Instagram連携済み店舗のstore_idを取得（連携済みユーザーはスキップ）
    let instagramLinkedStoreIds = new Set();
    try {
      const { data: igAccounts } = await supabase
        .from('instagram_accounts')
        .select('store_id')
        .eq('is_active', true);
      if (igAccounts) {
        instagramLinkedStoreIds = new Set(igAccounts.map(a => a.store_id));
      }
    } catch (err) {
      console.warn('[DailyNudge] Instagram連携チェック失敗（続行）:', err.message);
    }

    let sentCount = 0;
    let skipCount = 0;
    let igSkipCount = 0;
    let freeSkipCount = 0;
    let postedSkipCount = 0;
    let errorCount = 0;
    const sentLineUserIds = new Set(); // 重複防止用

    for (const user of users) {
      // 重複チェック
      if (sentLineUserIds.has(user.line_user_id)) {
        skipCount++;
        continue;
      }

      // current_store_id がないユーザーはスキップ
      if (!user.current_store_id) {
        skipCount++;
        continue;
      }

      // Instagram連携済みの店舗を使っている場合はスキップ
      if (instagramLinkedStoreIds.has(user.current_store_id)) {
        igSkipCount++;
        continue;
      }

      // Freeプランユーザーはスキップ（Push通数削減）
      let sub;
      try {
        sub = await getUserSubscription(user.id);
        if (sub.plan === 'free') {
          freeSkipCount++;
          continue;
        }
      } catch (subErr) {
        console.warn(`[DailyNudge] サブスク確認失敗（スキップ）: ${user.line_user_id.slice(0, 4)}****`);
        continue;
      }

      // 今日投稿済みかチェック
      try {
        const posted = await hasPostedToday(user.current_store_id);
        if (posted) {
          postedSkipCount++;
          continue;
        }
      } catch (err) {
        console.warn(`[DailyNudge] 投稿チェック失敗（スキップ）: ${user.line_user_id.slice(0, 4)}****`);
        continue;
      }

      // 店舗情報取得
      let store;
      try {
        const { data: storeData } = await supabase
          .from('stores')
          .select('*')
          .eq('id', user.current_store_id)
          .single();
        store = storeData;
      } catch (err) {
        skipCount++;
        continue;
      }

      if (!store) {
        skipCount++;
        continue;
      }

      // ナッジ送信
      try {
        const isPremium = sub.plan === 'premium';
        await sendNudgeToUser(user.line_user_id, store, isPremium);
        sentLineUserIds.add(user.line_user_id);
        sentCount++;

        // レート制限対策: 各送信間に100ms待機
        await sleep(100);
      } catch (err) {
        console.error(`[DailyNudge] 送信エラー: ${user.line_user_id.slice(0, 4)}****`, err.message);
        errorCount++;
      }
    }

    console.log(`[DailyNudge] 撮影ナッジ送信完了: 送信=${sentCount}, 投稿済み=${postedSkipCount}, IG連携=${igSkipCount}, Free=${freeSkipCount}, スキップ=${skipCount}, エラー=${errorCount}`);
  } catch (err) {
    console.error('[DailyNudge] 撮影ナッジ送信エラー:', err.message);
  }
}

// ==================== 内部関数 ====================

/**
 * 今日（JST基準）に投稿を生成済みかチェック
 */
async function hasPostedToday(storeId) {
  const { todayStartUTC, todayEndUTC } = getTodayRangeUtc();

  const { count, error } = await supabase
    .from('post_history')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .gte('created_at', todayStartUTC)
    .lt('created_at', todayEndUTC);

  if (error) {
    throw new Error(`投稿チェックエラー: ${error.message}`);
  }

  return (count || 0) > 0;
}

/**
 * 今日のJST日付範囲をUTCで返す
 */
function getTodayRangeUtc() {
  const nowJst = getNowJst();
  const todayJst = new Date(nowJst.getFullYear(), nowJst.getMonth(), nowJst.getDate());

  // JST 00:00 → UTC（-9時間）
  const todayStartUTC = new Date(todayJst.getTime() - 9 * 60 * 60 * 1000).toISOString();
  // JST 翌日 00:00 → UTC
  const tomorrowJst = new Date(todayJst.getTime() + 24 * 60 * 60 * 1000);
  const todayEndUTC = new Date(tomorrowJst.getTime() - 9 * 60 * 60 * 1000).toISOString();

  return { todayStartUTC, todayEndUTC };
}

/**
 * 現在のJST時刻を取得
 */
function getNowJst() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

/**
 * 現在の季節を取得
 */
function getSeasonLabel(month) {
  if (month >= 3 && month <= 5) return '春';
  if (month >= 6 && month <= 8) return '夏';
  if (month >= 9 && month <= 11) return '秋';
  return '冬';
}

/**
 * テンプレートからナッジを選択
 * カテゴリのグループに合ったテンプレートを季節フィルタ付きでランダム選択
 */
function pickTemplateNudge(category, season) {
  // カテゴリからグループを特定
  const categoryInfo = findCategoryByLabel(category);
  const groupId = categoryInfo ? categoryInfo.groupId : 'food'; // フォールバック

  const templates = getTemplatesForGroup(groupId);

  // 季節に合うテンプレートを優先（通年 + 現在の季節）
  const seasonFiltered = templates.filter(t => t.season === null || t.season === season);

  // フィルタ結果が空なら全テンプレートからランダム
  const pool = seasonFiltered.length > 0 ? seasonFiltered : templates;

  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

/**
 * ナッジメッセージをフォーマット（戦略Tips付き）
 */
function formatNudgeMessage(nudge, strategicAdvice = null) {
  let text = `今日はまだ投稿がありません。\nおすすめ：「${nudge.subject}」\n${nudge.cameraTip}\n${nudge.description}`;

  // 戦略アドバイスがあれば追加
  const tips = [];
  if (strategicAdvice?.postingTimeTip) tips.push(strategicAdvice.postingTimeTip);
  if (strategicAdvice?.photoStyleTip) tips.push(strategicAdvice.photoStyleTip);
  if (tips.length > 0) {
    text += `\n\n💡 ${tips.join('\n💡 ')}`;
  }

  return text;
}

/**
 * Premium用: Claude APIでパーソナライズされた撮影提案を生成
 * 失敗時はテンプレートにフォールバック
 */
async function generatePremiumNudge(store, season, strategicAdvice = null) {
  const prompt = buildPremiumNudgePrompt(store, season, strategicAdvice);

  try {
    const response = await askClaude(prompt, { maxTokens: 300 });

    // JSON部分を抽出（コードブロックで囲まれている場合も対応）
    const jsonMatch = response.match(/\{[\s\S]*?"subject"[\s\S]*?"cameraTip"[\s\S]*?"description"[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.subject && parsed.cameraTip && parsed.description) {
        return parsed;
      }
    }

    // パース失敗時はテンプレートにフォールバック
    console.warn('[DailyNudge] Premium API レスポンスのパース失敗、テンプレートにフォールバック');
    return null;
  } catch (err) {
    console.warn('[DailyNudge] Premium API エラー、テンプレートにフォールバック:', err.message);
    return null;
  }
}

/**
 * Premium用のClaude APIプロンプトを構築（戦略データ付き）
 */
function buildPremiumNudgePrompt(store, season, strategicAdvice = null) {
  // 戦略データセクション構築
  let dataHintSection = '';
  if (strategicAdvice) {
    const hints = [];
    if (strategicAdvice.postingTimeTip) hints.push(`- ${strategicAdvice.postingTimeTip}`);
    if (strategicAdvice.photoStyleTip) hints.push(`- ${strategicAdvice.photoStyleTip}`);
    if (strategicAdvice.contentTip) hints.push(`- ${strategicAdvice.contentTip}`);
    if (hints.length > 0) {
      dataHintSection = `\n\n【データに基づくヒント（参考にして提案すること）】\n${hints.join('\n')}`;
    }
  }

  return `あなたは「写真観察AI」です。${store.name}（${store.category}）の店主をサポートしています。
今日の夕方に撮れる、Instagramに投稿するための写真のアイデアを1つ提案してください。

【店舗情報】
- 店名: ${store.name}
- 業種: ${store.category}
- こだわり: ${store.strength || '未設定'}
- 季節: ${season}${dataHintSection}

【出力ルール】
以下のJSON形式のみ出力。前置き不要。
{
  "subject": "撮影対象（10-20文字）",
  "cameraTip": "撮り方のヒント（スマホ前提・15-30文字）",
  "description": "なぜこれを撮ると良いか（20-40文字）"
}

【ルール】
1. 店主が「あ、撮るか」と思える具体性。抽象指示禁止
2. スマホで撮れるものだけ。機材・レンズ用語禁止
3. 今の季節・時間帯に自然なもの
4. 完成品より裏側・途中・手元を優先
5. 禁止ワード: 幻想的/素敵/魅力的/素晴らしい/完璧/最高/美しい`;
}

/**
 * 個別ユーザーにナッジを送信
 */
async function sendNudgeToUser(lineUserId, store, isPremium) {
  const nowJst = getNowJst();
  const season = getSeasonLabel(nowJst.getMonth() + 1);

  // 戦略アドバイス取得（失敗しても続行）
  let strategicAdvice = null;
  try {
    if (store.category) {
      const blendedInsights = await getBlendedInsights(store.id, store.category);
      strategicAdvice = buildStrategicAdvice(blendedInsights, store);
    }
  } catch (err) {
    console.warn('[DailyNudge] 戦略アドバイス取得失敗（続行）:', err.message);
  }

  let nudge = null;

  // Premium: Claude APIで生成を試みる（戦略データ付き）
  if (isPremium) {
    nudge = await generatePremiumNudge(store, season, strategicAdvice);
  }

  // Standard or Premium API失敗時: テンプレートから選択
  if (!nudge) {
    nudge = pickTemplateNudge(store.category, season);
  }

  const text = formatNudgeMessage(nudge, strategicAdvice);
  const message = { type: 'text', text };

  await pushMessage(lineUserId, [message]);
  console.log(`[DailyNudge] 送信完了: ${lineUserId.slice(0, 4)}**** (${isPremium ? 'Premium/AI' : 'Standard/Template'})`);
}

/**
 * スリープ関数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
