import { replyText } from '../services/lineService.js';
import { supabase, createStore, updateCurrentStore } from '../services/supabaseService.js';
import { getStore } from '../services/supabaseService.js';
import { saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { normalizeInput, safeParseInt } from '../utils/inputNormalizer.js';
import { maskUserId } from '../utils/security.js';

/** 開発者テスト店舗のカテゴリー名（集合知除外・写真から自動検出） */
export const DEV_TEST_CATEGORY = '開発者テスト';

/** 店舗が開発者テスト店舗かどうか判定 */
export function isDevTestStore(store) {
  return store?.category === DEV_TEST_CATEGORY;
}

// S18修正: 管理者の破壊的操作を監査ログに記録
function auditLog(adminUserId, action, details = '') {
  const timestamp = new Date().toISOString();
  console.log(`[AUDIT] ${timestamp} admin=${maskUserId(adminUserId)} action=${action} ${details}`);
}

/**
 * 管理者かどうかをチェック
 */
function isAdmin(lineUserId) {
  const ADMIN_LINE_IDS = (process.env.ADMIN_LINE_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
  return ADMIN_LINE_IDS.includes(lineUserId);
}

/**
 * 管理者用: テストデータ投入
 * コマンド: /admin test-data カフェ 5
 */
export async function handleAdminTestData(user, args, replyToken) {
  if (!isAdmin(user.line_user_id)) {
    // 管理者以外には何も表示しない（コマンドを隠す）
    return false;
  }

  try {
    const [category, countStr] = args.trim().split(/\s+/);
    const count = parseInt(countStr, 10) || 5;

    if (!category) {
      await replyText(replyToken, '⚙️ 使い方: /admin test-data カフェ 5');
      return true;
    }

    // テストデータを生成
    const testPosts = generateTestData(category, count);

    let inserted = 0;
    let failed = 0;
    for (const post of testPosts) {
      const postData = {
        content: post.content,
      };

      const metricsData = {
        likes_count: post.likes,
        saves_count: post.saves,
        comments_count: post.comments,
        reach: 0, // 推定値は使わない（実リーチのみ）
        engagement_rate: post.engagementRate,
        save_intensity: post.likes > 0 ? post.saves / post.likes : 0,
      };

      const result = await saveEngagementMetrics(null, category, postData, metricsData);
      if (result.success) {
        inserted++;
      } else {
        failed++;
        console.warn('[Admin] テストデータ保存失敗:', result.message);
      }
    }

    await replyText(replyToken, `✅ テストデータ投入完了\n\n業種: ${category}\n件数: ${inserted}件`);
    return true;
  } catch (err) {
    console.error('[Admin] テストデータ投入エラー:', err);
    await replyText(replyToken, '❌ テストデータ投入中にエラーが発生しました。ログを確認してください。');
    return true;
  }
}

/**
 * 管理者用: データベースクリア（全データ）
 * コマンド: /admin clear-data
 */
export async function handleAdminClearData(user, replyToken) {
  if (!isAdmin(user.line_user_id)) {
    return false;
  }

  try {
    auditLog(user.line_user_id, 'CLEAR_ALL_DATA', 'engagement_metrics全削除');

    const { error, count } = await supabase
      .from('engagement_metrics')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 全削除

    if (error) throw error;

    auditLog(user.line_user_id, 'CLEAR_ALL_DATA_DONE', `削除件数=${count || 0}`);
    await replyText(replyToken, `✅ データベースクリア完了\n\n削除件数: ${count || 0}件`);
    return true;
  } catch (err) {
    console.error('[Admin] データクリアエラー:', err);
    await replyText(replyToken, '❌ データクリア中にエラーが発生しました。ログを確認してください。');
    return true;
  }
}

/**
 * 管理者用: テストデータのみクリア
 * コマンド: /admin clear-test-data
 */
export async function handleAdminClearTestData(user, replyToken) {
  if (!isAdmin(user.line_user_id)) {
    return false;
  }

  try {
    auditLog(user.line_user_id, 'CLEAR_TEST_DATA', 'store_id=nullのテストデータ削除');

    const { error, count } = await supabase
      .from('engagement_metrics')
      .delete()
      .is('store_id', null); // store_id が null のデータ（テストデータ）のみ削除

    if (error) throw error;

    auditLog(user.line_user_id, 'CLEAR_TEST_DATA_DONE', `削除件数=${count || 0}`);
    await replyText(replyToken, `✅ テストデータクリア完了\n\n削除件数: ${count || 0}件`);
    return true;
  } catch (err) {
    console.error('[Admin] テストデータクリアエラー:', err);
    await replyText(replyToken, '❌ テストデータクリア中にエラーが発生しました。ログを確認してください。');
    return true;
  }
}

/**
 * 管理者用: 実投稿データを手動登録
 * コマンド: /admin report
 * 次のメッセージ形式で送信:
 *   カテゴリー: カフェ
 *   文章: 新作パフェが登場しました🍓
 *   ハッシュタグ: #カフェ巡り #スイーツ
 *   いいね: 45
 *   保存: 8
 *   コメント: 3
 *   リーチ: 450（省略可）
 */
export async function handleAdminReportMode(user, replyToken) {
  if (!isAdmin(user.line_user_id)) {
    return false;
  }

  const message = `⚙️ 実データ手動登録モード

以下の形式で送信してください:

カテゴリー: カフェ
文章: 投稿本文をここに入力
ハッシュタグ: #タグ1 #タグ2 #タグ3
いいね: 45
保存: 8
コメント: 3
リーチ: 450（省略可）

送信すると集合知データに登録されます。
リーチを省略した場合は0で保存されます（推定値は使いません）。`;

  await replyText(replyToken, message);
  return true;
}

/**
 * 管理者用: 実投稿データを解析して保存
 */
export async function handleAdminReportSave(user, text, replyToken) {
  if (!isAdmin(user.line_user_id)) {
    return false;
  }

  try {
    // 全角コロン・全角数字を正規化してからパース
    const normalized = normalizeInput(text);
    const lines = normalized.split('\n').map(l => l.trim()).filter(l => l);
    const parsed = {};

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      parsed[key] = value;
    }

    // 必須フィールドのチェック
    const category = parsed['カテゴリー'] || parsed['カテゴリ'];
    const content = parsed['文章'] || parsed['テキスト'] || parsed['投稿'];
    const likesStr = parsed['いいね'];

    if (!category || !content || !likesStr) {
      await replyText(replyToken, `❌ 必須項目が不足しています\n\n必須: カテゴリー、文章、いいね\n\n入力内容:\n${text}`);
      return true;
    }

    const likes = safeParseInt(likesStr, -1);
    const saves = safeParseInt(parsed['保存'], 0);
    const comments = safeParseInt(parsed['コメント'], 0);

    // NaN / 不正値チェック
    if (likes < 0) {
      await replyText(replyToken, `❌ いいね数が不正です: "${likesStr}"\n\n数値で入力してください（例: いいね: 45）`);
      return true;
    }

    // リーチは入力があれば使用、なければ null（推定値は使わない）
    const reachStr = parsed['リーチ'];
    const reach = reachStr ? safeParseInt(reachStr, 0) : 0;
    const engagementRate = reach > 0 ? ((likes + saves + comments) / reach * 100) : 0;

    // ハッシュタグをパース
    const hashtagStr = parsed['ハッシュタグ'] || '';
    const hashtags = hashtagStr.match(/#[^\s#]+/g) || [];

    // content にハッシュタグを含める（saveEngagementMetrics が抽出する）
    const fullContent = hashtags.length > 0
      ? `${content}\n\n${hashtags.join(' ')}`
      : content;

    const postData = { content: fullContent };
    const metricsData = {
      likes_count: likes,
      saves_count: saves,
      comments_count: comments,
      reach,
      engagement_rate: parseFloat(engagementRate.toFixed(2)),
    };

    const result = await saveEngagementMetrics(null, category, postData, metricsData);

    if (result.success) {
      await replyText(replyToken, `✅ 実データ登録完了！

カテゴリー: ${category}
いいね: ${likes} / 保存: ${saves} / コメント: ${comments}
リーチ: ${reach} / ER: ${engagementRate.toFixed(2)}%
ハッシュタグ: ${hashtags.join(', ') || 'なし'}

集合知データに反映されました。`);
    } else {
      await replyText(replyToken, `❌ 登録失敗\n\nエラー: ${result.message}\n詳細: ${result.validation?.errors?.join(', ')}`);
    }
    return true;
  } catch (err) {
    console.error('[Admin] 実データ登録エラー:', err);
    await replyText(replyToken, '❌ 実データ登録中にエラーが発生しました。ログを確認してください。');
    return true;
  }
}

/**
 * 管理者用: カテゴリーリクエスト一覧を確認
 * コマンド: /admin category-requests
 */
export async function handleAdminCategoryRequests(user, replyToken) {
  if (!isAdmin(user.line_user_id)) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('category_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!data || data.length === 0) {
      await replyText(replyToken, '⚙️ カテゴリーリクエスト\n\n新しいリクエストはありません。');
      return true;
    }

    const list = data.map((r, i) =>
      `${i + 1}. ${r.category_name}（${r.parent_group}）`
    ).join('\n');

    await replyText(replyToken, `⚙️ カテゴリーリクエスト（未対応: ${data.length}件）\n\n${list}\n\ncategoryGroups.js に追加後、/admin category-approve で処理済みにできます。`);
    return true;
  } catch (err) {
    console.error('[Admin] カテゴリーリクエスト取得エラー:', err);
    await replyText(replyToken, '❌ カテゴリーリクエスト取得中にエラーが発生しました。ログを確認してください。');
    return true;
  }
}

/**
 * 管理者用: サブスクリプション確認・手動設定（テスト用）
 * コマンド:
 *   /admin sub                           → 使い方表示
 *   /admin sub status                    → 自分のプランを確認
 *   /admin sub status [LINE_USER_ID]     → 指定ユーザーのプランを確認
 *   /admin sub set free                  → 自分を free プランに設定
 *   /admin sub set standard              → 自分を standard プランに設定（テスト用）
 *   /admin sub set premium               → 自分を premium プランに設定（テスト用）
 *   /admin sub set [plan] [LINE_USER_ID] → 指定ユーザーのプランを設定
 */
export async function handleAdminSub(user, args, replyToken) {
  if (!isAdmin(user.line_user_id)) {
    return false;
  }

  const parts = args.trim().split(/\s+/).filter(Boolean);
  const subCmd = parts[0] || '';

  try {
    // /admin sub status [LINE_USER_ID]
    if (subCmd === 'status' || subCmd === '') {
      const targetId = parts[1] || user.line_user_id;
      return await _adminSubStatus(user, targetId, replyToken);
    }

    // /admin sub set [plan] [LINE_USER_ID]
    if (subCmd === 'set') {
      const plan = parts[1] || '';
      const targetId = parts[2] || user.line_user_id;
      return await _adminSubSet(user, targetId, plan, replyToken);
    }

    // 使い方
    await replyText(replyToken, `⚙️ サブスクリプション管理コマンド

【プラン確認】
/admin sub status
→ 自分のプラン状況を確認

/admin sub status [LINE_USER_ID]
→ 指定ユーザーのプランを確認

【プラン手動変更（テスト用）】
/admin sub set free
/admin sub set standard
/admin sub set premium
→ 自分のプランをテスト変更

/admin sub set [plan] [LINE_USER_ID]
→ 指定ユーザーのプランを変更

⚠️ 変更は DB を直接更新します（Stripe 連携なし）。
テスト・サポート目的でのみ使用してください。`);
    return true;
  } catch (err) {
    console.error('[Admin] sub コマンドエラー:', err);
    await replyText(replyToken, '❌ サブスクリプション操作中にエラーが発生しました。ログを確認してください。');
    return true;
  }
}

/** プラン状況を確認 */
async function _adminSubStatus(admin, targetLineUserId, replyToken) {
  const { data: targetUser } = await supabase
    .from('users')
    .select('id, line_user_id')
    .eq('line_user_id', targetLineUserId)
    .single();

  if (!targetUser) {
    await replyText(replyToken, `❌ ユーザーが見つかりません\nID: ${maskUserId(targetLineUserId)}`);
    return true;
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', targetUser.id)
    .single();

  if (!sub) {
    await replyText(replyToken, `⚙️ サブスクリプション確認\n\nユーザー: ${maskUserId(targetLineUserId)}\nレコードなし（free として扱われます）\n\n「/admin sub set free [ID]」でレコードを作成できます。`);
    return true;
  }

  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('ja-JP')
    : 'なし';

  await replyText(replyToken, `⚙️ サブスクリプション確認

ユーザー: ${maskUserId(targetLineUserId)}
プラン: ${sub.plan}
ステータス: ${sub.status}
更新日: ${periodEnd}
解約予定: ${sub.cancel_at_period_end ? 'あり' : 'なし'}
Stripe Customer: ${sub.stripe_customer_id ? maskUserId(sub.stripe_customer_id) : 'なし'}
Stripe Sub ID: ${sub.stripe_subscription_id ? maskUserId(sub.stripe_subscription_id) : 'なし'}`);
  return true;
}

/** プランを手動変更（テスト用） */
async function _adminSubSet(admin, targetLineUserId, plan, replyToken) {
  const VALID_PLANS = ['free', 'standard', 'premium'];
  if (!VALID_PLANS.includes(plan)) {
    await replyText(replyToken, `❌ 無効なプランです: "${plan}"\n\n有効: free / standard / premium`);
    return true;
  }

  const { data: targetUser } = await supabase
    .from('users')
    .select('id, line_user_id')
    .eq('line_user_id', targetLineUserId)
    .single();

  if (!targetUser) {
    await replyText(replyToken, `❌ ユーザーが見つかりません\nID: ${maskUserId(targetLineUserId)}`);
    return true;
  }

  auditLog(admin.line_user_id, 'SUB_SET', `target=${maskUserId(targetLineUserId)} plan=${plan}`);

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: targetUser.id,
      plan,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('[Admin] プラン変更失敗:', error.message);
    await replyText(replyToken, '❌ プラン変更に失敗しました。');
    return true;
  }

  await replyText(replyToken, `✅ プラン変更完了

ユーザー: ${maskUserId(targetLineUserId)}
新プラン: ${plan}

⚠️ テスト用設定です（Stripe には反映されません）。
実際の課金開始後は Stripe Webhook で自動上書きされます。`);
  return true;
}

/**
 * 管理者用メニュー
 */
export async function handleAdminMenu(user, replyToken) {
  if (!isAdmin(user.line_user_id)) {
    return false;
  }

  const message = `⚙️ 管理者メニュー

【実データ手動登録】
/admin report
→ 実際の投稿データを手動で登録（次のメッセージで入力）

【テストデータ投入】
/admin test-data カフェ 5
→ カフェのテストデータを5件投入

【テストデータのみ削除】
/admin clear-test-data
→ 管理者が投入したテストデータのみ削除

【全データ削除】
/admin clear-data
→ 全データを削除（ユーザーデータも含む）

【カテゴリーリクエスト確認】
/admin category-requests
→ ユーザーが自由入力した業種一覧を確認

【サブスクリプション管理】
/admin sub
→ プラン確認・手動変更（テスト用）

【開発者テスト店舗作成】
/admin dev-store
→ 写真から業種を自動判定するテスト用店舗を作成（集合知に影響しない）

【データ確認】
データ確認
→ 通常コマンドで確認`;

  await replyText(replyToken, message);
  return true;
}

/**
 * 管理者用: 開発者テスト店舗作成
 * コマンド: /admin dev-store
 * - カテゴリー「開発者テスト」で店舗を即作成
 * - 写真送信時は被写体から自動でカテゴリーを検出して使用
 * - 集合知には保存しない
 */
export async function handleAdminDevStore(user, replyToken) {
  if (!isAdmin(user.line_user_id)) {
    return false;
  }

  try {
    const store = await createStore(user.id, {
      name: '開発テスト',
      category: DEV_TEST_CATEGORY,
      tone: 'casual',
      strength: '全業種テスト用',
    });

    await updateCurrentStore(user.id, store.id);

    auditLog(user.line_user_id, 'dev-store-create', `storeId=${store.id}`);

    await replyText(replyToken, `🔧 開発者テスト店舗を作成しました

店舗名: 開発テスト
カテゴリー: ${DEV_TEST_CATEGORY}

📸 写真を送ると業種を自動判定して投稿を生成します
📊 集合知データには保存されません
🔄 通常店舗に戻すには「店舗切り替え」`);

    return true;
  } catch (err) {
    console.error('[Admin] dev-store作成エラー:', err);
    await replyText(replyToken, '⚠️ 開発者テスト店舗の作成に失敗しました');
    return true;
  }
}

/**
 * テストデータ生成
 */
function generateTestData(category, count) {
  const templates = {
    'カフェ': {
      contents: [
        '本日のおすすめブレンド☕',
        '新作ケーキが登場しました🍰',
        'ランチタイム限定セット開始',
        '自家焙煎コーヒー豆入荷',
        '季節のフルーツパフェ好評販売中',
      ],
      hashtags: [
        ['#カフェ', '#コーヒー', '#カフェ巡り'],
        ['#スイーツ', '#ケーキ', '#カフェスタグラム'],
        ['#ランチ', '#カフェランチ', '#おしゃれカフェ'],
        ['#コーヒー好き', '#珈琲', '#自家焙煎'],
        ['#パフェ', '#フルーツパフェ', '#カフェ好き'],
      ],
    },
    'ネイルサロン': {
      contents: [
        '春の新作デザイン💅',
        'シンプルワンカラーネイル',
        'ラメグラデーション人気です✨',
        '持ち込みデザインOK',
        '定額コース6000円から',
      ],
      hashtags: [
        ['#ネイル', '#ネイルデザイン', '#春ネイル'],
        ['#ワンカラーネイル', '#シンプルネイル', '#ジェルネイル'],
        ['#ラメネイル', '#グラデーションネイル', '#ネイルアート'],
        ['#ネイルサロン', '#持ち込みデザイン', '#ネイル好き'],
        ['#定額ネイル', '#お得ネイル', '#ネイルサロン'],
      ],
    },
    'ベーカリー': {
      contents: [
        '焼きたてクロワッサン🥐',
        '天然酵母の食パン販売中',
        '季節限定いちごデニッシュ',
        'ランチにサンドイッチはいかが',
        '明日の予約受付中です',
      ],
      hashtags: [
        ['#パン', '#ベーカリー', '#クロワッサン'],
        ['#食パン', '#天然酵母', '#パン屋'],
        ['#デニッシュ', '#いちご', '#パン好き'],
        ['#サンドイッチ', '#ランチ', '#パン屋さん'],
        ['#予約', '#焼きたてパン', '#ベーカリー'],
      ],
    },
  };

  const template = templates[category] || templates['カフェ'];
  const results = [];

  for (let i = 0; i < count; i++) {
    const idx = i % template.contents.length;
    const likes = Math.floor(Math.random() * 200) + 50;
    const saves = Math.floor(Math.random() * 30) + 5;
    const comments = Math.floor(Math.random() * 10) + 1;
    const reach = 0; // 推定値は使わない（実リーチのみ）
    const engagement = 0; // リーチ不明時はER算出しない

    results.push({
      content: template.contents[idx],
      hashtags: template.hashtags[idx],
      likes,
      saves,
      comments,
      engagementRate: parseFloat(engagement),
      postTime: `${10 + Math.floor(Math.random() * 8)}:00`,
      dayOfWeek: Math.floor(Math.random() * 7),
    });
  }

  return results;
}
