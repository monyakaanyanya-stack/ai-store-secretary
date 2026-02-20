import { replyText } from '../services/lineService.js';
import { supabase } from '../services/supabaseService.js';
import { getStore } from '../services/supabaseService.js';
import { saveEngagementMetrics } from '../services/collectiveIntelligence.js';

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
    for (const post of testPosts) {
      console.log('[Admin] テスト投稿データ:', post);

      const postData = {
        content: post.content,
      };

      const metricsData = {
        likes_count: post.likes,
        saves_count: post.saves,
        comments_count: post.comments,
        reach: post.likes * 10,
        engagement_rate: post.engagementRate,
      };

      console.log('[Admin] postData:', postData);
      console.log('[Admin] metricsData:', metricsData);

      await saveEngagementMetrics(null, category, postData, metricsData);
      inserted++;
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
    const { error, count } = await supabase
      .from('engagement_metrics')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 全削除

    if (error) throw error;

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
    const { error, count } = await supabase
      .from('engagement_metrics')
      .delete()
      .is('store_id', null); // store_id が null のデータ（テストデータ）のみ削除

    if (error) throw error;

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
リーチを省略した場合はいいね×10で自動計算します。`;

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
    // テキストを行で分割してパース
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
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

    const likes = parseInt(likesStr, 10);
    const saves = parseInt(parsed['保存'] || '0', 10);
    const comments = parseInt(parsed['コメント'] || '0', 10);
    const reach = parseInt(parsed['リーチ'] || String(likes * 10), 10);
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

【データ確認】
データ確認
→ 通常コマンドで確認`;

  await replyText(replyToken, message);
  return true;
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
    const reach = likes * 10;
    const engagement = ((likes + saves + comments) / reach * 100).toFixed(2);

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
