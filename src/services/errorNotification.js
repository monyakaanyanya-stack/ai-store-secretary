/**
 * エラー通知サービス（LINE Notify）
 */

const LINE_NOTIFY_TOKEN = process.env.LINE_NOTIFY_TOKEN || '';
const ENABLE_NOTIFICATIONS = process.env.ENABLE_ERROR_NOTIFICATIONS === 'true';

/**
 * 重大エラーをLINE Notifyで通知
 * @param {string} errorType - エラーの種類
 * @param {string} errorMessage - エラーメッセージ
 * @param {Object} context - コンテキスト情報
 */
export async function notifyCriticalError(errorType, errorMessage, context = {}) {
  if (!ENABLE_NOTIFICATIONS || !LINE_NOTIFY_TOKEN) {
    console.log('[ErrorNotification] 通知は無効化されています');
    return;
  }

  try {
    const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const message = `
🚨 AI Store Secretary エラー通知

【エラー種別】${errorType}
【発生時刻】${timestamp}
【詳細】${errorMessage}

【コンテキスト】
${contextStr || 'なし'}
`.trim();

    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${LINE_NOTIFY_TOKEN}`,
      },
      body: `message=${encodeURIComponent(message)}`,
    });

    if (response.ok) {
      console.log(`[ErrorNotification] 通知送信成功: ${errorType}`);
    } else {
      console.error('[ErrorNotification] 通知送信失敗:', await response.text());
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
  await notifyCriticalError('Claude API エラー', error.message, {
    userId,
    stack: error.stack?.split('\n').slice(0, 3).join('\n') || 'スタックトレースなし',
  });
}

/**
 * データベースエラーを通知
 * @param {Error} error - エラーオブジェクト
 * @param {string} operation - 実行していた操作
 */
export async function notifyDatabaseError(error, operation) {
  await notifyCriticalError('データベースエラー', error.message, {
    operation,
    code: error.code || 'UNKNOWN',
  });
}

/**
 * LINE Messaging API エラーを通知
 * @param {Error} error - エラーオブジェクト
 * @param {string} userId - ユーザーID
 */
export async function notifyLineError(error, userId) {
  await notifyCriticalError('LINE Messaging API エラー', error.message, {
    userId,
  });
}

/**
 * バリデーションエラーが多発した場合に通知
 * @param {string} category - カテゴリー
 * @param {number} count - エラー件数
 */
export async function notifyValidationFlood(category, count) {
  await notifyCriticalError('異常データ多発', `${category}カテゴリーで異常データが${count}件検出されました`, {
    category,
    count,
    suggestion: 'データソースを確認してください',
  });
}

/**
 * デイリーサマリーを送信（今後の実装）
 * @param {Object} summary - サマリーデータ
 */
export async function notifyDailySummary(summary) {
  if (!ENABLE_NOTIFICATIONS || !LINE_NOTIFY_TOKEN) {
    return;
  }

  const message = `
📊 AI Store Secretary デイリーレポート

【投稿生成数】${summary.postsGenerated}件
【フィードバック数】${summary.feedbackCount}件
【エラー数】${summary.errorCount}件
【新規店舗】${summary.newStores}店舗

ステータス: ${summary.errorCount === 0 ? '✅ 正常' : '⚠️ 要確認'}
`.trim();

  try {
    await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${LINE_NOTIFY_TOKEN}`,
      },
      body: `message=${encodeURIComponent(message)}`,
    });

    console.log('[ErrorNotification] デイリーサマリー送信完了');
  } catch (err) {
    console.error('[ErrorNotification] デイリーサマリー送信エラー:', err.message);
  }
}
