import crypto from 'crypto';

// ==================== トークン暗号化 ====================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 暗号化キーを取得（環境変数から、なければ自動生成して警告）
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY が未設定です。.env に 64文字の16進数文字列を設定してください。');
  }
  // S4修正: 鍵長を検証（AES-256-GCM は 32バイト = 64文字の16進数が必須）
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('ENCRYPTION_KEY は64文字の16進数文字列である必要があります（現在: ' + key.length + '文字）');
  }
  return Buffer.from(key, 'hex');
}

/**
 * テキストを暗号化
 * @param {string} plainText - 暗号化するテキスト
 * @returns {string} - 暗号化されたテキスト（IV:AuthTag:暗号文 の形式）
 */
export function encrypt(plainText) {
  if (!plainText) return null;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // IV:AuthTag:暗号文 の形式で返す
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * 暗号化されたテキストを復号
 * @param {string} encryptedText - 暗号化されたテキスト
 * @returns {string} - 復号されたテキスト
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return null;
  // S5修正: 入力型チェック
  if (typeof encryptedText !== 'string') {
    throw new Error('暗号化データは文字列である必要があります');
  }

  const key = getEncryptionKey();
  const parts = encryptedText.split(':');

  if (parts.length !== 3) {
    throw new Error('暗号化データの形式が不正です（IV:AuthTag:暗号文 の3部構成が必要）');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  // S5修正: IV長とAuthTag長を検証
  if (iv.length !== IV_LENGTH) {
    throw new Error(`IVの長さが不正です（期待: ${IV_LENGTH}バイト, 実際: ${iv.length}バイト）`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`AuthTagの長さが不正です（期待: ${AUTH_TAG_LENGTH}バイト, 実際: ${authTag.length}バイト）`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ==================== レート制限 ====================

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分
const MAX_REQUESTS_PER_MINUTE = 15;
const DAILY_API_LIMIT_MAP = new Map();
const DAILY_API_LIMIT = 100; // 1ユーザーあたりの日次Claude API呼び出し上限

/**
 * レート制限チェック（1分あたりのリクエスト数）
 * @param {string} userId - ユーザー識別子
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function checkRateLimit(userId) {
  const now = Date.now();
  const userKey = `rate:${userId}`;

  if (!rateLimitMap.has(userKey)) {
    rateLimitMap.set(userKey, []);
  }

  const timestamps = rateLimitMap.get(userKey);

  // 古いタイムスタンプを除去
  const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  rateLimitMap.set(userKey, validTimestamps);

  if (validTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldestValid = validTimestamps[0];
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldestValid);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  validTimestamps.push(now);
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_MINUTE - validTimestamps.length,
    retryAfterMs: 0,
  };
}

/**
 * 日次API呼び出し制限チェック
 * @param {string} userId - ユーザー識別子
 * @returns {{ allowed: boolean, remaining: number }}
 */
// M2修正: JST日付を使用するヘルパー（サービスは日本向け、UTCだと午前9時リセットになる）
function getJSTDateString() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function checkDailyApiLimit(userId) {
  const today = getJSTDateString(); // M2修正: UTC→JST
  const dailyKey = `daily:${userId}:${today}`;

  const count = DAILY_API_LIMIT_MAP.get(dailyKey) || 0;

  if (count >= DAILY_API_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: DAILY_API_LIMIT - count };
}

/**
 * 日次API呼び出しカウントを増加
 * @param {string} userId - ユーザー識別子
 */
// S15修正: 最後のクリーンアップ日を記録（毎回イテレーションを避ける）
let lastDailyCleanupDate = '';

export function incrementDailyApiCount(userId) {
  const today = getJSTDateString(); // M2修正: UTC→JST
  const dailyKey = `daily:${userId}:${today}`;

  const count = DAILY_API_LIMIT_MAP.get(dailyKey) || 0;
  DAILY_API_LIMIT_MAP.set(dailyKey, count + 1);

  // S15修正: 日付が変わったときだけクリーンアップ（毎回O(n)イテレーション防止）
  if (lastDailyCleanupDate !== today) {
    lastDailyCleanupDate = today;
    for (const key of DAILY_API_LIMIT_MAP.keys()) {
      if (!key.includes(today)) {
        DAILY_API_LIMIT_MAP.delete(key);
      }
    }
  }
}

// 定期的にレート制限マップをクリーンアップ（メモリリーク防止）
// M4修正: .unref()でNode.jsプロセスの正常終了を妨げない
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, valid);
    }
  }
}, 5 * 60 * 1000); // 5分ごと
cleanupInterval.unref();

// ==================== PII マスキング ====================

/**
 * LINE User ID をマスク処理
 * @param {string} lineUserId - LINE User ID
 * @returns {string} - マスクされたID
 */
export function maskUserId(lineUserId) {
  if (!lineUserId || lineUserId.length < 8) return '***';
  return lineUserId.slice(0, 4) + '****' + lineUserId.slice(-4);
}

/**
 * 内部ID（UUID等）をマスク処理（ログ用）
 * @param {string} id - 内部ID
 * @returns {string} - マスクされたID
 */
export function maskId(id) {
  if (!id || typeof id !== 'string') return '***';
  if (id.length <= 8) return id.slice(0, 2) + '***';
  return id.slice(0, 4) + '…' + id.slice(-4);
}

/**
 * 機密情報をマスクしてログ出力する
 * @param {string} tag - ログタグ
 * @param {string} message - ログメッセージ
 * @param {Object} context - コンテキスト（lineUserId等は自動マスク）
 */
export function secureLog(tag, message, context = {}) {
  const masked = { ...context };

  // 機密フィールドを自動マスク
  if (masked.lineUserId) masked.lineUserId = maskUserId(masked.lineUserId);
  if (masked.userId) masked.userId = maskUserId(masked.userId);
  if (masked.line_user_id) masked.line_user_id = maskUserId(masked.line_user_id);
  if (masked.accessToken) masked.accessToken = '***REDACTED***';
  if (masked.token) masked.token = '***REDACTED***';

  const contextStr = Object.keys(masked).length > 0
    ? ` | ${Object.entries(masked).map(([k, v]) => `${k}=${v}`).join(', ')}`
    : '';

  console.log(`[${tag}] ${message}${contextStr}`);
}

/**
 * 安全なエラーメッセージを生成（ユーザー向け）
 * 内部エラーの詳細を隠し、汎用メッセージを返す
 * @param {string} context - エラーの文脈（例: "投稿生成中"）
 * @returns {string} - ユーザー向けエラーメッセージ
 */
export function safeErrorMessage(context = '') {
  const prefix = context ? `${context}に` : '';
  return `${prefix}エラーが発生しました。しばらくしてから再度お試しください。\n\n問題が続く場合は「問い合わせ」と送信してください。`;
}

/**
 * ENCRYPTION_KEY 生成ヘルパー（初回セットアップ時に使用）
 */
export function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}
