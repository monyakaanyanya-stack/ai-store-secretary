import { replyText } from '../services/lineService.js';
import { supabase } from '../services/supabaseService.js';

/**
 * オンボーディングステップの管理
 */

/**
 * 「登録」コマンドのハンドラー - ステップバイステップガイド開始
 */
export async function handleOnboardingStart(user, replyToken) {
  const message = `✨ AI店舗秘書へようこそ！

まず、あなたのお店を登録しましょう。
以下の形式で送信してください：

━━━━━━━━━━━━━━━
1: 店名,こだわり,口調
━━━━━━━━━━━━━━━

【例】
1: ベーカリー幸福堂,天然酵母の手作りパン,friendly

【口調の選択肢】
・casual（タメ口・親しみやすい）
・friendly（フレンドリー・明るい）
・professional（丁寧・ビジネス的）

この3つの情報を入力するだけで、すぐに投稿生成が始められます！`;

  await replyText(replyToken, message);
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
1: 店名,こだわり,口調

例: 1: カフェ花,自家焙煎コーヒー,friendly

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
