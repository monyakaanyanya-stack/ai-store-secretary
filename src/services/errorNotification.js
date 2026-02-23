/**
 * エラー通知サービス（LINE Messaging API）
 */

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const ADMIN_LINE_USER_ID = process.env.ADMIN_LINE_USER_ID || '';
const ENABLE_NOTIFICATIONS = process.env.ENABLE_ERROR_NOTIFICATIONS === 'true';

/**
 * 重大エラーをLINE Messaging APIで管理者に通知
 * @param {string} errorType - エラーの種類
 * @param {string} errorMessage - エラーメッセージ
 * @param {Object} context - コンテキスト情報
 */
export async function notifyCriticalError(errorType, errorMessage, context = {}) {
  if (!ENABLE_NOTIFICATIONS || !ADMIN_LINE_USER_ID || !LINE_CHANNEL_ACCESS_TOKEN) {
    console.log('[ErrorNotification] 通知は無効化されています');
    return;
  }

  try {
    const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const message = `🚨 AI Store Secretary エラー通知

【エラー種別】${errorType}
【発生時刻】${timestamp}
【詳細】${errorMessage}

【コンテキスト】
${contextStr || 'なし'}`;

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: ADMIN_LINE_USER_ID,
        messages: [
          {
            type: 'text',
            text: message,
          },
        ],
      }),
    });

    if (response.ok) {
      console.log(`[ErrorNotification] 通知送信成功: ${errorType}`);
    } else {
      const errorText = await response.text();
      console.error('[ErrorNotification] 通知送信失敗:', errorText);
    }
  } catch (err) {
    console.error('[ErrorNotification] 通知エラー:', err.message);
  }
}

/**
 * Claude API エラーを通知
 * @param {Error} error - エラーオブジェクト
 * @param {string} userId - ユーザーID
 */
export async function notifyClaudeError(error, userId) {
  // M7修正: スタックトレース（ファイルパス等）をLINEメッセージに含めない
  // ファイルパスや関数名は内部実装の情報漏洩になる
  await notifyCriticalError('Claude API エラー', error.message, {
    userId: userId ? (userId.slice(0, 4) + '****') : 'unknown',
    errorType: error.constructor?.name || 'Error',
  });
}


/**
 * デイリーサマリーを送信（今後の実装）
 * @param {Object} summary - サマリーデータ
 */
/**
 * otherグループで人気カテゴリーを検出した場合に管理者に通知
 * @param {Array<{category: string, storeCount: number}>} candidates - 昇格候補
 */
export async function notifyCategoryPromotion(candidates) {
  if (!ENABLE_NOTIFICATIONS || !ADMIN_LINE_USER_ID || !LINE_CHANNEL_ACCESS_TOKEN) {
    return;
  }
  if (!candidates || candidates.length === 0) return;

  const list = candidates
    .map(c => `  - ${c.category}（${c.storeCount}店舗）`)
    .join('\n');

  const message = `📋 カテゴリー昇格候補の検出

以下の業種が「other」グループで一定数を超えました。
辞書（categoryDictionary.js）への追加を検討してください。

${list}

追加すると:
・業種専用ハッシュタグが提供される
・適切なグループ集合知に参加できる
・バリデーションルールが最適化される`;

  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: ADMIN_LINE_USER_ID,
        messages: [{ type: 'text', text: message }],
      }),
    });
    console.log('[ErrorNotification] カテゴリー昇格候補通知送信完了');
  } catch (err) {
    console.error('[ErrorNotification] カテゴリー昇格通知エラー:', err.message);
  }
}

export async function notifyDailySummary(summary) {
  if (!ENABLE_NOTIFICATIONS || !ADMIN_LINE_USER_ID || !LINE_CHANNEL_ACCESS_TOKEN) {
    return;
  }

  const message = `📊 AI Store Secretary デイリーレポート

【投稿生成数】${summary.postsGenerated}件
【フィードバック数】${summary.feedbackCount}件
【エラー数】${summary.errorCount}件
【新規店舗】${summary.newStores}店舗

ステータス: ${summary.errorCount === 0 ? '✅ 正常' : '⚠️ 要確認'}`;

  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: ADMIN_LINE_USER_ID,
        messages: [
          {
            type: 'text',
            text: message,
          },
        ],
      }),
    });

    console.log('[ErrorNotification] デイリーサマリー送信完了');
  } catch (err) {
    console.error('[ErrorNotification] デイリーサマリー送信エラー:', err.message);
  }
}
