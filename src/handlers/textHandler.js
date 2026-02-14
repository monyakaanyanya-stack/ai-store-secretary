import { replyText } from '../services/lineService.js';
import { askClaude } from '../services/claudeService.js';
import {
  createStore,
  updateCurrentStore,
  getStore,
  getStoresByUser,
  savePostHistory,
  supabase,
} from '../services/supabaseService.js';
import { handleFeedback } from './feedbackHandler.js';
import { buildStoreParsePrompt, buildTextPostPrompt } from '../utils/promptBuilder.js';
import { aggregateLearningData } from '../utils/learningData.js';

/**
 * テキストメッセージの振り分け処理
 */
export async function handleTextMessage(user, text, replyToken) {
  const trimmed = text.trim();

  // 店舗登録: 「1:」で始まる
  if (trimmed.startsWith('1:') || trimmed.startsWith('1:')) {
    return await handleStoreRegistration(user, trimmed, replyToken);
  }

  // フィードバック: 「直し:」で始まる
  if (trimmed.startsWith('直し:') || trimmed.startsWith('直し:')) {
    const feedback = trimmed.replace(/^直し[:：]\s*/, '');
    return await handleFeedback(user, feedback, replyToken);
  }

  // 店舗切替: 「切替:」で始まる
  if (trimmed.startsWith('切替:') || trimmed.startsWith('切替:')) {
    const storeName = trimmed.replace(/^切替[:：]\s*/, '');
    return await handleStoreSwitch(user, storeName, replyToken);
  }

  // ヘルプ
  if (trimmed === 'ヘルプ' || trimmed === 'help') {
    return await replyText(replyToken, HELP_TEXT);
  }

  // 店舗一覧
  if (trimmed === '店舗一覧') {
    return await handleStoreList(user, replyToken);
  }

  // 店舗更新
  if (trimmed === '店舗更新') {
    return await handleStoreUpdatePrompt(user, replyToken);
  }

  // 店舗更新の実行: 「更新: name: 新店名」など
  if (trimmed.startsWith('更新:') || trimmed.startsWith('更新:')) {
    const updateData = trimmed.replace(/^更新[:：]\s*/, '');
    return await handleStoreUpdate(user, updateData, replyToken);
  }

  // それ以外 → テキストから投稿生成
  return await handleTextPostGeneration(user, trimmed, replyToken);
}

// ==================== 店舗登録 ====================

async function handleStoreRegistration(user, text, replyToken) {
  const input = text.replace(/^1[:：]\s*/, '');

  try {
    // Claude で入力テキストを解析
    const prompt = buildStoreParsePrompt(input);
    const jsonStr = await askClaude(prompt);

    let storeData;
    try {
      storeData = JSON.parse(jsonStr);
    } catch {
      return await replyText(replyToken,
        '入力の解析に失敗しました。\n\n以下の形式で送ってください:\n1: 店名,こだわり,口調\n\n例: 1: ベーカリー幸福堂,天然酵母の手作りパン,friendly'
      );
    }

    // DB に保存
    const store = await createStore(user.id, storeData);
    await updateCurrentStore(user.id, store.id);

    console.log(`[Store] 登録完了: ${store.name} (${store.id})`);
    await replyText(replyToken,
      `✅ 店舗「${store.name}」を登録しました！\n\nこだわり: ${store.strength}\n口調: ${store.tone}\n\nこの店舗が選択中です。画像やテキストを送ると投稿案を作成します。`
    );
  } catch (err) {
    console.error('[Store] 登録エラー:', err.message);
    await replyText(replyToken, `店舗登録中にエラーが発生しました: ${err.message}`);
  }
}

// ==================== 店舗切替 ====================

async function handleStoreSwitch(user, storeName, replyToken) {
  try {
    const stores = await getStoresByUser(user.id);

    if (stores.length === 0) {
      return await replyText(replyToken, '店舗がまだ登録されていません。\n\n1: 店名,こだわり,口調\n\nの形式で登録してください。');
    }

    const target = stores.find(s =>
      s.name === storeName || s.name.includes(storeName)
    );

    if (!target) {
      const list = stores.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
      return await replyText(replyToken, `「${storeName}」が見つかりません。\n\n登録済み店舗:\n${list}\n\n切替: 店舗名 で切り替えてください。`);
    }

    await updateCurrentStore(user.id, target.id);
    await replyText(replyToken, `✅ 店舗を「${target.name}」に切り替えました。`);
  } catch (err) {
    console.error('[Store] 切替エラー:', err.message);
    await replyText(replyToken, `店舗切替中にエラーが発生しました: ${err.message}`);
  }
}

// ==================== 店舗一覧 ====================

async function handleStoreList(user, replyToken) {
  try {
    const stores = await getStoresByUser(user.id);

    if (stores.length === 0) {
      return await replyText(replyToken, '店舗がまだ登録されていません。\n\n1: 店名,こだわり,口調\n\nの形式で登録してください。');
    }

    const list = stores.map((s, i) => {
      const current = s.id === user.current_store_id ? ' ← 選択中' : '';
      return `${i + 1}. ${s.name}${current}`;
    }).join('\n');

    await replyText(replyToken, `📋 登録済み店舗:\n${list}\n\n切替: 店舗名 で切り替えられます。`);
  } catch (err) {
    console.error('[Store] 一覧エラー:', err.message);
    await replyText(replyToken, 'エラーが発生しました。');
  }
}

// ==================== テキスト投稿生成 ====================

async function handleTextPostGeneration(user, text, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken,
      '店舗が選択されていません。\n\nまず店舗を登録してください:\n1: 店名,こだわり,口調\n\n例: 1: ベーカリー幸福堂,天然酵母の手作りパン,friendly'
    );
  }

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '選択中の店舗が見つかりません。店舗一覧 で確認してください。');
    }

    const learningData = await aggregateLearningData(store.id);
    const prompt = buildTextPostPrompt(store, learningData, text);
    const postContent = await askClaude(prompt);

    // 投稿履歴に保存
    await savePostHistory(user.id, store.id, postContent);

    console.log(`[Post] テキスト投稿生成完了: store=${store.name}`);
    await replyText(replyToken, `✨ 投稿案ができました！\n\n${postContent}`);
  } catch (err) {
    console.error('[Post] テキスト投稿生成エラー:', err.message);
    await replyText(replyToken, `投稿生成中にエラーが発生しました: ${err.message}`);
  }
}

// ==================== 店舗更新プロンプト ====================

async function handleStoreUpdatePrompt(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。先に店舗を登録してください。');
  }

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '選択中の店舗が見つかりません。');
    }

    const message = `📝 現在の店舗設定

【店舗名】${store.name}
【こだわり・強み】${store.strength}
【口調】${store.tone}

何を変更しますか？
以下の形式で送信してください：

更新: name: 新しい店名
更新: strength: 新しいこだわり
更新: tone: friendly

または複数同時に：
更新: name: 新店名, strength: 新しいこだわり, tone: casual`;

    await replyText(replyToken, message);
  } catch (err) {
    console.error('[Store] 更新プロンプトエラー:', err.message);
    await replyText(replyToken, 'エラーが発生しました。');
  }
}

// ==================== 店舗更新実行 ====================

async function handleStoreUpdate(user, updateData, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '選択中の店舗が見つかりません。');
    }

    // Parse: "name: 新店名, strength: 新しいこだわり, tone: casual"
    const pairs = updateData.split(',').map(p => p.trim());
    const updates = {};

    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex === -1) continue;

      const key = pair.slice(0, colonIndex).trim();
      const value = pair.slice(colonIndex + 1).trim();

      if (key === 'name') {
        updates.name = value;
      } else if (key === 'strength') {
        updates.strength = value;
      } else if (key === 'tone') {
        const validTones = ['friendly', 'professional', 'casual', 'passionate', 'luxury'];
        if (validTones.includes(value)) {
          updates.tone = value;
        } else {
          return await replyText(replyToken,
            `口調は以下のいずれかを指定してください:\nfriendly / professional / casual / passionate / luxury`
          );
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return await replyText(replyToken,
        '更新する内容を指定してください。\n\n例:\n更新: name: 新店名\n更新: strength: 新しいこだわり\n更新: tone: casual'
      );
    }

    // データベース更新
    const { error } = await supabase
      .from('stores')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', store.id);

    if (error) throw new Error(`更新失敗: ${error.message}`);

    // 更新内容を確認
    const summary = [];
    if (updates.name) summary.push(`店舗名: ${updates.name}`);
    if (updates.strength) summary.push(`こだわり: ${updates.strength}`);
    if (updates.tone) summary.push(`口調: ${updates.tone}`);

    console.log(`[Store] 更新完了: ${store.name} → ${summary.join(', ')}`);
    await replyText(replyToken, `✅ 店舗情報を更新しました！\n\n${summary.join('\n')}`);
  } catch (err) {
    console.error('[Store] 更新エラー:', err.message);
    await replyText(replyToken, `更新中にエラーが発生しました: ${err.message}`);
  }
}

// ==================== ヘルプ ====================

const HELP_TEXT = `📖 AI店舗秘書の使い方

【店舗登録】
1: 店名,こだわり,口調
例: 1: ベーカリー幸福堂,天然酵母の手作りパン,friendly

口調は以下から選べます:
friendly / professional / casual / passionate / luxury

【投稿生成】
・画像を送信 → 画像から投稿案を作成
・テキストを送信 → テキストから投稿案を作成

【投稿修正】
直し: もっとカジュアルに

【店舗管理】
・店舗一覧 → 登録済み店舗を表示
・切替: 店舗名 → 別の店舗に切り替え
・店舗更新 → 店舗情報を変更（対話形式）

【ヘルプ】
・ヘルプ → この説明を表示`;
