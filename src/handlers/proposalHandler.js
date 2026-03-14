/**
 * 案選択ハンドラー（Ver.19.0）
 * 旧3案投稿の後方互換を維持 + style_selections 学習を削除
 */
import { replyText, replyWithQuickReply } from '../services/lineService.js';
import { updatePostContent, supabase } from '../services/supabaseService.js';
import { appendTemplateFooter } from '../utils/promptBuilder.js';
import { getInstagramAccount } from '../services/instagramService.js';
import { isFeatureEnabled } from '../services/subscriptionService.js';

/**
 * 案選択を処理（旧3案投稿の後方互換）
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

    console.log(`[Proposal] 案${selection}を選択: store=${store.name}`);

    // 4. クイックリプライ構成
    const quickReplies = [
      { type: 'action', action: { type: 'message', label: '💾 ストック', text: 'ストック保存' } },
      { type: 'action', action: { type: 'message', label: '📝 学習', text: '学習:' } },
    ];

    // Instagram連携済み & 画像URLあり → 投稿ボタンを先頭に追加
    const igAccount = await getInstagramAccount(store.id).catch(() => null);
    if (igAccount && latestPost.image_url) {
      quickReplies.unshift(
        { type: 'action', action: { type: 'message', label: '📸 Instagram投稿', text: 'instagram投稿' } },
        { type: 'action', action: { type: 'message', label: '📸 複数枚投稿', text: '複数枚投稿' } },
        { type: 'action', action: { type: 'message', label: '⏰ 予約投稿', text: '予約投稿' } },
      );
    }

    // 5. 返信
    return await replyWithQuickReply(replyToken, `案${selection}ですね！コピペでどうぞ👇
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
 */
export function cleanJapaneseSpaces(text) {
  if (!text) return text;
  return text
    .replace(/([\u3000-\u9FFF\uF900-\uFAFF]) +(?=[\u3000-\u9FFF\uF900-\uFAFF\u0021-\u007E])/g, '$1')
    .replace(/([\u3000-\u9FFF\uF900-\uFAFF]) +(?=[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}✨🌸💫🎵])/gu, '$1');
}

/**
 * 3案テキストから指定の案を抽出（+ Photo Advice を保持）— 旧投稿の後方互換
 * @param {string} fullContent - 3案全体のテキスト
 * @param {'A'|'B'|'C'} selection - 選択する案
 * @returns {string|null} 抽出されたテキスト
 */
export function extractSelectedProposal(fullContent, selection) {
  const markerPattern = /\[\s*案([ABC])[：:][^\]]*\]/g;
  const markers = [...fullContent.matchAll(markerPattern)];
  if (markers.length === 0) return null;

  const targetIdx = markers.findIndex(m => m[1] === selection);
  if (targetIdx === -1) return null;

  const startPos = markers[targetIdx].index + markers[targetIdx][0].length;

  let endPos;
  if (targetIdx + 1 < markers.length) {
    endPos = markers[targetIdx + 1].index;
  } else {
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
 * 「別の案を見る」ハンドラー — 旧3案投稿のみ。なければ「別案」ボタンへ誘導
 */
export async function handleShowAlternatives(user, store, latestPost, replyToken) {
  try {
    const proposalA = extractSelectedProposal(latestPost.content, 'A');
    const proposalB = extractSelectedProposal(latestPost.content, 'B');
    const proposalC = extractSelectedProposal(latestPost.content, 'C');

    if (!proposalA && !proposalB && !proposalC) {
      return await replyText(replyToken, '案が見つかりませんでした。もう一度写真を送ってみてください');
    }

    // Photo Advice を除外
    const stripAdvice = (text) => {
      if (!text) return '';
      const stripped = text.replace(/\n\n[━─―]{5,}[\s\S]*[━─―]{5,}\s*$/, '')
        .replace(/\n\n📸[\s\S]*$/, '').trim();
      return stripped || text.trim();
    };
    const firstProposal = proposalA || proposalB || proposalC;
    const adviceDivider = firstProposal ? firstProposal.match(/\n\n([━─―]{5,}[\s\S]*[━─―]{5,})\s*$/) : null;
    const adviceByMarker = !adviceDivider && firstProposal ? firstProposal.match(/\n\n(📸[\s\S]*)$/) : null;
    let photoAdvice = adviceDivider ? '\n\n' + adviceDivider[1]
      : adviceByMarker ? '\n\n' + adviceByMarker[1].trim()
      : '';
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

    console.log(`[Proposal] 別案表示（旧3案比較）: store=${store.name}`);
    return await replyWithQuickReply(replyToken, formattedReply, quickReplies);
  } catch (err) {
    console.error(`[Proposal] 別案表示エラー: store=${store.name}`, err);
    return await replyText(replyToken, 'うまくいきませんでした...もう一度画像を送ってみてください');
  }
}
