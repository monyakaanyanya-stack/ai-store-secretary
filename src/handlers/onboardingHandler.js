import { replyText, replyWithQuickReply } from '../services/lineService.js';
import { supabase, createStore } from '../services/supabaseService.js';
import {
  getCategoryGroupByNumber,
  getCategoryGroupNames,
  getCategoriesByGroup,
  getCategoryByNumber,
} from '../config/categoryGroups.js';
import { getUserSubscription } from '../services/subscriptionService.js';
import { getPlanConfig } from '../config/planConfig.js';

/** グループ選択用 Quick Reply アイテムを生成 */
function buildGroupQuickReply() {
  return getCategoryGroupNames().map(name => ({
    type: 'action',
    action: { type: 'message', label: name, text: name },
  }));
}

/** 詳細カテゴリー選択用 Quick Reply アイテムを生成 */
function buildDetailQuickReply(groupLabel) {
  const cats = getCategoriesByGroup(groupLabel);
  return [
    ...cats.map(cat => ({
      type: 'action',
      action: { type: 'message', label: cat, text: cat },
    })),
    { type: 'action', action: { type: 'message', label: 'その他', text: 'その他' } },
    { type: 'action', action: { type: 'message', label: '🔙 戻る', text: '戻る' } },
  ];
}

/** 「🔙 戻る」ボタンだけのQuick Reply */
function buildBackOnlyQuickReply() {
  return [
    { type: 'action', action: { type: 'message', label: '🔙 戻る', text: '戻る' } },
  ];
}

/**
 * 店舗数上限チェック
 * @returns {Promise<{allowed: boolean, current: number, max: number}>}
 */
async function checkStoreLimit(userId) {
  const subscription = await getUserSubscription(userId);
  const planConfig = getPlanConfig(subscription.plan);
  const maxStores = planConfig.maxStores;

  const { count, error } = await supabase
    .from('stores')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const current = error ? 0 : (count || 0);
  return { allowed: current < maxStores, current, max: maxStores, planName: planConfig.name };
}

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

  // 大カテゴリー選択メニューをボタン付きで表示
  const message = `はじめまして！お店の登録をしていきましょう。

まず業種を選んでください👇`;

  await replyWithQuickReply(replyToken, message, buildGroupQuickReply());
}

/**
 * オンボーディング中のユーザー入力を処理
 */
export async function handleOnboardingResponse(user, message, replyToken) {
  console.log(`[Onboarding] handleOnboardingResponse called`);

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

  // C19修正: 1時間以上経過したオンボーディング状態を自動クリーンアップ
  const stateAge = Date.now() - new Date(state.updated_at || state.created_at).getTime();
  const ONE_HOUR = 60 * 60 * 1000;
  if (stateAge > ONE_HOUR) {
    console.log(`[Onboarding] 期限切れの状態を削除: age=${Math.round(stateAge / 60000)}分`);
    await supabase
      .from('onboarding_state')
      .delete()
      .eq('user_id', user.id);
    return null; // 期限切れ → 通常のメッセージ処理に委譲
  }

  console.log(`[Onboarding] State exists, step=${state.step}`);

  const trimmed = message.trim();

  // キャンセル処理
  if (trimmed === 'キャンセル' || trimmed === 'cancel') {
    await supabase
      .from('onboarding_state')
      .delete()
      .eq('user_id', user.id);

    return await replyText(replyToken, 'キャンセルしました！「登録」でいつでも再開できます');
  }

  // 戻る処理（1つ前のステップに戻る）
  if (trimmed === '戻る') {
    if (state.step === 'category_detail') {
      // 詳細カテゴリー → 大カテゴリーに戻る
      await supabase
        .from('onboarding_state')
        .update({ step: 'category_group', selected_group: null, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      return await replyWithQuickReply(replyToken, '業種を選び直してください👇', buildGroupQuickReply());
    }
    if (state.step === 'custom_category') {
      // 自由入力 → 詳細カテゴリーに戻る
      await supabase
        .from('onboarding_state')
        .update({ step: 'category_detail', updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      return await replyWithQuickReply(
        replyToken,
        `【${state.selected_group}】どれが一番近いですか？`,
        buildDetailQuickReply(state.selected_group)
      );
    }
    if (state.step === 'influencer_genre') {
      // インフルエンサージャンル入力 → 詳細カテゴリーに戻る
      await supabase
        .from('onboarding_state')
        .update({ step: 'category_detail', selected_category: null, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      return await replyWithQuickReply(
        replyToken,
        `【${state.selected_group}】どれが一番近いですか？`,
        buildDetailQuickReply(state.selected_group)
      );
    }
    if (state.step === 'store_info') {
      // 店舗情報入力 → 詳細カテゴリーに戻る
      await supabase
        .from('onboarding_state')
        .update({ step: 'category_detail', selected_category: null, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      return await replyWithQuickReply(
        replyToken,
        `【${state.selected_group}】どれが一番近いですか？`,
        buildDetailQuickReply(state.selected_group)
      );
    }
    // category_group（最初のステップ）→ そのまま再表示
    return await replyWithQuickReply(replyToken, '業種を選んでください👇', buildGroupQuickReply());
  }

  // ステップごとの処理
  if (state.step === 'category_group') {
    return await handleCategoryGroupSelection(user, trimmed, replyToken);
  }

  if (state.step === 'category_detail') {
    return await handleCategoryDetailSelection(user, state, trimmed, replyToken);
  }

  if (state.step === 'custom_category') {
    return await handleCustomCategoryInput(user, state, trimmed, replyToken);
  }

  if (state.step === 'store_info') {
    return await handleStoreInfoInput(user, state, trimmed, replyToken);
  }

  if (state.step === 'influencer_genre') {
    return await handleInfluencerGenreInput(user, state, trimmed, replyToken);
  }

  return null;
}

/**
 * 大カテゴリー選択処理
 */
async function handleCategoryGroupSelection(user, input, replyToken) {
  // ボタン（グループ名）または番号の両方を受け付ける
  let selectedGroup = null;
  const groupNumber = parseInt(input, 10);
  if (!isNaN(groupNumber) && groupNumber >= 1 && groupNumber <= 6) {
    selectedGroup = getCategoryGroupByNumber(groupNumber);
  } else if (getCategoryGroupNames().includes(input)) {
    selectedGroup = input;
  }

  if (!selectedGroup) {
    return await replyWithQuickReply(
      replyToken,
      'ボタンか番号（1〜6）で選んでください。\n\n「キャンセル」で中断できます。',
      buildGroupQuickReply()
    );
  }

  // 状態を更新
  await supabase
    .from('onboarding_state')
    .update({
      step: 'category_detail',
      selected_group: selectedGroup,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id);

  // 詳細カテゴリー選択メニューをボタン付きで表示
  await replyWithQuickReply(
    replyToken,
    `【${selectedGroup}】ですね！どれが一番近いですか？`,
    buildDetailQuickReply(selectedGroup)
  );

  return true;
}

/**
 * 自由入力業種の処理
 */
async function handleCustomCategoryInput(user, state, input, replyToken) {
  const customCategory = input.trim();

  if (!customCategory || customCategory.length > 30) {
    return await replyWithQuickReply(
      replyToken,
      '業種名を30文字以内で送ってください！\n\n例: ペットサロン',
      buildBackOnlyQuickReply()
    );
  }

  // category_requests テーブルに記録（管理者が後で確認してリストに追加可能）
  try {
    await supabase
      .from('category_requests')
      .insert({
        user_id: user.id,
        category_name: customCategory,
        parent_group: state.selected_group,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
  } catch (err) {
    // テーブルがなくても登録は続行（ログのみ）
    console.log(`[Onboarding] category_requests 保存スキップ: ${err.message}`);
  }

  // 状態を更新してstore_infoステップへ
  await supabase
    .from('onboarding_state')
    .update({
      step: 'store_info',
      selected_category: customCategory,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id);

  const storeInfoMessage = `${customCategory}ですね！

次は「店名,こだわり,口調」を教えてください

例: 幸福堂,天然酵母の手作りパン,フレンドリー

口調はこんな感じで👇
・フレンドリー（明るい・親しみやすい）
・カジュアル（タメ口・親しみやすい）
・丁寧（ビジネス的・プロフェッショナル）`;

  await replyWithQuickReply(replyToken, storeInfoMessage, buildBackOnlyQuickReply());
  return true;
}

/**
 * 詳細カテゴリー選択処理
 */
async function handleCategoryDetailSelection(user, state, input, replyToken) {
  const cats = getCategoriesByGroup(state.selected_group);

  // 「その他」または「0」= 自由入力
  if (input === 'その他' || input === '0') {
    await supabase
      .from('onboarding_state')
      .update({
        step: 'custom_category',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    await replyWithQuickReply(
      replyToken,
      `業種名をそのまま送ってください！\n\n例: ペットサロン、占い師、整骨院 など`,
      buildBackOnlyQuickReply()
    );
    return true;
  }

  // ボタン（カテゴリー名）または番号の両方を受け付ける
  let selectedCategory = null;
  const categoryNumber = parseInt(input, 10);
  if (!isNaN(categoryNumber) && categoryNumber >= 1) {
    selectedCategory = getCategoryByNumber(state.selected_group, categoryNumber);
  } else if (cats.includes(input)) {
    selectedCategory = input;
  }

  if (!selectedCategory) {
    return await replyWithQuickReply(
      replyToken,
      `ボタンか番号で選んでください。`,
      buildDetailQuickReply(state.selected_group)
    );
  }

  // インフルエンサーの場合は専用フローへ（店名・こだわり・口調は不要）
  if (selectedCategory === 'インフルエンサー') {
    await supabase
      .from('onboarding_state')
      .update({
        step: 'influencer_genre',
        selected_category: selectedCategory,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    await replyWithQuickReply(
      replyToken,
      `何系の発信してますか？\n\n例: ファッション、グルメ、旅行、ライフスタイルなど`,
      buildBackOnlyQuickReply()
    );
    return true;
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
  const message = `${selectedCategory}ですね！

次は「店名,こだわり,口調」を教えてください

例: 幸福堂,天然酵母の手作りパン,フレンドリー

口調はこんな感じで👇
・フレンドリー（明るい・親しみやすい）
・カジュアル（タメ口・親しみやすい）
・丁寧（ビジネス的・プロフェッショナル）
・元気（ハイテンション）
・落ち着いた（穏やか）`;

  await replyWithQuickReply(replyToken, message, buildBackOnlyQuickReply());

  return true;
}

/**
 * 店舗情報入力処理
 */
async function handleStoreInfoInput(user, state, input, replyToken) {
  // 全角コンマ「，」と日本語の読点「、」も区切り文字として許容
  const parts = input.split(/[,，、]/).map(s => s.trim());

  if (parts.length !== 3) {
    return await replyWithQuickReply(
      replyToken,
      '「店名,こだわり,口調」の3つをカンマで区切って送ってください！\n\n例: 幸福堂,天然酵母の手作りパン,フレンドリー',
      buildBackOnlyQuickReply()
    );
  }

  const [storeName, strength, tone] = parts;

  if (!storeName || !strength || !tone) {
    return await replyWithQuickReply(
      replyToken,
      '3つとも必要です！「店名,こだわり,口調」で送ってください',
      buildBackOnlyQuickReply()
    );
  }

  try {
    // 店舗数上限チェック
    const storeLimit = await checkStoreLimit(user.id);
    if (!storeLimit.allowed) {
      await replyText(replyToken, `店舗数の上限（${storeLimit.max}店舗）に達しています。\n\n現在のプラン: ${storeLimit.planName}（${storeLimit.current}/${storeLimit.max}店舗）\n\n「アップグレード」でプラン変更できます。`);
      return true;
    }

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

    const successMessage = `「${storeName}」を登録しました！

業種: ${state.selected_category}
こだわり: ${strength}
口調: ${tone}

さっそく投稿を作ってみましょう！
画像かテキストを送るだけでOKです

住所やハッシュタグを毎回つけたい場合は「テンプレート登録」と送ってください`;

    await replyText(replyToken, successMessage);

    console.log(`[Onboarding] 店舗登録完了: category=${state.selected_category}`);

    return true;
  } catch (error) {
    console.error('[Onboarding] 店舗登録エラー:', error);
    await replyText(replyToken, 'うまくいきませんでした...「登録」でもう一度やり直してみてください');
    return true;
  }
}

/**
 * インフルエンサー専用: 発信ジャンル入力処理
 * 「何系の発信してますか？」の回答をそのまま名前として登録
 */
async function handleInfluencerGenreInput(user, state, input, replyToken) {
  if (!input || input.length > 30) {
    return await replyWithQuickReply(
      replyToken,
      '30文字以内で発信ジャンルを教えてください！\n\n例: ファッション、グルメ、旅行など',
      buildBackOnlyQuickReply()
    );
  }

  try {
    const genre = input.trim();

    // 店舗数上限チェック
    const storeLimit = await checkStoreLimit(user.id);
    if (!storeLimit.allowed) {
      await replyText(replyToken, `登録数の上限（${storeLimit.max}件）に達しています。\n\n現在のプラン: ${storeLimit.planName}（${storeLimit.current}/${storeLimit.max}件）\n\n「アップグレード」でプラン変更できます。`);
      return true;
    }

    const store = await createStore(user.id, {
      name: genre,
      category: 'インフルエンサー',
      strength: genre,
      tone: 'casual'
    });

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

    const successMessage = `「${genre}」で登録しました！

ジャンル: ${genre}

さっそく投稿を作ってみましょう！
画像を送るだけでOKです📸`;

    await replyText(replyToken, successMessage);

    console.log(`[Onboarding] インフルエンサー登録完了: genre=${genre}`);

    return true;
  } catch (error) {
    console.error('[Onboarding] インフルエンサー登録エラー:', error);
    await replyText(replyToken, 'うまくいきませんでした...「登録」でもう一度やり直してみてください');
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

📋 「コマンド一覧」で全コマンドを確認
💬 「問い合わせ」でサポート連絡先を確認`;

  await replyWithQuickReply(replyToken, message, [
    { type: 'action', action: { type: 'message', label: '店舗登録', text: '店舗登録' } },
    { type: 'action', action: { type: 'message', label: '投稿', text: '投稿' } },
    { type: 'action', action: { type: 'message', label: '報告', text: '報告' } },
    { type: 'action', action: { type: 'message', label: '設定', text: '設定' } },
    { type: 'action', action: { type: 'message', label: '学習', text: '学習' } },
    { type: 'action', action: { type: 'message', label: 'コマンド一覧', text: 'コマンド一覧' } },
    { type: 'action', action: { type: 'message', label: '問い合わせ', text: '問い合わせ' } },
  ]);
}

/**
 * コマンド一覧（管理者コマンドを除く全コマンド）
 */
export async function handleCommandList(user, replyToken) {
  const message = `📋 コマンド一覧
━━━━━━━━━━━━━━━

🏪 店舗管理
・登録 → 新しい店舗を登録
・店舗一覧 → 登録店舗の一覧＋切替
・切替:店名 → 店舗を切替
・店舗更新 → 店舗情報を変更
・店舗削除 → 現在の店舗を削除

📝 投稿生成
・画像を送信 → 3案生成
・テキストを送信 → 投稿生成
・A / B / C → 案を選択
・直し:指示 → 選んだ案を修正
・学習:文章 → スタイル学習
・超短文で:内容 → 文字数指定して生成
 （短文で / 中文で / 長文で も可）

📊 報告・データ
・報告:いいね,保存,コメント → 数値報告
・フォロワー:数 → フォロワー数を報告
・データ確認 → データ統計を見る
・学習状況 → AI学習の蓄積状況

⚙️ 設定
・長さ:short → デフォルト文字数設定
 （xshort / short / medium / long）
・テンプレ登録 → テンプレート登録方法
・テンプレ:key:value → テンプレート登録
・設定確認 → 現在のテンプレート表示
・テンプレート削除 → テンプレート削除
・キャラ設定 → 口癖の設定
・リマインダー停止 / リマインダー再開

📱 Instagram
・/instagram connect トークン → 連携
・/instagram post → 直近の投稿を投稿
・/instagram status → 連携状態確認

💎 プラン
・プラン → 現在のプラン確認
・アップグレード → プラン変更案内
・今週の計画 → 週間コンテンツ計画

🔧 その他
・ヘルプ → ヘルプメニュー
・問い合わせ → サポート連絡先
・季節提案 → 季節ごとのヒント
・👍 / 👎 → 投稿を評価
・キャンセル → 操作をキャンセル
・データリセット → 学習データ全削除`;

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
長さ: 超短文（30文字以内）
長さ: 短文（100-150文字）
長さ: 中文（200-300文字）
長さ: 長文（400-500文字）

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

【お問い合わせ】
問い合わせ
→ サポートの連絡先を確認

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
    '学習': 'learning',
    'コマンド一覧': 'commandList',
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
    case 'commandList':
      return await handleCommandList(user, replyToken);
    default:
      return null; // カテゴリーが見つからない場合
  }
}
