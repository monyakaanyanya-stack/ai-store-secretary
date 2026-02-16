import { replyText } from '../services/lineService.js';
import { supabase, createStore } from '../services/supabaseService.js';
import {
  getCategoryGroupByNumber,
  getCategoryByNumber,
  generateGroupSelectionMessage,
  generateDetailCategoryMessage
} from '../config/categoryGroups.js';

/**
 * オンボーディングステップの管理
 */

/**
 * 「登録」コマンドのハンドラー - 2段階選択開始
 */
export async function handleOnboardingStart(user, replyToken) {
  // オンボーディング状態を初期化
  await supabase
    .from('onboarding_state')
    .upsert({
      user_id: user.id,
      step: 'category_group',
      selected_group: null,
      selected_category: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  // 大カテゴリー選択メニューを表示
  const message = `✨ AI店舗秘書へようこそ！

まず、あなたのお店を登録しましょう。

${generateGroupSelectionMessage()}`;

  await replyText(replyToken, message);
}

/**
 * オンボーディング中のユーザー入力を処理
 */
export async function handleOnboardingResponse(user, message, replyToken) {
  console.log(`[Onboarding] handleOnboardingResponse called: user=${user.id}, message="${message}"`);

  // オンボーディング状態を取得
  const { data: state } = await supabase
    .from('onboarding_state')
    .select('*')
    .eq('user_id', user.id)
    .single();

  console.log(`[Onboarding] state:`, state);

  if (!state) {
    console.log(`[Onboarding] No state found, returning null`);
    return null; // オンボーディング中でない
  }

  console.log(`[Onboarding] State exists, step=${state.step}`);

  const trimmed = message.trim();

  // キャンセル処理
  if (trimmed === 'キャンセル' || trimmed === 'cancel') {
    await supabase
      .from('onboarding_state')
      .delete()
      .eq('user_id', user.id);

    return await replyText(replyToken, '登録をキャンセルしました。\n\n「登録」でいつでも再開できます。');
  }

  // ステップごとの処理
  if (state.step === 'category_group') {
    return await handleCategoryGroupSelection(user, trimmed, replyToken);
  }

  if (state.step === 'category_detail') {
    return await handleCategoryDetailSelection(user, state, trimmed, replyToken);
  }

  if (state.step === 'store_info') {
    return await handleStoreInfoInput(user, state, trimmed, replyToken);
  }

  return null;
}

/**
 * 大カテゴリー選択処理
 */
async function handleCategoryGroupSelection(user, input, replyToken) {
  const groupNumber = parseInt(input, 10);

  if (isNaN(groupNumber) || groupNumber < 1 || groupNumber > 6) {
    return await replyText(replyToken, '番号が正しくありません。\n\n1〜6の番号を送ってください。\n\nキャンセルする場合は「キャンセル」と送信してください。');
  }

  const selectedGroup = getCategoryGroupByNumber(groupNumber);

  // 状態を更新
  await supabase
    .from('onboarding_state')
    .update({
      step: 'category_detail',
      selected_group: selectedGroup,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id);

  // 詳細カテゴリー選択メニューを表示
  const message = generateDetailCategoryMessage(selectedGroup);
  await replyText(replyToken, message);

  return true;
}

/**
 * 詳細カテゴリー選択処理
 */
async function handleCategoryDetailSelection(user, state, input, replyToken) {
  const categoryNumber = parseInt(input, 10);
  const selectedCategory = getCategoryByNumber(state.selected_group, categoryNumber);

  if (!selectedCategory) {
    // 範囲外の番号
    const message = generateDetailCategoryMessage(state.selected_group);
    return await replyText(replyToken, `番号が範囲外です。\n\n${message}`);
  }

  // 状態を更新
  await supabase
    .from('onboarding_state')
    .update({
      step: 'store_info',
      selected_category: selectedCategory,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id);

  // 店舗情報入力案内を表示
  const message = `業種: ${selectedCategory} ✅

次に、以下の情報を入力してください：

━━━━━━━━━━━━━━━
店名,こだわり,口調
━━━━━━━━━━━━━━━

【例】
幸福堂,天然酵母の手作りパン,フレンドリー

【こだわりの例】
・シンプルで美味しいパン
・国産小麦100%使用
・毎朝焼きたて提供

【口調の例】
・フレンドリー（明るい・親しみやすい）
・カジュアル（タメ口・親しみやすい）
・丁寧（ビジネス的・プロフェッショナル）
・元気（ハイテンション）
・落ち着いた（穏やか）

カンマ区切りで入力してください。`;

  await replyText(replyToken, message);

  return true;
}

/**
 * 店舗情報入力処理
 */
async function handleStoreInfoInput(user, state, input, replyToken) {
  const parts = input.split(',').map(s => s.trim());

  if (parts.length !== 3) {
    return await replyText(replyToken, '入力形式が正しくありません。\n\n「店名,こだわり,口調」の形式で入力してください。\n\n例: 幸福堂,天然酵母の手作りパン,フレンドリー');
  }

  const [storeName, strength, tone] = parts;

  if (!storeName || !strength || !tone) {
    return await replyText(replyToken, 'すべての項目を入力してください。\n\n「店名,こだわり,口調」の形式で入力してください。');
  }

  try {
    // 店舗を作成
    const store = await createStore(user.id, {
      name: storeName,
      category: state.selected_category,
      strength: strength,
      tone: tone
    });

    // ユーザーの current_store_id を更新
    await supabase
      .from('users')
      .update({
        current_store_id: store.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // オンボーディング状態を削除
    await supabase
      .from('onboarding_state')
      .delete()
      .eq('user_id', user.id);

    const successMessage = `✅ 店舗「${storeName}」を登録しました！

【登録内容】
業種: ${state.selected_category}
店名: ${storeName}
こだわり: ${strength}
口調: ${tone}

さっそく投稿を生成してみましょう！

📸 画像を送信
または
✏️ テキストで内容を送信

例: 新作のパンができました`;

    await replyText(replyToken, successMessage);

    console.log(`[Onboarding] 店舗登録完了: user=${user.line_user_id}, store=${storeName}, category=${state.selected_category}`);

    return true;
  } catch (error) {
    console.error('[Onboarding] 店舗登録エラー:', error);
    await replyText(replyToken, `エラーが発生しました: ${error.message}\n\n「登録」でもう一度やり直してください。`);
    return true;
  }
}

/**
 * 階層型ヘルプ - トップレベル
 */
export async function handleHelpMenu(user, replyToken) {
  const message = `📖 ヘルプメニュー

以下のカテゴリーから選んでください：

1️⃣ 【店舗登録】
　　店舗の登録・編集・切替方法

2️⃣ 【投稿】
　　投稿の生成・修正方法

3️⃣ 【報告】
　　エンゲージメント報告の仕方

4️⃣ 【設定】
　　文章量・テンプレート・リマインダー

5️⃣ 【学習】
　　AI学習・フィードバック機能

番号またはカテゴリー名を送信してください。
例: 「1」または「店舗登録」`;

  await replyText(replyToken, message);
}

/**
 * 店舗登録ヘルプ（詳細）
 */
export async function handleHelpStoreRegistration(user, replyToken) {
  const message = `🏪 店舗登録ヘルプ

【新規登録】
1: 業種,店名,こだわり,口調

例: 1: カフェ,花,自家焙煎コーヒー,フレンドリー

【店舗切替】
切替: 店舗名

例: 切替: カフェ花

【店舗一覧】
店舗一覧

【店舗情報の変更】
店舗更新

その他のヘルプは「ヘルプ」と送信してください。`;

  await replyText(replyToken, message);
}

/**
 * 投稿ヘルプ（詳細）
 */
export async function handleHelpPost(user, replyToken) {
  const message = `✏️ 投稿生成ヘルプ

【画像から投稿生成】
画像を送信するだけでOK！

【テキストから投稿生成】
好きな内容を送信してください。

例: 新メニューのケーキ

【文章量を指定】
超短文で: 〇〇
短文で: 〇〇
長文で: 〇〇

【投稿を修正】
直し: もっとカジュアルに

【評価】
👍 良い
👎 イマイチ

その他のヘルプは「ヘルプ」と送信してください。`;

  await replyText(replyToken, message);
}

/**
 * 報告ヘルプ（詳細）
 */
export async function handleHelpReport(user, replyToken) {
  const message = `📊 報告機能ヘルプ

【エンゲージメント報告】
報告: いいね120, 保存15, コメント5

↓
投稿一覧が表示されます
↓
番号を選択（例: 1）

【報告のメリット】
・集合知データベースに蓄積
・同業種のベストプラクティスを学習
・今月の報告回数を確認

【デイリーリマインダー】
毎朝10時に報告を促すメッセージを送信

・停止: リマインダー停止
・再開: リマインダー再開

その他のヘルプは「ヘルプ」と送信してください。`;

  await replyText(replyToken, message);
}

/**
 * 設定ヘルプ（詳細）
 */
export async function handleHelpSettings(user, replyToken) {
  const message = `⚙️ 設定ヘルプ

【文章量の設定】
長さ: short（短文）
長さ: medium（中文）
長さ: long（長文）

【テンプレート登録】
テンプレート: address:渋谷区〇〇

【テンプレート確認】
設定確認

【テンプレート削除】
テンプレート削除

【リマインダー設定】
リマインダー停止
リマインダー再開

【データリセット】
データリセット
→ 投稿履歴・報告データ・学習データをすべて削除
→ テスト終了後、本番運用に切り替える際に使用

その他のヘルプは「ヘルプ」と送信してください。`;

  await replyText(replyToken, message);
}

/**
 * 学習ヘルプ（詳細）
 */
export async function handleHelpLearning(user, replyToken) {
  const message = `🧠 学習機能ヘルプ

【学習状況の確認】
学習状況

または

学習

【フィードバック方法】
1. 👍 良い評価
2. 👎 イマイチ評価
3. 直し: 具体的な修正指示

【学習の仕組み】
・フィードバックを送るほど精度向上
・店舗ごとにパーソナライズ
・好みの口調・文章長を自動学習

その他のヘルプは「ヘルプ」と送信してください。`;

  await replyText(replyToken, message);
}

/**
 * ヘルプカテゴリーのルーティング
 */
export async function handleHelpCategory(user, category, replyToken) {
  const normalizedCategory = category.trim();

  // 数字でのカテゴリー選択
  const categoryMap = {
    '1': 'store',
    '2': 'post',
    '3': 'report',
    '4': 'settings',
    '5': 'learning',
    '店舗登録': 'store',
    '投稿': 'post',
    '報告': 'report',
    '設定': 'settings',
    '学習': 'learning'
  };

  const selectedCategory = categoryMap[normalizedCategory];

  switch (selectedCategory) {
    case 'store':
      return await handleHelpStoreRegistration(user, replyToken);
    case 'post':
      return await handleHelpPost(user, replyToken);
    case 'report':
      return await handleHelpReport(user, replyToken);
    case 'settings':
      return await handleHelpSettings(user, replyToken);
    case 'learning':
      return await handleHelpLearning(user, replyToken);
    default:
      return null; // カテゴリーが見つからない場合
  }
}
