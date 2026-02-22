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

// ==================== C8: 起動時の環境変数検証 ====================
const REQUIRED_ENV_VARS = [
  'LINE_CHANNEL_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'ANTHROPIC_API_KEY',
  'SUPABASE_URL',
];

const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`[Server] 必須環境変数が未設定: ${missingVars.join(', ')}`);
  console.error('[Server] .env ファイルを確認してください');
  process.exit(1);
}

// SUPABASE_SERVICE_ROLE_KEY がなければ警告（フォールバックあり）
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Server] SUPABASE_SERVICE_ROLE_KEY が未設定。SUPABASE_ANON_KEY にフォールバックします（RLS制限あり）');
}

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

// C10: LINE Webhook は raw body が必要（署名検証用）+ リクエストサイズ制限
app.post('/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
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

  // C13: JSON.parse の安全化
  let body;
  try {
    body = JSON.parse(req.body.toString());
  } catch (parseErr) {
    console.error('[Webhook] JSONパースエラー:', parseErr.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

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
  // イベントの基本構造チェック
  if (!event?.source?.userId) {
    console.warn('[Event] userId が存在しないイベントをスキップ');
    return;
  }

  const lineUserId = event.source.userId;

  // フォローイベント（友だち追加）
  if (event.type === 'follow') {
    console.log(`[Event] follow event: user=${maskUserId(lineUserId)}`);
    await sendWelcomeMessage(lineUserId);
    return;
  }

  if (event.type !== 'message') return;

  // L8修正: event.messageのnullチェック（malformed webhookペイロード対策）
  if (!event.message) {
    console.warn(`[Event] messageが存在しないメッセージイベントをスキップ: user=${maskUserId(lineUserId)}`);
    return;
  }

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

// M15修正: ヘルスチェック（起動時刻を含む）
const startedAt = new Date().toISOString();
app.get('/', (req, res) => {
  res.json({ status: 'ok', started_at: startedAt });
});

// ==================== C9: Graceful Shutdown ====================
let server;

function gracefulShutdown(signal) {
  console.log(`[Server] ${signal} を受信。グレースフルシャットダウン開始...`);

  // 新しいリクエストの受付を停止
  if (server) {
    server.close(() => {
      console.log('[Server] HTTPサーバーを停止しました');
      process.exit(0);
    });
  }

  // 30秒以内にシャットダウンしなければ強制終了
  setTimeout(() => {
    console.error('[Server] グレースフルシャットダウンがタイムアウト。強制終了します');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ==================== C11: unhandledRejection / uncaughtException ====================
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] unhandledRejection:', reason);
  // プロセスは継続（LINE Botはクラッシュさせない）
});

process.on('uncaughtException', (error) => {
  console.error('[Server] uncaughtException:', error);
  // 致命的なエラーの場合はプロセスを終了（自動再起動に任せる）
  gracefulShutdown('uncaughtException');
});

server = app.listen(PORT, () => {
  console.log(`[Server] サーバー起動完了 (port: ${PORT})`);

  // スケジューラー起動
  startScheduler();
});
