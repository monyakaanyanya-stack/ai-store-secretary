# AI Store Secretary（AI店舗秘書）

店舗経営者向けのAI秘書LINE Bot。画像やテキストを送るだけでInstagram投稿案を自動生成します。

## セットアップ

### 1. 前提条件

- Node.js v18以上
- LINE Developers アカウント
- Supabase アカウント
- Anthropic API キー

### 2. LINE Developers 設定

1. [LINE Developers Console](https://developers.line.biz/) にログイン
2. 新しいチャネル（Messaging API）を作成
3. 「チャネルアクセストークン（長期）」を発行
4. 「チャネルシークレット」を控える
5. Webhook URL は後で設定（デプロイ後に `https://your-domain/webhook` を設定）

### 3. Supabase 設定

1. [Supabase](https://supabase.com/) でプロジェクトを作成
2. SQL Editor で `database/schema.sql` を実行
3. プロジェクトURL と anon key を控える

### 4. インストール

```bash
cd ai-store-secretary
npm install
```

### 5. 環境変数

`.env.example` をコピーして `.env` を作成し、各値を設定してください。

```bash
cp .env.example .env
```

### 6. 起動

```bash
# 本番
npm start

# 開発（ファイル変更で自動再起動）
npm run dev
```

## Railway へのデプロイ

1. [Railway](https://railway.app/) にGitHubリポジトリを接続
2. 環境変数を設定（Settings → Variables）
3. 自動デプロイされる
4. 生成されたURLに `/webhook` を付けて LINE Developers Console の Webhook URL に設定

## 使い方

### 店舗登録
```
1: ベーカリー幸福堂,天然酵母の手作りパン,friendly
```

口調: `friendly` / `professional` / `casual` / `passionate` / `luxury`

### 投稿生成
- **画像送信** → 画像から投稿案を自動生成
- **テキスト送信** → テキスト情報から投稿案を生成

### 投稿修正
```
直し: もっとカジュアルな感じで
```

### 店舗切替
```
切替: 店舗名
```

### その他コマンド
- `店舗一覧` — 登録済み店舗を表示
- `ヘルプ` — 使い方を表示
