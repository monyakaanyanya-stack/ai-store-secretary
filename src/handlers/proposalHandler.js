/**
 * 案選択ハンドラー（Ver.13.0）
 * 3案（質感/空気/記憶）から選択 → 確定 → スタイル学習
 */
import { replyText } from '../services/lineService.js';
import { updatePostContent, supabase } from '../services/supabaseService.js';
import { appendTemplateFooter } from '../utils/promptBuilder.js';

// スタイル名マッピング
const STYLE_MAP = { A: '質感', B: '空気', C: '記憶' };

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
    return await replyText(replyToken, 'A・B・C のいずれかを送ってください');
  }

  // 2. 選択した案を抽出
  const extracted = extractSelectedProposal(latestPost.content, selection);
  if (!extracted) {
    return await replyText(replyToken, `案${selection}の抽出に失敗しました。もう一度画像を送ってお試しください。`);
  }

  // 3. テンプレートフッター適用 + 投稿内容を上書き
  const finalContent = appendTemplateFooter(extracted, store);
  await updatePostContent(latestPost.id, finalContent);

  // 4. スタイル選好を学習
  const styleName = STYLE_MAP[selection];
  await updateStylePreference(store.id, styleName);

  console.log(`[Proposal] 案${selection}（${styleName}）を選択: store=${store.name}`);

  // 5. 返信
  return await replyText(replyToken, `✅ 案${selection}（${styleName}）を選びました！

コピーしてInstagramに貼り付けてください↓
━━━━━━━━━━━
${finalContent}
━━━━━━━━━━━

修正があれば「直し: 〜」でどうぞ
👍 良い / 👎 イマイチ で学習します`);
}

/**
 * 入力を正規化して A/B/C に変換
 * @param {string} input - "案A", "a", "1", "B" 等
 * @returns {'A'|'B'|'C'|null}
 */
export function normalizeSelection(input) {
  const cleaned = input.trim().toUpperCase().replace('案', '');
  if (['A', '1'].includes(cleaned)) return 'A';
  if (['B', '2'].includes(cleaned)) return 'B';
  if (['C', '3'].includes(cleaned)) return 'C';
  return null;
}

/**
 * 3案テキストから指定の案を抽出（+ Photo Advice を保持）
 * @param {string} fullContent - 3案全体のテキスト
 * @param {'A'|'B'|'C'} selection - 選択する案
 * @returns {string|null} 抽出されたテキスト
 */
export function extractSelectedProposal(fullContent, selection) {
  // [ 案A：質感 ] / [ 案B：空気 ] / [ 案C：記憶 ] のマーカーを検出
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

  // Photo Advice セクションを抽出（全案共通）
  const adviceMatch = fullContent.match(/(━{5,}[\s\S]*━{5,})/);
  const photoAdvice = adviceMatch ? '\n\n' + adviceMatch[1] : '';

  return proposalText + photoAdvice;
}

/**
 * スタイル選好カウントを learning_profiles に保存
 * @param {string} storeId - 店舗ID
 * @param {string} styleName - "質感" | "空気" | "記憶"
 */
async function updateStylePreference(storeId, styleName) {
  try {
    const { data: profile } = await supabase
      .from('learning_profiles')
      .select('profile_data')
      .eq('store_id', storeId)
      .single();

    if (!profile) {
      console.warn('[Proposal] learning_profile未作成のため学習スキップ');
      return;
    }

    const profileData = profile.profile_data || {};
    const selections = profileData.style_selections || { 質感: 0, 空気: 0, 記憶: 0, total: 0 };

    selections[styleName] = (selections[styleName] || 0) + 1;
    selections.total = (selections.total || 0) + 1;

    await supabase
      .from('learning_profiles')
      .update({
        profile_data: { ...profileData, style_selections: selections },
      })
      .eq('store_id', storeId);

    console.log(`[Proposal] スタイル学習: ${styleName} (累計: 質感${selections.質感}/空気${selections.空気}/記憶${selections.記憶})`);
  } catch (err) {
    console.warn('[Proposal] スタイル学習エラー（続行）:', err.message);
  }
}
