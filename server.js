import 'dotenv/config';
import express from 'express';
import { validateSignature } from '@line/bot-sdk';
import { handleTextMessage } from './src/handlers/textHandler.js';
import { handleImageMessage } from './src/handlers/imageHandler.js';
import { getOrCreateUser } from './src/services/supabaseService.js';
import { startScheduler } from './src/services/scheduler.js';
import { sendWelcomeMessage } from './src/handlers/welcomeHandler.js';
import { checkRateLimit, maskUserId } from './src/utils/security.js';
import { replyText } from './src/services/lineService.js';

const app = express();
const PORT = process.env.PORT || 3000;

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// ==================== セキュリティヘッダー ====================
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// LINE Webhook は raw body が必要（署名検証用）
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // メンテナンスモードチェック
  if (process.env.MAINTENANCE_MODE === 'true') {
    console.log('[Webhook] メンテナンスモード中');
    return res.status(503).json({ error: 'Service under maintenance' });
  }

  // 署名検証
  const signature = req.headers['x-line-signature'];
  if (!validateSignature(req.body, lineConfig.channelSecret, signature)) {
    console.error('[Webhook] 署名検証失敗');
    return res.status(403).json({ error: 'Invalid signature' });
  }

  const body = JSON.parse(req.body.toString());
  const events = body.events;

  // LINE の接続確認（イベントなし）に即座に 200 を返す
  if (!events || events.length === 0) {
    return res.status(200).json({ message: 'ok' });
  }

  // 非同期でイベント処理（LINE には即座に 200 を返す）
  res.status(200).json({ message: 'ok' });

  for (const event of events) {
    try {
      await processEvent(event);
    } catch (err) {
      console.error('[Webhook] イベント処理エラー:', err);
    }
  }
});

async function processEvent(event) {
  const lineUserId = event.source.userId;

  // フォローイベント（友だち追加）
  if (event.type === 'follow') {
    console.log(`[Event] follow event: user=${maskUserId(lineUserId)}`);
    await sendWelcomeMessage(lineUserId);
    return;
  }

  if (event.type !== 'message') return;

  const replyToken = event.replyToken;

  // ==================== レート制限チェック ====================
  const rateCheck = checkRateLimit(lineUserId);
  if (!rateCheck.allowed) {
    console.warn(`[RateLimit] ユーザー ${maskUserId(lineUserId)} がレート制限に到達`);
    await replyText(replyToken, 'メッセージの送信が多すぎます。少し待ってから再度お試しください。');
    return;
  }

  // ユーザー取得 or 新規作成
  const user = await getOrCreateUser(lineUserId);
  console.log(`[Event] user=${maskUserId(lineUserId)}, type=${event.message.type}`);

  switch (event.message.type) {
    case 'text':
      await handleTextMessage(user, event.message.text, replyToken);
      break;
    case 'image':
      await handleImageMessage(user, event.message.id, replyToken);
      break;
    default:
      console.log(`[Event] 未対応のメッセージタイプ: ${event.message.type}`);
      break;
  }
}

// ヘルスチェック（サービス名を隠す）
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`[Server] サーバー起動完了 (port: ${PORT})`);

  // スケジューラー起動
  startScheduler();
});
