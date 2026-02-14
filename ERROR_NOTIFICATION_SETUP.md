# エラー通知システム セットアップガイド

## 概要

LINE Messaging APIを使って、重大エラー発生時にあなたのLINEに自動で通知が届くシステムです。

---

## 📱 セットアップ手順

### 1. あなたのLINE User IDを取得

#### 方法A: Railwayログから取得（推奨）

1. LINE Botに何かメッセージを送信（「ヘルプ」でOK）
2. Railwayダッシュボード → Deployments → 最新デプロイ → Logs
3. ログ内で `[Webhook] userId:` を検索
4. `userId: U1234567890abcdef...` のような文字列を見つける
5. この `U1234567890abcdef...` があなたのUser ID

**ログ例:**
```
[Webhook] イベント受信: message
[Webhook] userId: U1234567890abcdef...
[Webhook] メッセージタイプ: text
```

#### 方法B: 一時的なログ出力を追加

もしログに見つからない場合、以下のコードを一時的に追加：

**src/index.js** の `webhook` ハンドラーに追加：
```javascript
app.post('/webhook', async (req, res) => {
  const events = req.body.events || [];

  for (const event of events) {
    console.log('===== USER ID =====');
    console.log(event.source.userId);  // ← 追加
    console.log('===================');

    // 既存のコード...
  }
});
```

Gitにプッシュ → デプロイ → Botにメッセージ送信 → ログ確認 → User ID取得 → コード削除

---

### 2. Railway環境変数を設定

Railwayダッシュボード → プロジェクト選択 → Variables タブ

**追加する環境変数:**

| 変数名 | 値 | 説明 |
|--------|-----|------|
| `ADMIN_LINE_USER_ID` | `U1234567890abcdef...` | ステップ1で取得したあなたのUser ID |
| `ENABLE_ERROR_NOTIFICATIONS` | `true` | エラー通知を有効化 |

**注意:**
- `LINE_CHANNEL_ACCESS_TOKEN` は既に設定済みなので追加不要
- 環境変数を追加すると自動で再デプロイされます（1-2分）

---

### 3. 動作確認

#### テスト方法1: 正常動作確認

1. LINE Botに画像を送信
2. 投稿が正常に生成されればOK

#### テスト方法2: エラー通知テスト

**重要:** これは実際にエラーを発生させるテストなので、確認後すぐに元に戻してください

1. Railwayダッシュボード → Variables
2. `ANTHROPIC_API_KEY` を一時的に無効な値に変更（例: `invalid_key`）
3. 自動で再デプロイされるのを待つ（1-2分）
4. LINE Botに画像を送信
5. あなたのLINEに以下のような通知が届けばOK:

```
🚨 AI Store Secretary エラー通知

【エラー種別】Claude API エラー
【発生時刻】2026-02-14 15:30:45
【詳細】Invalid API Key

【コンテキスト】
userId: unknown
stack: Error: Invalid API Key
  ...
```

6. **重要:** `ANTHROPIC_API_KEY` を元の正しい値に戻す
7. 再デプロイを待つ
8. 正常に動作することを確認

---

## 📊 通知される内容

### エラー通知の例

```
🚨 AI Store Secretary エラー通知

【エラー種別】Claude API エラー
【発生時刻】2026-02-14 15:30:45
【詳細】Rate limit exceeded

【コンテキスト】
userId: U1234567890abcdef
stack: Error: Rate limit exceeded
  at claudeService.js:15
  at imageHandler.js:46
```

### 通知されるエラー種類

1. **Claude API エラー**
   - API キー無効
   - レート制限超過
   - トークン上限超過

2. **データベースエラー**
   - Supabase接続エラー
   - クエリ実行エラー

3. **LINE Messaging API エラー**
   - 画像取得失敗
   - メッセージ送信失敗

4. **バリデーションエラー（多発時）**
   - 異常データが連続で検出された場合

---

## 🔒 セキュリティとプライバシー

### ✅ 安全な理由

1. **User IDは内部ID**
   - `U1234567890abcdef...` のような文字列
   - 個人情報は含まれない
   - LINE側の内部管理用ID

2. **通知は一方通行**
   - Bot → あなたのLINE
   - ユーザー側には一切見えない
   - ログにも残らない（ユーザー側には）

3. **環境変数で管理**
   - サーバー側のみで使用
   - ユーザーには絶対に見えない
   - GitHubにもコミットされない

### ❌ ユーザーに知られる情報

**何もありません！**

- ユーザーはBotとしか会話していない
- あなたのUser IDはユーザー側からは見えない
- 通知もユーザー側には一切表示されない

---

## ⚙️ 設定の変更

### 通知を一時的に無効化

Railwayダッシュボード → Variables:

```
ENABLE_ERROR_NOTIFICATIONS=false
```

### 通知を再度有効化

```
ENABLE_ERROR_NOTIFICATIONS=true
```

---

## 🐛 トラブルシューティング

### 問題1: 通知が届かない

**確認事項:**
1. `ADMIN_LINE_USER_ID` が正しく設定されているか
2. `ENABLE_ERROR_NOTIFICATIONS=true` になっているか
3. `LINE_CHANNEL_ACCESS_TOKEN` が正しく設定されているか
4. Botとあなたのアカウントが友達になっているか

**デバッグ方法:**
- Railwayログで `[ErrorNotification]` を検索
- `通知送信成功` または `通知送信失敗` のログを確認

### 問題2: User IDが見つからない

**解決策:**
1. LINE Botに何かメッセージを送信（スタンプでもOK）
2. Railwayログをリアルタイムで確認
3. `userId:` で検索

### 問題3: 通知送信失敗のログが出る

**原因:**
- `ADMIN_LINE_USER_ID` が間違っている
- `LINE_CHANNEL_ACCESS_TOKEN` が無効

**解決策:**
1. User IDを再確認
2. LINE Developers Consoleでアクセストークンを再発行

---

## 📝 今後の拡張案

### デイリーサマリー（実装予定）

毎日23:59に自動でレポートを送信：

```
📊 AI Store Secretary デイリーレポート

【投稿生成数】50件
【フィードバック数】12件
【エラー数】0件
【新規店舗】2店舗

ステータス: ✅ 正常
```

### カスタム通知

特定のイベント発生時に通知：
- 新規店舗登録
- 100件目の投稿生成
- 高エンゲージメント投稿検出

---

## まとめ

エラー通知システムにより、問題発生時に即座に対応できるようになりました！

**メリット:**
- 問題を早期発見
- ユーザーへの影響を最小化
- 安心して運用できる

**セットアップは3ステップ:**
1. User IDを取得
2. Railway環境変数を設定
3. 動作確認

何か問題があれば、Railwayのログを確認してください！
