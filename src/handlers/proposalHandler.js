/**
 * 案選択ハンドラー（Ver.18.0）
 * 1案ドン表示（Phase 1）: 内部3案 → A案をメイン表示 → 「別の案を見る」で B/C 表示
 */
import { replyText, replyWithQuickReply } from '../services/lineService.js';
import { updatePostContent, supabase } from '../services/supabaseService.js';
import { appendTemplateFooter } from '../utils/promptBuilder.js';
import { addSimpleBelief } from '../services/advancedPersonalization.js';
import { getInstagramAccount } from '../services/instagramService.js';
import { isFeatureEnabled } from '../services/subscriptionService.js';

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

    // 5. クイックリプライ構成（直し・学習 + ストック + Instagram投稿ボタン）
    const quickReplies = [
      { type: 'action', action: { type: 'message', label: '💾 ストック', text: 'ストック保存' } },
      { type: 'action', action: { type: 'message', label: '✏️ 直し', text: '直し:' } },
      { type: 'action', action: { type: 'message', label: '📝 学習', text: '学習:' } },
    ];

    // Instagram連携済み & 画像URLあり → 投稿ボタンを先頭に追加
    const igAccount = await getInstagramAccount(store.id).catch(() => null);
    console.log(`[Proposal] Instagram判定: igAccount=${!!igAccount}, image_url=${!!latestPost.image_url}, image_url値=${latestPost.image_url?.slice(0, 60) || 'null'}`);
    if (igAccount && latestPost.image_url) {
      quickReplies.unshift(
        { type: 'action', action: { type: 'message', label: '📸 Instagram投稿', text: 'instagram投稿' } },
        { type: 'action', action: { type: 'message', label: '📸 複数枚投稿', text: '複数枚投稿' } },
        { type: 'action', action: { type: 'message', label: '⏰ 予約投稿', text: '予約投稿' } },
      );
    }

    // 6. 返信
    console.log(`[Proposal] quickReplies数=${quickReplies.length}, labels=${quickReplies.map(q => q.action.label).join(', ')}`);
    return await replyWithQuickReply(replyToken, `案${selection}（${styleName}）ですね！コピペでどうぞ👇
━━━━━━━━━━━
${finalContent}
━━━━━━━━━━━

💡 自分だけの一言を足すと、もっと「あなたの投稿」になります
気になるところがあれば「学習: 〜」で修正＋今後にも反映`, quickReplies);
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

  // 終了位置: 次の案マーカー or Photo Advice区切り線 or 📸マーカー
  let endPos;
  if (targetIdx + 1 < markers.length) {
    endPos = markers[targetIdx + 1].index;
  } else {
    // 最後の案: ━━━区切り線 or 📸マーカーのどちらか先に見つかった方まで
    const remaining = fullContent.slice(startPos);
    const dividerMatch = remaining.match(/\n[━─―]{5,}/);
    const photoMarker = remaining.match(/\n📸/);
    const candidates = [];
    if (dividerMatch) candidates.push(dividerMatch.index);
    if (photoMarker) candidates.push(photoMarker.index);
    endPos = candidates.length > 0
      ? startPos + Math.min(...candidates)
      : fullContent.length;
  }

  const proposalText = fullContent.slice(startPos, endPos).trim();

  // Photo Advice セクションを抽出（━━━区切り or 📸マーカーで検出）
  const adviceDivider = fullContent.match(/([━─―]{5,}[\s\S]*?[━─―]{5,})\s*$/);
  const adviceByMarker = !adviceDivider ? fullContent.match(/(\n📸[\s\S]*)$/) : null;
  const photoAdvice = adviceDivider
    ? '\n\n' + adviceDivider[1]
    : adviceByMarker
      ? '\n\n' + adviceByMarker[1].trim()
      : '';

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

    // 2回以上選択した場合に思想ログに追加（学習の即時化）
    if (count >= 2) {
      const belief = STYLE_BELIEFS[selection];
      if (belief) {
        await addSimpleBelief(storeId, belief, 'selection');
      }
    }
  } catch (err) {
    console.warn('[Proposal] 思想ログ追加エラー（続行）:', err.message);
  }
}

/**
 * 「別の案を見る」ハンドラー — 案B/Cを表示
 * @param {Object} user - ユーザー情報
 * @param {Object} store - 店舗情報
 * @param {Object} latestPost - 直近の投稿（3案を含む）
 * @param {string} replyToken - LINE replyToken
 */
export async function handleShowAlternatives(user, store, latestPost, replyToken) {
  try {
    const proposalA = extractSelectedProposal(latestPost.content, 'A');
    const proposalB = extractSelectedProposal(latestPost.content, 'B');
    const proposalC = extractSelectedProposal(latestPost.content, 'C');

    if (!proposalA && !proposalB && !proposalC) {
      return await replyText(replyToken, '案が見つかりませんでした。もう一度写真を送ってみてください');
    }

    // 部分抽出のログ
    if (!proposalA || !proposalB || !proposalC) {
      console.warn(`[Proposal] 別案: 部分抽出 A=${!!proposalA}, B=${!!proposalB}, C=${!!proposalC}, store=${store.name}`);
    }

    // 「別案を見る」回数を記録（将来の分析用）
    await incrementAlternativesViewed(store.id);

    // 3案すべてを表示（比較して選べるように）
    // Photo Advice は各案から除外して最後に1回だけ追加
    const stripAdvice = (text) => {
      if (!text) return '';
      // ━━━区切り or 📸マーカー以降を除外
      const stripped = text.replace(/\n\n[━─―]{5,}[\s\S]*[━─―]{5,}\s*$/, '')
        .replace(/\n\n📸[\s\S]*$/, '').trim();
      return stripped || text.trim();
    };
    // Photo Advice を抽出（どの案からでもOK、全案共通）
    const firstProposal = proposalA || proposalB || proposalC;
    const adviceDivider = firstProposal ? firstProposal.match(/\n\n([━─―]{5,}[\s\S]*[━─―]{5,})\s*$/) : null;
    const adviceByMarker = !adviceDivider && firstProposal ? firstProposal.match(/\n\n(📸[\s\S]*)$/) : null;
    let photoAdvice = adviceDivider ? '\n\n' + adviceDivider[1]
      : adviceByMarker ? '\n\n' + adviceByMarker[1].trim()
      : '';
    // 非Premiumユーザーは💡次の被写体提案と🎯明日撮るべきものを除外
    const isPremium = await isFeatureEnabled(user.id, 'enhancedPhotoAdvice');
    if (!isPremium && photoAdvice) {
      photoAdvice = photoAdvice.replace(/\n💡 次はこんなのも[\s\S]*?(?=\n[━─―]|$)/, '').replace(/\n🎯 明日撮るべきもの[\s\S]*?(?=\n[━─―]|$)/, '');
    }

    const parts = [];
    if (proposalA) parts.push(`[ 案A ]\n${stripAdvice(proposalA)}`);
    if (proposalB) parts.push(`[ 案B ]\n${stripAdvice(proposalB)}`);
    if (proposalC) parts.push(`[ 案C ]\n${stripAdvice(proposalC)}`);

    const formattedReply = `3つの案を並べました👇
━━━━━━━━━━━
${parts.join('\n\n')}
━━━━━━━━━━━

気に入った案を選んでください${photoAdvice}`;

    const quickReplies = [];
    if (proposalA) quickReplies.push({ type: 'action', action: { type: 'message', label: '✅ A案', text: 'A' } });
    if (proposalB) quickReplies.push({ type: 'action', action: { type: 'message', label: '✅ B案', text: 'B' } });
    if (proposalC) quickReplies.push({ type: 'action', action: { type: 'message', label: '✅ C案', text: 'C' } });
    quickReplies.push({ type: 'action', action: { type: 'message', label: '📝 学習', text: '学習:' } });

    console.log(`[Proposal] 別案表示（3案比較）: store=${store.name}`);
    return await replyWithQuickReply(replyToken, formattedReply, quickReplies);
  } catch (err) {
    console.error(`[Proposal] 別案表示エラー: store=${store.name}`, err);
    return await replyText(replyToken, 'うまくいきませんでした...もう一度画像を送ってみてください');
  }
}

/**
 * 「別案を見る」の回数を記録（将来の分析用）
 */
async function incrementAlternativesViewed(storeId) {
  try {
    const { data: profile } = await supabase
      .from('learning_profiles')
      .select('profile_data')
      .eq('store_id', storeId)
      .single();

    if (!profile) return;

    const profileData = profile.profile_data || {};
    profileData.alternatives_viewed_count = (profileData.alternatives_viewed_count || 0) + 1;

    await supabase
      .from('learning_profiles')
      .update({ profile_data: profileData })
      .eq('store_id', storeId);
  } catch {
    // 分析用データなので失敗しても無視
  }
}
