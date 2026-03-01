/**
 * 案選択ハンドラー（Ver.17.0）
 * 3案（時間の肖像/誠実の肖像/光の肖像）から選択 → 確定 → スタイル学習
 */
import { replyText } from '../services/lineService.js';
import { updatePostContent, supabase } from '../services/supabaseService.js';
import { appendTemplateFooter } from '../utils/promptBuilder.js';
import { addSimpleBelief } from '../services/advancedPersonalization.js';

// スタイル名マッピング（Ver.17.0）
const STYLE_MAP = { A: '時間の肖像', B: '誠実の肖像', C: '光の肖像' };

/**
 * 案選択を処理
 * @param {Object} user - ユーザー情報
 * @param {Object} store - 店舗情報
 * @param {Object} latestPost - 直近の投稿（3案を含む）
 * @param {string} input - ユーザー入力（"A", "案B", "c", "1" 等）
 * @param {string} replyToken - LINE replyToken
 */
export async function handleProposalSelection(user, store, latestPost, input, replyToken) {
  // 1. 入力を正規化: "案A" "a" "1" → "A"
  const selection = normalizeSelection(input);
  if (!selection) {
    return await replyText(replyToken, 'A・B・C のどれにしますか？');
  }

  // 2. 選択した案を抽出
  const rawExtracted = extractSelectedProposal(latestPost.content, selection);
  if (!rawExtracted) {
    return await replyText(replyToken, `案${selection}がうまく取り出せませんでした。もう一度画像を送ってみてください`);
  }

  try {
    // 2.5. 日本語テキスト内の不自然な半角スペースを除去
    const extracted = cleanJapaneseSpaces(rawExtracted);

    // 3. テンプレートフッター適用 + 投稿内容を上書き
    const finalContent = appendTemplateFooter(extracted, store);
    await updatePostContent(latestPost.id, finalContent);

    // 4. スタイル選好を学習（失敗しても続行）
    const styleName = STYLE_MAP[selection];
    await updateStylePreference(store.id, styleName);

    // 5. 同じ案を3回以上連続選択 → 思想ログに追加
    await addBeliefFromSelection(store.id, selection);

    console.log(`[Proposal] 案${selection}（${styleName}）を選択: store=${store.name}`);

    // 5. 返信
    return await replyText(replyToken, `案${selection}（${styleName}）ですね！コピペでどうぞ👇
━━━━━━━━━━━
${finalContent}
━━━━━━━━━━━

気になるところがあれば「直し: 〜」で修正できます`);
  } catch (err) {
    console.error(`[Proposal] 案選択エラー: store=${store.name}`, err);
    return await replyText(replyToken, 'うまくいきませんでした...もう一度画像を送ってみてください');
  }
}

/**
 * 入力を正規化して A/B/C に変換
 * @param {string} input - "案A", "a", "1", "B" 等
 * @returns {'A'|'B'|'C'|null}
 */
export function normalizeSelection(input) {
  const cleaned = input.trim().toUpperCase()
    .replace('案', '')
    // M7: 全角英字→半角
    .replace('Ａ', 'A').replace('Ｂ', 'B').replace('Ｃ', 'C')
    .replace('１', '1').replace('２', '2').replace('３', '3');
  if (['A', '1'].includes(cleaned)) return 'A';
  if (['B', '2'].includes(cleaned)) return 'B';
  if (['C', '3'].includes(cleaned)) return 'C';
  return null;
}

/**
 * 日本語テキスト内の不自然な半角スペースを除去
 * Claude API が稀に日本語文字間に挿入する不要なスペースを除去する
 * 例: "マット な手触り" → "マットな手触り"、"温度差 ✨" → "温度差✨"
 * ※ 英単語間のスペース（"Diptyque, Byredo"）は保持
 */
export function cleanJapaneseSpaces(text) {
  if (!text) return text;
  return text
    // 日本語文字（ひらがな・カタカナ・漢字・句読点）の後ろの不要スペース
    .replace(/([\u3000-\u9FFF\uF900-\uFAFF]) +(?=[\u3000-\u9FFF\uF900-\uFAFF\u0021-\u007E])/g, '$1')
    // 日本語文字と絵文字の間の不要スペース
    .replace(/([\u3000-\u9FFF\uF900-\uFAFF]) +(?=[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}✨🌸💫🎵])/gu, '$1');
}

/**
 * 3案テキストから指定の案を抽出（+ Photo Advice を保持）
 * @param {string} fullContent - 3案全体のテキスト
 * @param {'A'|'B'|'C'} selection - 選択する案
 * @returns {string|null} 抽出されたテキスト
 */
export function extractSelectedProposal(fullContent, selection) {
  // [ 案A：時間の肖像 ] / [ 案B：誠実の肖像 ] / [ 案C：光の肖像 ] のマーカーを検出
  const markerPattern = /\[\s*案([ABC])[：:][^\]]*\]/g;
  const markers = [...fullContent.matchAll(markerPattern)];
  if (markers.length === 0) return null;

  // 選択した案のマーカーを見つける
  const targetIdx = markers.findIndex(m => m[1] === selection);
  if (targetIdx === -1) return null;

  const startPos = markers[targetIdx].index + markers[targetIdx][0].length;

  // 終了位置: 次の案マーカー or Photo Advice区切り線
  let endPos;
  if (targetIdx + 1 < markers.length) {
    endPos = markers[targetIdx + 1].index;
  } else {
    // 最後の案の場合は区切り線まで
    const dividerMatch = fullContent.slice(startPos).match(/\n━{5,}/);
    endPos = dividerMatch ? startPos + dividerMatch.index : fullContent.length;
  }

  const proposalText = fullContent.slice(startPos, endPos).trim();

  // Photo Advice セクションを抽出（全案共通・非貪欲マッチ）
  const adviceMatch = fullContent.match(/(━{5,}[\s\S]*?━{5,})/);
  const photoAdvice = adviceMatch ? '\n\n' + adviceMatch[1] : '';

  return proposalText + photoAdvice;
}

/**
 * スタイル選好カウントを learning_profiles に保存
 * @param {string} storeId - 店舗ID
 * @param {string} styleName - "時間の肖像" | "誠実の肖像" | "光の肖像"
 */
async function updateStylePreference(storeId, styleName) {
  try {
    const { data: profile, error: selectError } = await supabase
      .from('learning_profiles')
      .select('profile_data')
      .eq('store_id', storeId)
      .single();

    if (selectError || !profile) {
      console.warn('[Proposal] learning_profile未作成のため学習スキップ');
      return;
    }

    const profileData = profile.profile_data || {};
    const selections = profileData.style_selections || { '時間の肖像': 0, '誠実の肖像': 0, '光の肖像': 0, total: 0 };

    // H6: 旧キー（質感/空気/記憶）が残っている場合は新キーにマイグレーション
    if (selections['質感'] != null || selections['空気'] != null || selections['記憶'] != null) {
      selections['時間の肖像'] = (selections['時間の肖像'] || 0) + (selections['質感'] || 0);
      selections['誠実の肖像'] = (selections['誠実の肖像'] || 0) + (selections['空気'] || 0);
      selections['光の肖像'] = (selections['光の肖像'] || 0) + (selections['記憶'] || 0);
      delete selections['質感'];
      delete selections['空気'];
      delete selections['記憶'];
    }

    selections[styleName] = (selections[styleName] || 0) + 1;
    selections.total = (selections.total || 0) + 1;

    const { error: updateError } = await supabase
      .from('learning_profiles')
      .update({
        profile_data: { ...profileData, style_selections: selections },
      })
      .eq('store_id', storeId);

    if (updateError) {
      console.warn('[Proposal] スタイル学習の保存に失敗:', updateError.message);
      return;
    }

    console.log(`[Proposal] スタイル学習: ${styleName} (累計: 時間${selections['時間の肖像'] || 0}/誠実${selections['誠実の肖像'] || 0}/光${selections['光の肖像'] || 0})`);
  } catch (err) {
    console.warn('[Proposal] スタイル学習エラー（続行）:', err.message);
  }
}

/**
 * 同じ案を3回以上連続選択した場合、思想ログに追加
 */
const STYLE_BELIEFS = {
  A: '日常の一瞬を切り取る表現を好む',
  B: '誠実で正直な語り口を好む',
  C: '店主の独り言のような親しみやすさを好む',
};

async function addBeliefFromSelection(storeId, selection) {
  try {
    const { data: profile } = await supabase
      .from('learning_profiles')
      .select('profile_data')
      .eq('store_id', storeId)
      .single();

    if (!profile) return;

    const profileData = profile.profile_data || {};
    const selections = profileData.style_selections || {};
    const count = selections[STYLE_MAP[selection]] || 0;

    // 3回以上選択した場合のみ思想ログに追加
    if (count >= 3) {
      const belief = STYLE_BELIEFS[selection];
      if (belief) {
        await addSimpleBelief(storeId, belief, 'selection');
      }
    }
  } catch (err) {
    console.warn('[Proposal] 思想ログ追加エラー（続行）:', err.message);
  }
}
