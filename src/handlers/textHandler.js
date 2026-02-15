import { replyText } from '../services/lineService.js';
import { askClaude } from '../services/claudeService.js';
import {
  createStore,
  updateCurrentStore,
  getStore,
  getStoresByUser,
  savePostHistory,
  supabase,
  updateStoreConfig,
  updateStoreTemplates,
} from '../services/supabaseService.js';
import { handleFeedback } from './feedbackHandler.js';
import { handleEngagementReport, handlePostSelection } from './reportHandler.js';
import { handleOnboardingStart, handleHelpMenu, handleHelpCategory } from './onboardingHandler.js';
import { buildStoreParsePrompt, buildTextPostPrompt, POST_LENGTH_MAP } from '../utils/promptBuilder.js';
import { aggregateLearningData } from '../utils/learningData.js';
import { getBlendedInsights, saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { getPersonalizationPromptAddition, getLearningStatus } from '../services/personalizationEngine.js';

/**
 * テキストメッセージの振り分け処理
 */
export async function handleTextMessage(user, text, replyToken) {
  const trimmed = text.trim();

  // オンボーディング: 「登録」コマンド
  if (trimmed === '登録') {
    return await handleOnboardingStart(user, replyToken);
  }

  // 店舗登録: 「1:」で始まる
  if (trimmed.startsWith('1:') || trimmed.startsWith('1:')) {
    return await handleStoreRegistration(user, trimmed, replyToken);
  }

  // フィードバック: 「直し:」で始まる
  if (trimmed.startsWith('直し:') || trimmed.startsWith('直し:')) {
    const feedback = trimmed.replace(/^直し[:：]\s*/, '');
    return await handleFeedback(user, feedback, replyToken);
  }

  // エンゲージメント報告: 「報告:」で始まる
  if (trimmed.startsWith('報告:') || trimmed.startsWith('報告:')) {
    return await handleEngagementReport(user, trimmed, replyToken);
  }

  // 店舗切替: 「切替:」で始まる
  if (trimmed.startsWith('切替:') || trimmed.startsWith('切替:')) {
    const storeName = trimmed.replace(/^切替[:：]\s*/, '');
    return await handleStoreSwitch(user, storeName, replyToken);
  }

  // ヘルプ: 階層型メニュー
  if (trimmed === 'ヘルプ' || trimmed === 'help') {
    return await handleHelpMenu(user, replyToken);
  }

  // ヘルプカテゴリー選択: 数字またはカテゴリー名
  const helpHandled = await handleHelpCategory(user, trimmed, replyToken);
  if (helpHandled !== null) {
    return;
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

  // 文章量設定: 「長さ: short」など
  if (trimmed.startsWith('長さ:') || trimmed.startsWith('長さ:')) {
    const length = trimmed.replace(/^長さ[:：]\s*/, '');
    return await handlePostLength(user, length, replyToken);
  }

  // テンプレート設定: 「テンプレート: address:住所」など
  if (trimmed.startsWith('テンプレート:') || trimmed.startsWith('テンプレート:')) {
    const templateData = trimmed.replace(/^テンプレート[:：]\s*/, '');
    return await handleTemplate(user, templateData, replyToken);
  }

  // 設定確認
  if (trimmed === 'テンプレート確認' || trimmed === '設定確認') {
    return await handleShowSettings(user, replyToken);
  }

  // 学習状況
  if (trimmed === '学習状況' || trimmed === '学習') {
    return await handleLearningStatus(user, replyToken);
  }

  // 👍 良い評価
  if (trimmed === '👍') {
    return await handlePositiveFeedback(user, replyToken);
  }

  // 👎 イマイチ評価
  if (trimmed === '👎') {
    return await handleNegativeFeedback(user, replyToken);
  }

  // テンプレート削除（対話開始）
  if (trimmed === 'テンプレート削除') {
    return await handleTemplateDeletePrompt(user, replyToken);
  }

  // テンプレート削除の実行: 「削除: address」など
  if (trimmed.startsWith('削除:') || trimmed.startsWith('削除:')) {
    const fieldToDelete = trimmed.replace(/^削除[:：]\s*/, '');
    return await handleTemplateDelete(user, fieldToDelete, replyToken);
  }

  // リマインダー停止
  if (trimmed === 'リマインダー停止' || trimmed === 'リマインダー無効') {
    return await handleDisableReminder(user, replyToken);
  }

  // リマインダー再開
  if (trimmed === 'リマインダー再開' || trimmed === 'リマインダー有効') {
    return await handleEnableReminder(user, replyToken);
  }

  // 個別文章量指定: 「超短文で: 新商品のケーキ」
  const lengthMatch = trimmed.match(/^(超短文|短文|中文|長文)で[:：]\s*(.+)/);
  if (lengthMatch) {
    const lengthMap = { '超短文': 'xshort', '短文': 'short', '中文': 'medium', '長文': 'long' };
    const length = lengthMap[lengthMatch[1]];
    const content = lengthMatch[2];
    return await handleTextPostGenerationWithLength(user, content, replyToken, length);
  }

  // 投稿番号選択（pending_reportがある場合）
  const postSelectionHandled = await handlePostSelection(user, trimmed, replyToken);
  if (postSelectionHandled) {
    return; // 処理完了
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
        '入力の解析に失敗しました。\n\n以下の形式で送ってください:\n1: 業種,店名,こだわり,口調\n\n例: 1: ベーカリー,幸福堂,天然酵母の手作りパン,friendly'
      );
    }

    // DB に保存
    const store = await createStore(user.id, storeData);
    await updateCurrentStore(user.id, store.id);

    console.log(`[Store] 登録完了: ${store.category} - ${store.name} (${store.id})`);
    await replyText(replyToken,
      `✅ 店舗「${store.name}」を登録しました！\n\n業種: ${store.category || '未設定'}\nこだわり: ${store.strength}\n口調: ${store.tone}\n\nこの店舗が選択中です。画像やテキストを送ると投稿案を作成します。`
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
      return await replyText(replyToken, '店舗がまだ登録されていません。\n\n1: 業種,店名,こだわり,口調\n\nの形式で登録してください。');
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
      return await replyText(replyToken, '店舗がまだ登録されていません。\n\n1: 業種,店名,こだわり,口調\n\nの形式で登録してください。');
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

    // 集合知を取得（カテゴリーが設定されている場合のみ）
    let blendedInsights = null;
    if (store.category) {
      blendedInsights = await getBlendedInsights(store.id, store.category);
      console.log(`[Post] 集合知取得: category=${store.category}, group=${blendedInsights.categoryGroup}`);
    }

    // パーソナライゼーション情報を取得
    const personalization = await getPersonalizationPromptAddition(store.id);

    const prompt = buildTextPostPrompt(store, learningData, text, null, blendedInsights, personalization);
    const postContent = await askClaude(prompt);

    // 投稿履歴に保存
    const savedPost = await savePostHistory(user.id, store.id, postContent);

    // エンゲージメントメトリクスを保存（初期値）
    if (store.category) {
      await saveEngagementMetrics(store.id, store.category, {
        post_id: savedPost.id,
        content: postContent,
      });
    }

    console.log(`[Post] テキスト投稿生成完了: store=${store.name}`);

    // 学習プロファイルを取得して学習回数を確認
    const { getOrCreateLearningProfile } = await import('../services/personalizationEngine.js');
    const profile = await getOrCreateLearningProfile(store.id);
    const learningBadge = profile && profile.interaction_count > 0 ? `（あなたの学習スタイルで生成 📚 学習回数: ${profile.interaction_count}回）` : '';

    // コピペしやすい形式でフォーマット
    const formattedReply = `✨ 投稿案ができました！${learningBadge}

以下をコピーしてInstagramに貼り付けてください↓
━━━━━━━━━━━
${postContent}
━━━━━━━━━━━

この投稿は良かったですか？
👍 良い（「👍」と送信）
👎 イマイチ（「👎」と送信）
✏️ 修正する（「直し: 〜」で指示してください）

※ 評価を送ると自動的に学習します！
※ 「学習状況」と送ると学習内容を確認できます`;

    await replyText(replyToken, formattedReply);
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

// ==================== 文章量設定 ====================

async function handlePostLength(user, lengthParam, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const validLengths = Object.keys(POST_LENGTH_MAP);

    if (!validLengths.includes(lengthParam)) {
      return await replyText(replyToken,
        `長さ指定は以下のいずれかで入力してください:\n\n長さ: xshort (50-80文字)\n長さ: short (100-150文字)\n長さ: medium (200-300文字)\n長さ: long (400-500文字)`
      );
    }

    const newConfig = {
      ...(store.config || {}),
      post_length: lengthParam
    };

    await updateStoreConfig(store.id, newConfig);

    const lengthInfo = POST_LENGTH_MAP[lengthParam];
    await replyText(replyToken,
      `✅ デフォルトの投稿長を「${lengthInfo.description} (${lengthInfo.range})」に設定しました。`
    );
  } catch (err) {
    console.error('[Settings] 長さ設定エラー:', err.message);
    await replyText(replyToken, `設定中にエラーが発生しました: ${err.message}`);
  }
}

// ==================== テンプレート設定 ====================

async function handleTemplate(user, templateData, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);

    // Parse: "address: 東京都渋谷区, business_hours: 10:00-20:00, website: https://..."
    const pairs = templateData.split(',').map(p => p.trim());
    const templates = { ...(store.config?.templates || {}) };

    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex === -1) continue;

      const key = pair.slice(0, colonIndex).trim();
      const value = pair.slice(colonIndex + 1).trim();

      if (key === 'address') {
        templates.address = value;
      } else if (key === 'business_hours') {
        templates.business_hours = value;
      } else {
        templates.custom_fields = templates.custom_fields || {};
        templates.custom_fields[key] = value;
      }
    }

    await updateStoreTemplates(store.id, templates);

    const summary = [];
    if (templates.address) summary.push(`住所: ${templates.address}`);
    if (templates.business_hours) summary.push(`営業時間: ${templates.business_hours}`);
    if (templates.custom_fields) {
      Object.entries(templates.custom_fields).forEach(([k, v]) => {
        summary.push(`${k}: ${v}`);
      });
    }

    await replyText(replyToken,
      `✅ テンプレート情報を更新しました:\n\n${summary.join('\n')}`
    );
  } catch (err) {
    console.error('[Template] 更新エラー:', err.message);
    await replyText(replyToken, `更新中にエラーが発生しました: ${err.message}`);
  }
}

// ==================== 設定確認 ====================

async function handleShowSettings(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const config = store.config || {};
    const lengthInfo = POST_LENGTH_MAP[config.post_length || 'medium'];

    let message = `📋 現在の設定\n\n【店舗名】${store.name}\n【投稿長】${lengthInfo.description} (${lengthInfo.range})\n`;

    const templates = config.templates || {};
    if (templates.address || templates.business_hours || Object.keys(templates.custom_fields || {}).length > 0) {
      message += '\n【テンプレート】\n';
      if (templates.address) message += `住所: ${templates.address}\n`;
      if (templates.business_hours) message += `営業時間: ${templates.business_hours}\n`;
      Object.entries(templates.custom_fields || {}).forEach(([k, v]) => {
        message += `${k}: ${v}\n`;
      });
    } else {
      message += '\n【テンプレート】未設定';
    }

    await replyText(replyToken, message);
  } catch (err) {
    console.error('[Settings] 確認エラー:', err.message);
    await replyText(replyToken, `エラーが発生しました: ${err.message}`);
  }
}

// ==================== 個別文章量指定での投稿生成 ====================

async function handleTextPostGenerationWithLength(user, text, replyToken, lengthOverride) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。先に店舗を登録してください。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const learningData = await aggregateLearningData(store.id);

    // 集合知を取得（カテゴリーが設定されている場合のみ）
    let blendedInsights = null;
    if (store.category) {
      blendedInsights = await getBlendedInsights(store.id, store.category);
    }

    // パーソナライゼーション情報を取得
    const personalization = await getPersonalizationPromptAddition(store.id);

    const prompt = buildTextPostPrompt(store, learningData, text, lengthOverride, blendedInsights, personalization);
    const postContent = await askClaude(prompt);

    const savedPost = await savePostHistory(user.id, store.id, postContent);

    // エンゲージメントメトリクスを保存（初期値）
    if (store.category) {
      await saveEngagementMetrics(store.id, store.category, {
        post_id: savedPost.id,
        content: postContent,
      });
    }

    console.log(`[Post] テキスト投稿生成完了 (length=${lengthOverride}): store=${store.name}`);

    // 学習プロファイルを取得して学習回数を確認
    const { getOrCreateLearningProfile } = await import('../services/personalizationEngine.js');
    const profile = await getOrCreateLearningProfile(store.id);
    const learningBadge = profile && profile.interaction_count > 0 ? `（あなたの学習スタイルで生成 📚 学習回数: ${profile.interaction_count}回）` : '';

    // コピペしやすい形式でフォーマット
    const formattedReply = `✨ 投稿案ができました！${learningBadge}

以下をコピーしてInstagramに貼り付けてください↓
━━━━━━━━━━━
${postContent}
━━━━━━━━━━━

この投稿は良かったですか？
👍 良い（「👍」と送信）
👎 イマイチ（「👎」と送信）
✏️ 修正する（「直し: 〜」で指示してください）

※ 評価を送ると自動的に学習します！
※ 「学習状況」と送ると学習内容を確認できます`;

    await replyText(replyToken, formattedReply);
  } catch (err) {
    console.error('[Post] 生成エラー:', err.message);
    await replyText(replyToken, `投稿生成中にエラーが発生しました: ${err.message}`);
  }
}

// ==================== テンプレート削除プロンプト ====================

async function handleTemplateDeletePrompt(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const templates = store.config?.templates || {};

    // テンプレートがない場合
    if (!templates.address && !templates.business_hours && !Object.keys(templates.custom_fields || {}).length) {
      return await replyText(replyToken, '削除できるテンプレートがありません。');
    }

    // 削除可能なフィールドをリスト化
    const fields = [];
    if (templates.address) fields.push('address (住所)');
    if (templates.business_hours) fields.push('business_hours (営業時間)');
    if (templates.custom_fields) {
      Object.keys(templates.custom_fields).forEach(key => {
        fields.push(`${key}`);
      });
    }

    const message = `🗑️ テンプレート削除

削除したいフィールドを選んでください：

【登録済みフィールド】
${fields.map((f, i) => `${i + 1}. ${f}`).join('\n')}

削除方法：
削除: address
削除: business_hours
削除: カスタムフィールド名

全削除する場合：
削除: all`;

    await replyText(replyToken, message);
  } catch (err) {
    console.error('[Template] 削除プロンプトエラー:', err.message);
    await replyText(replyToken, `エラーが発生しました: ${err.message}`);
  }
}

// ==================== テンプレート削除実行 ====================

async function handleTemplateDelete(user, fieldToDelete, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const templates = { ...(store.config?.templates || {}) };

    // 全削除
    if (fieldToDelete === 'all' || fieldToDelete === '全て') {
      const newConfig = {
        ...(store.config || {}),
        templates: {}
      };
      await updateStoreConfig(store.id, newConfig);
      return await replyText(replyToken, '✅ すべてのテンプレートを削除しました。');
    }

    // 個別削除
    let deleted = false;
    const deletedFields = [];

    if (fieldToDelete === 'address' && templates.address) {
      delete templates.address;
      deleted = true;
      deletedFields.push('住所');
    }

    if (fieldToDelete === 'business_hours' && templates.business_hours) {
      delete templates.business_hours;
      deleted = true;
      deletedFields.push('営業時間');
    }

    // カスタムフィールド削除
    if (templates.custom_fields && templates.custom_fields[fieldToDelete]) {
      delete templates.custom_fields[fieldToDelete];
      deleted = true;
      deletedFields.push(fieldToDelete);

      // custom_fields が空になったら削除
      if (Object.keys(templates.custom_fields).length === 0) {
        delete templates.custom_fields;
      }
    }

    if (!deleted) {
      return await replyText(replyToken, `「${fieldToDelete}」というフィールドは見つかりませんでした。\n\n設定確認 でテンプレートを確認してください。`);
    }

    // 更新を保存
    const newConfig = {
      ...(store.config || {}),
      templates
    };
    await updateStoreConfig(store.id, newConfig);

    await replyText(replyToken, `✅ テンプレートを削除しました:\n${deletedFields.join(', ')}`);
  } catch (err) {
    console.error('[Template] 削除エラー:', err.message);
    await replyText(replyToken, `削除中にエラーが発生しました: ${err.message}`);
  }
}

// ==================== 学習状況表示 ====================

async function handleLearningStatus(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const status = await getLearningStatus(store.id, store.category);
    await replyText(replyToken, status);
  } catch (err) {
    console.error('[Learning] 学習状況取得エラー:', err.message);
    await replyText(replyToken, `学習状況の取得中にエラーが発生しました: ${err.message}`);
  }
}

// ==================== ヘルプ ====================

const HELP_TEXT = `📖 AI店舗秘書の使い方

【店舗登録】
1: 店名,こだわり,口調
例: 1: ベーカリー幸福堂,天然酵母の手作りパン,friendly

口調は以下から選べます:
casual（タメ口） / friendly（親しみやすい） / professional（丁寧）

【投稿生成】
・画像を送信 → 画像から投稿案を作成
・テキストを送信 → テキストから投稿案を作成
・超短文で: 〇〇 → 超短い投稿を作成（50-80文字）
・短文で: 〇〇 → 短い投稿を作成（100-150文字）
・長文で: 〇〇 → 長い投稿を作成（400-500文字）

【投稿修正】
直し: もっとカジュアルに

【設定】
・長さ: xshort / short / medium / long → デフォルトの投稿長を設定
・テンプレート: address:住所,business_hours:営業時間 → テンプレート登録
・テンプレート削除 → テンプレート削除（対話形式）
・設定確認 → 現在の設定を表示
・学習状況 → AI学習の進捗を確認

【店舗管理】
・店舗一覧 → 登録済み店舗を表示
・切替: 店舗名 → 別の店舗に切り替え
・店舗更新 → 店舗情報を変更（対話形式）

【ヘルプ】
・ヘルプ → この説明を表示`;

// ==================== 👍 良い評価のハンドラー ====================

async function handlePositiveFeedback(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const { data: latestPost } = await supabase
      .from('post_history')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestPost) {
      return await replyText(replyToken, 'まだ投稿がありません。');
    }

    // パーソナライゼーションエンジンに学習させる
    const { applyFeedbackToProfile } = await import('../services/personalizationEngine.js');
    await applyFeedbackToProfile(store.id, '👍 良い投稿として学習', latestPost.content);

    console.log(`[Feedback] 👍 良い評価: store=${store.name}`);
    await replyText(replyToken, '👍 ありがとうございます！\n\nこのスタイルを学習しました。次回からこの方向性で生成します！');
  } catch (err) {
    console.error('[Feedback] 👍 処理エラー:', err.message);
    await replyText(replyToken, `エラーが発生しました: ${err.message}`);
  }
}

// ==================== 👎 イマイチ評価のハンドラー ====================

async function handleNegativeFeedback(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const { data: latestPost } = await supabase
      .from('post_history')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestPost) {
      return await replyText(replyToken, 'まだ投稿がありません。');
    }

    // パーソナライゼーションエンジンに学習させる（逆方向）
    const { applyFeedbackToProfile } = await import('../services/personalizationEngine.js');
    await applyFeedbackToProfile(store.id, '👎 イマイチな投稿として学習', latestPost.content);

    console.log(`[Feedback] 👎 イマイチ評価: store=${store.name}`);
    await replyText(replyToken, '👎 フィードバックありがとうございます。\n\n「直し: 〜」で具体的に修正指示を送っていただけると、より精度が上がります！');
  } catch (err) {
    console.error('[Feedback] 👎 処理エラー:', err.message);
    await replyText(replyToken, `エラーが発生しました: ${err.message}`);
  }
}

// ==================== リマインダー停止 ====================

async function handleDisableReminder(user, replyToken) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ reminder_enabled: false })
      .eq('id', user.id);

    if (error) throw error;

    console.log(`[Reminder] リマインダー停止: user=${user.line_user_id}`);
    await replyText(replyToken, '✅ デイリーリマインダーを停止しました。\n\n再開したい場合は「リマインダー再開」と送信してください。');
  } catch (err) {
    console.error('[Reminder] 停止エラー:', err.message);
    await replyText(replyToken, `エラーが発生しました: ${err.message}`);
  }
}

// ==================== リマインダー再開 ====================

async function handleEnableReminder(user, replyToken) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ reminder_enabled: true })
      .eq('id', user.id);

    if (error) throw error;

    console.log(`[Reminder] リマインダー再開: user=${user.line_user_id}`);
    await replyText(replyToken, '✅ デイリーリマインダーを再開しました。\n\n毎朝10時に報告のリマインドをお送りします！');
  } catch (err) {
    console.error('[Reminder] 再開エラー:', err.message);
    await replyText(replyToken, `エラーが発生しました: ${err.message}`);
  }
}
