# サブスクリプション課金 — 有効化手順

> 準備完了済み。以下の手順を順番に実行するだけで課金が始まります。

---

## 現在の状態

| ファイル | 状態 |
|---|---|
| `src/config/planConfig.js` | ✅ 作成済み（プラン定義） |
| `database/migration_subscriptions.sql` | ✅ 作成済み（未実行） |
| `src/services/subscriptionService.js` | ✅ 作成済み（未組み込み） |
| `src/handlers/subscriptionHandler.js` | ✅ 作成済み（未組み込み） |
| `src/handlers/stripeWebhookHandler.js` | ✅ 作成済み（未組み込み） |

---

## STEP 1: Stripe アカウント設定

1. [Stripe ダッシュボード](https://dashboard.stripe.com) にログイン
2. **商品・価格** を作成
   - スタンダードプラン: ¥2,980/月（繰り返し請求）
   - プレミアムプラン: ¥5,980/月（繰り返し請求）
3. 各価格の **Price ID** (`price_xxxx`) をメモ
4. **Payment Link** を各プランで作成（設定: 数量 = 1 固定）
5. **Webhook** エンドポイントを登録
   - URL: `https://あなたのドメイン/stripe/webhook`
   - 購読するイベント:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
6. Webhook の **署名シークレット** (`whsec_xxxx`) をメモ

---

## STEP 2: 環境変数を追加

`.env` に以下を追加:

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
STRIPE_STANDARD_PRICE_ID=price_xxxx
STRIPE_PREMIUM_PRICE_ID=price_xxxx

# Stripe Payment Links（ユーザーが課金するページ）
STRIPE_PAYMENT_LINK_STANDARD=https://buy.stripe.com/xxxx
STRIPE_PAYMENT_LINK_PREMIUM=https://buy.stripe.com/xxxx
```

Railway の場合: ダッシュボード → Variables に追加

---

## STEP 3: Supabase マイグレーション実行

Supabase の **SQL Editor** で以下を実行:

```
database/migration_subscriptions.sql
```

確認: `subscriptions` テーブルに既存ユーザーが全員 `free` プランで登録されていること

---

## STEP 4: Stripe SDK をインストール

```bash
npm install stripe
```

---

## STEP 5: server.js に Webhook ルートを追加

`server.js` の **LINE Webhook より前**（app.use(express.json()) の前）に追加:

```javascript
import { handleStripeWebhook } from './src/handlers/stripeWebhookHandler.js';

// Stripe Webhook（raw body が必要なので JSON パース前に追加）
app.post('/stripe/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);
```

---

## STEP 6: textHandler.js にコマンドを追加

`src/handlers/textHandler.js` の振り分け処理（早い段階）に追加:

```javascript
import {
  handlePlanStatus,
  handleUpgradePrompt,
} from './subscriptionHandler.js';

// 既存の振り分けの前の方に追加:
if (trimmed === 'プラン' || trimmed === '/plan') {
  return await handlePlanStatus(user, replyToken);
}
if (trimmed === 'アップグレード' || trimmed === '/upgrade') {
  return await handleUpgradePrompt(user, replyToken);
}
```

---

## STEP 7: 生成ハンドラーに上限チェックを追加（任意）

フリープランの生成回数を制限する場合、以下を各ハンドラーに追加:

### `src/handlers/imageHandler.js`

```javascript
import { replyIfLimitReached } from './subscriptionHandler.js';

// handleImageMessage の冒頭（store 取得の直後）に追加:
if (await replyIfLimitReached(user, replyToken)) return;
```

### `src/handlers/textHandler.js`

```javascript
import { replyIfLimitReached } from './subscriptionHandler.js';

// テキスト投稿生成の直前に追加:
if (await replyIfLimitReached(user, replyToken)) return;
```

---

## STEP 8: 機能制限を追加（任意）

フリープランで集合知・季節記憶を無効化する場合:

### `src/handlers/imageHandler.js` / `textHandler.js`

```javascript
import { isFeatureEnabled } from '../services/subscriptionService.js';

// getBlendedInsights 呼び出しの前:
const ciEnabled = await isFeatureEnabled(user.id, 'collectiveIntelligence');
let blendedInsights = null;
if (store.category && ciEnabled) {
  blendedInsights = await getBlendedInsights(store.id, store.category);
}

// getSeasonalMemoryPromptAddition 呼び出しの前:
const smEnabled = await isFeatureEnabled(user.id, 'seasonalMemory');
const seasonalMemory = smEnabled ? await getSeasonalMemoryPromptAddition(store.id) : '';
```

---

## プラン設定の変更

`src/config/planConfig.js` で以下を自由に変更できます:

- `monthlyGenerations` — 月間上限回数
- `maxStores` — 登録可能店舗数
- `features.*` — 機能の有効/無効
- `price` — 表示価格（実際の請求は Stripe で管理）

---

## テスト手順（本番前に必ずやること）

### フェーズ 1: 管理者コマンドで単体確認（Stripe 不要）

STEP 3（SQLマイグレーション）完了後、LINE で以下を送信：

```
# 自分のプラン確認（フリーになっているはず）
/admin sub status

# スタンダードプランに手動昇格
/admin sub set standard

# 昇格確認（機能制限が解除されるか確認）
/admin sub status

# フリーに戻す
/admin sub set free
```

これで「プラン取得 → 機能チェック → DB 更新」の一連の流れが動作確認できます。

---

### フェーズ 2: Stripe テストモードで E2E 確認

> 本番キーの前にテストキーで動作を確認する（費用は一切発生しない）

**事前準備**

1. Stripe ダッシュボード → **「テストモード」を ON** にする
2. テスト用の商品・価格・Payment Link を作成（STEP 1 と同じ手順）
3. `.env` のキーをテストキー（`sk_test_xxxx`, `price_test_xxxx` 等）に設定

**Stripe CLI のインストール**（ローカル開発環境用）

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows（管理者 PowerShell）
scoop install stripe

# インストール確認
stripe version
```

**ローカル Webhook フォワーディング**

```bash
# ターミナル 1: Stripe Webhook → localhost に転送
stripe listen --forward-to localhost:3000/stripe/webhook

# 表示された Webhook シークレット (whsec_xxxx) を .env の STRIPE_WEBHOOK_SECRET に設定
```

**テストイベントの送信**

```bash
# ターミナル 2: テストイベント送信
# （checkout.session.completed はPayment Link 経由の初回購読に相当）
stripe trigger checkout.session.completed

# 解約テスト
stripe trigger customer.subscription.deleted

# 支払い失敗テスト
stripe trigger invoice.payment_failed
```

**確認すること**

| チェック項目 | 確認方法 |
|---|---|
| Webhook 署名検証が通るか | ターミナル 1 にエラーが出ないこと |
| DB が更新されるか | `/admin sub status` で plan が変わること |
| LINE 通知が届くか | 実際に LINE Bot に通知が来ること |

---

### フェーズ 3: Railway 本番環境での Webhook 確認

1. Railway Variables にテストキーを設定（`sk_test_xxxx`）
2. Stripe ダッシュボード → Webhook エンドポイントに `https://本番ドメイン/stripe/webhook` を登録
3. テスト Payment Link から実際に「テスト購入」（カード番号: `4242 4242 4242 4242`）
4. LINE 通知が届き、`/admin sub status` でプランが変わることを確認
5. 問題なければ `.env` / Railway Variables を本番キー（`sk_live_xxxx`）に切り替え

---

### テスト時のトラブルシューティング

**Webhook が届かない（ローカル）**
- Stripe CLI が起動しているか確認: `stripe listen --forward-to localhost:3000/stripe/webhook`
- `STRIPE_WEBHOOK_SECRET` が CLI 表示の `whsec_xxxx` と一致しているか確認

**「STRIPE_SECRET_KEY が設定されていません」エラー**
- `.env` に `STRIPE_SECRET_KEY=sk_test_xxxx` を追加してサーバーを再起動

**LINE 通知が届かない**
- サーバーログで `[StripeWebhook]` の行を確認
- `checkout.session.completed` の `client_reference_id` に正しい `user.id` が入っているか確認

**`/admin sub status` でユーザーが見つからない**
- STEP 3 の SQL マイグレーションが未実行 → Supabase SQL Editor で実行

---

## テスト方法（Stripe CLI 簡易版）

```bash
# Stripe CLI インストール後
stripe listen --forward-to localhost:3000/stripe/webhook

# 別ターミナルでテストイベントを送信
stripe trigger checkout.session.completed
stripe trigger customer.subscription.deleted
```

---

## よくある質問

**Q: 既存ユーザーへの影響は？**
A: STEP 3 の SQL が全ユーザーを free プランで登録します。課金チェック（STEP 7/8）を追加するまでは何も変わりません。

**Q: 無料トライアルは設定できる？**
A: Stripe の Price に trial_period_days を設定するだけです（コード変更不要）。

**Q: 解約後のデータは？**
A: subscriptions レコードが `canceled` になるだけで、投稿履歴・学習データはそのまま保持されます。

**Q: Price ID を変えたい（値上げ等）？**
A: `.env` の `STRIPE_*_PRICE_ID` を新しい Price ID に変更するだけです。

---

*作成日: 2026-02-23*
