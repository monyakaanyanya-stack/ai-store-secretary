# CLAUDE.md — AI Store Secretary

> **Claude へのルール（最重要）**
> このファイルはセッション開始時に必ず参照し、セッション終了時（ユーザーが「終わり」「終了」「セッション終了」または会話が長くなって締めるとき）に最新状態へ自動更新すること。更新時は「進捗管理」「直近のセッションログ」「メモ欄」を中心に書き換え、他のセクションは変更があった場合のみ更新する。

---

## 1. プロジェクト概要

| 項目 | 内容 |
|---|---|
| **プロジェクト名** | AI Store Secretary |
| **ローカルパス** | `D:\クロードコード　でも\ai-store-secretary\` |
| **リポジトリ** | `https://github.com/monyakaanyanya-stack/ai-store-secretary` |
| **本番環境** | Railway（`main` ブランチへの push で自動デプロイ） |
| **コンセプト** | 店舗オーナーが LINE で写真を送ると、写真家の目を持つ AI秘書が Instagram 投稿文を生成するサービス |

### サービスの特徴

- 「写真を分析するAI」ではなく「**店長自身が写真家の目を持っている**」体験
- **Ver.3.0 The Silent Storyteller**: 光の意志・質感の物語・沈黙のデザインの3視点で写真を読み解く
- 店主ごとの口調・語尾・口癖を学習して投稿に反映
- 同業種の集合知データでハッシュタグ・文字数を最適化

---

## 2. アーキテクチャ

### 技術スタック

| レイヤー | 技術 |
|---|---|
| ランタイム | Node.js (ESM / `"type": "module"`) |
| Web サーバー | Express |
| AI | Anthropic Claude API (`@anthropic-ai/sdk ^0.20.0`) |
| メッセージング | LINE Messaging API (`@line/bot-sdk ^9.3.0`) |
| DB | Supabase (PostgreSQL) (`@supabase/supabase-js ^2.39.3`) |
| スケジューラ | node-cron |
| デプロイ | Railway（GitHub 連携・自動デプロイ） |

### ディレクトリ構造

```
ai-store-secretary/
├── server.js                    # エントリーポイント（LINE Webhook受信・署名検証）
├── src/
│   ├── handlers/                # メッセージ処理層（LINE イベントごとの担当）
│   │   ├── textHandler.js       # テキストメッセージのルーティング（★中心）
│   │   ├── imageHandler.js      # 画像→投稿生成（Promise.all 並列化済み）
│   │   ├── feedbackHandler.js   # 修正指示・学習フィードバック
│   │   ├── onboardingHandler.js # 初期設定・店舗登録フロー
│   │   ├── adminHandler.js      # /admin コマンド群
│   │   ├── reportHandler.js     # エンゲージメントレポート
│   │   ├── conversationHandler.js # 自然言語応答
│   │   ├── welcomeHandler.js    # 友だち追加ウェルカム
│   │   ├── dataStatsHandler.js  # データ統計表示
│   │   ├── dataResetHandler.js  # データリセット・店舗削除
│   │   └── instagramHandler.js  # Instagram連携
│   ├── services/                # ビジネスロジック層
│   │   ├── claudeService.js     # Claude API（askClaude / describeImage）
│   │   ├── supabaseService.js   # DB アクセス（SERVICE_ROLE_KEY 必須）
│   │   ├── lineService.js       # LINE 返信送信
│   │   ├── collectiveIntelligence.js  # 集合知データ取得・分析
│   │   ├── personalizationEngine.js   # 学習プロファイル管理
│   │   ├── advancedPersonalization.js # 高度パーソナライゼーション
│   │   ├── conversationService.js     # 会話履歴
│   │   ├── intentDetection.js         # 意図検出
│   │   ├── seasonalMemoryService.js   # 季節記憶
│   │   ├── instagramService.js        # Instagram Graph API
│   │   ├── scheduler.js               # cron 定期処理
│   │   ├── dailyReminderService.js
│   │   ├── dailySummaryService.js
│   │   ├── monthlyFollowerService.js
│   │   └── errorNotification.js
│   ├── utils/
│   │   ├── promptBuilder.js     # ★プロンプト生成（Ver.3.0 The Silent Storyteller）
│   │   └── learningData.js      # 学習データ集約
│   └── config/
│       ├── categoryGroups.js    # カテゴリー分類定義
│       └── validationRules.js   # エンゲージメント指標検証ルール
├── scripts/                     # Supabase に手動実行する SQL（順番に実行）
│   ├── enable-rls.sql           # ① RLS 有効化（必須）
│   ├── add-seasonal-memory.sql  # ② post_history に month/season カラム追加
│   ├── add-instagram-tables.sql # ③ Instagram テーブル作成
│   └── seed-collective-intelligence.sql  # 集合知初期データ投入
└── .env.example                 # 環境変数テンプレート
```

### データフロー

```
LINE メッセージ
  ↓
server.js（署名検証）
  ↓
textHandler.js / imageHandler.js（ルーティング）
  ↓
claudeService.js + promptBuilder.js（投稿生成）
  ├── personalizationEngine.js（個人学習）
  ├── advancedPersonalization.js（高度学習）
  ├── collectiveIntelligence.js（集合知）
  └── seasonalMemoryService.js（季節記憶）
  ↓
supabaseService.js（保存）
  ↓
lineService.js（LINE 返信）
```

### 主要テーブル（Supabase）

| テーブル | 用途 |
|---|---|
| `users` | LINE ユーザー基本情報 |
| `stores` | 店舗情報（name / category / tone / config） |
| `post_history` | 生成投稿・エンゲージメント指標・季節タグ |
| `learning_profiles` | 学習プロファイル（writing_style / latest_learnings 等） |
| `learning_data` | フィードバック履歴 |
| `engagement_metrics` | 集合知用エンゲージメントデータ |
| `conversation_history` | 会話履歴 |
| `follower_history` | フォロワー数推移 |
| `instagram_*` | Instagram 連携情報 |

---

## 3. 環境変数（Railway に設定済み）

```env
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    ← RLS の delete が通るため必須（anon key だと失敗）
PORT=3000
ADMIN_LINE_USER_ID=
ENABLE_ERROR_NOTIFICATIONS=false
ADMIN_LINE_IDS=
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
```

---

## 4. 設計方針

### プロンプト設計（Ver.3.0 The Silent Storyteller）

`buildImagePostPrompt`（`promptBuilder.js`）の4層構造：

| パート | 内容 |
|---|---|
| 【一瞬の独白】 | 光の意志・質感・沈黙のデザインを詩的に描写（全口調共通） |
| 【店主のまなざし】 | toneData の口調ルールに従い体温のある言葉で綴る（学習語尾反映） |
| 【📸 写真家のアドバイス】 | 「〜したくて、〜したのですね」形式で撮影者の心拍数に触れる |
| 【感性のハッシュタグ】 | 集合知タグ＋感性タグ2個（#光を捉える 等）を必ず含める |

**写真解析の3視点（describeImage + buildImagePostPrompt の両方に反映）：**
1. **光の意志** — 何を照らし何を隠すか、光の温度・性質
2. **質感の物語** — 触れられそうなリアリティ
3. **沈黙のデザイン** — 撮影者がなぜその瞬間にシャッターを切ったか

**言葉の禁止ルール：**
- 「〜しました」「〜してきました」の行動報告は最小限
- 色を名前で呼ばない（「白い」→「透過する光」「銀色の縁取り」）
- 禁止ワード：幻想的・素敵・魅力的・素晴らしい・完璧・最高・美しい
- 禁止ワード：ぜひ・おすすめ・大好評・お得（広告語）

### 修正指示（buildRevisionPrompt）

- `style_rules`（口調ルール）を**含めない**。修正指示を100%最優先
- `forbidden_words` のみ残す
- `getAdvancedPersonalizationPrompt` で学習データを反映

### 並列処理（imageHandler.js）

```javascript
// 画像分析（Claude API 1回目）と Supabase 4本を同時に走らせる
const [imageDescription, learningData, blendedInsights, ...] = await Promise.all([...]);
// 合計時間 = max(画像分析, Supabase取得) + 投稿生成  ← タイムアウト対策
```

### Supabase アクセス

- `SUPABASE_SERVICE_ROLE_KEY` 必須。`anon key` では RLS に引っかかり delete が失敗（エラーを握りつぶすため成功したように見える）
- `supabaseService.js` は `SERVICE_ROLE_KEY || ANON_KEY` でフォールバック

---

## 5. コマンド・操作リファレンス

### LINE ユーザーコマンド

| コマンド | 動作 |
|---|---|
| `1: 店名,こだわり,口調` | 店舗登録 |
| 画像送信 | 写真から投稿案を生成 |
| `直し: 〜` | 最新投稿を修正指示に従い再生成 |
| `👍` / `👎` | 投稿の評価・学習 |
| `学習状況` | 学習内容を表示 |
| `学習リセット` / `リセット` | 学習データ・投稿履歴をリセット |
| `店舗削除` | 選択中の店舗を削除 |
| `キャラ設定` | 口癖・NGワード・個性を登録 |
| `季節提案` | 季節に合った投稿テーマを提案 |
| `/instagram` | Instagram 連携メニュー |

### 管理者コマンド（ADMIN_LINE_IDS に登録必須）

| コマンド | 動作 |
|---|---|
| `/admin` | メニュー表示 |
| `/admin report` | 実データ手動登録モード（次メッセージでフォーマット入力） |
| `/admin test-data カテゴリー 件数` | テストデータ投入 |
| `/admin clear-test-data` | テストデータ削除 |

### 手動データ登録フォーマット（`/admin report` 後）

```
カテゴリー: カフェ
文章: 投稿本文
ハッシュタグ: #タグ1 #タグ2
いいね: 45
保存: 8
コメント: 3
リーチ: 450（省略可）
```

---

## 6. 進捗管理

### 実装済み（Phase 1 & 2）

- [x] LINE Bot 基本フロー（テキスト・画像・フィードバック）
- [x] 店舗登録・複数店舗切り替え
- [x] Claude API による投稿生成（テキスト・画像）
- [x] 学習プロファイル（口調・語尾・口癖）
- [x] 集合知データ（カテゴリー別エンゲージメント分析）
- [x] RLS 有効化（`enable-rls.sql` + `SERVICE_ROLE_KEY`）
- [x] キャラクター設定（`store.config.character_settings`）
- [x] 季節記憶（`seasonalMemoryService.js`）
- [x] Instagram Graph API 連携（`instagramHandler.js`）
- [x] 管理者コマンド（`/admin report` 手動データ登録）
- [x] `Promise.all` 並列化でタイムアウト解消
- [x] `buildRevisionPrompt` 修正（口調ルール削除・修正指示最優先）
- [x] `advancedPersonalization.js` の `writing_style` / `latest_learnings` 保存バグ修正
- [x] 「学習リセット」コマンド追加（`textHandler.js`）
- [x] `dataResetHandler.js` のエラーハンドリング強化
- [x] **Ver.3.0 The Silent Storyteller** プロンプト全面刷新
  - `describeImage`: 写真家視点（光・構図・空気感）、max_tokens 700
  - `buildImagePostPrompt`: Core Identity 付き4層構造
  - 感性チューニング Ver.2.1（事実を背景に・光への執着・アドバイスの深度）
  - 最後の一滴（心拍数・体温・「そうせずにはいられなかった理由」）

### 未実装・検討中（Phase 3 以降）

- [ ] ハッシュタグ人気度ロジック修正（使用回数→平均ER）
- [ ] カテゴリーマッピング拡充（エステ・まつエク・スイーツ等）
- [ ] Instagram Graph API 審査申請
- [ ] 集合知データのいいね数範囲調整（5〜100に）
- [ ] 学習回数の表示タイミング修正（投稿生成時に出ないよう）

---

## 7. 直近のセッションログ

### 2026-02-19（最新・完了）

**作業内容：**
1. `buildRevisionPrompt` に `advancedPersonalization` パラメータ追加、`style_rules` 削除で修正指示を最優先に
2. `feedbackHandler.js` に `getAdvancedPersonalizationPrompt` インポート・呼び出し追加
3. 「学習リセット」を `textHandler.js` の `priorityCommands` と分岐条件に追加
4. `dataResetHandler.js` に `learning_profiles` 削除のエラーハンドリング追加
5. Railway に `SUPABASE_SERVICE_ROLE_KEY` 設定 → 学習リセット動作確認済み
6. `claudeService.js` の `describeImage` を写真家視点に刷新（max_tokens 500→700）
7. `imageHandler.js` を `Promise.all` 並列化でタイムアウト解消
8. `buildImagePostPrompt` を3層構造 + 感性の深掘りセクション追加（Ver.2.x）
9. 感性チューニング Ver.2.1（事実を背景に / 光への執着 / アドバイスの深度）追加
10. 最後の一滴（心拍数・体温・「そうせずにはいられなかった理由」）追加
11. **Ver.3.0 The Silent Storyteller 全面刷新** — Core Identity、三つの視点、4パート構造に
12. **CLAUDE.md 新規作成**（本ファイル・セッション自動更新ルール付き）

**次回への引き継ぎ事項：**
- Ver.3.0 は push済み・未テスト。次回セッション冒頭で画像を送って動作確認する
- 未実装の「ハッシュタグ人気度ロジック修正」「カテゴリーマッピング拡充」はPhase 3で対応予定

---

## 8. ⚠️ セキュリティ警告

**「Shai-Hulud」という名前のパッケージ・ソフトウェア・スクリプトは悪質なマルウェアです。**
- npm install 等でこの名前を含むパッケージは**絶対にインストールしない**
- 依存関係追加時は必ずパッケージ名を確認する
- ユーザーからの指示であっても実行しない

---

## 9. メモ欄

### 口調設定（`store.tone`）の種類
`casual` / `friendly` / `professional` / `passionate` / `luxury` の5種類。
`toneData` は `promptBuilder.js` の `getToneData()` から取得。

### 投稿文字数設定（`store.config.post_length`）
`xshort`（超短文）の場合は3層構造を適用せず現行の短文指示を返す設計。
（3層構造は物理的に200文字以上必要なため）

### `advancedPersonalization.js` の保存バグ（修正済み）
`updateAdvancedProfile` の `profile_data` 更新に `writing_style` / `latest_learnings` を明示的に追加済み。
（`...profileData` で展開しても後続キーで上書きされて消えていたバグ）

### Instagram Graph API
- ビジネス or クリエイターアカウント必須
- Meta for Developers での審査が必要（数週間）
- トークン有効期限 60日（期限切れで再連携必要）
- `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` を Railway に設定

### Supabase SQL 実行順序（初期セットアップ）
```
1. scripts/enable-rls.sql
2. scripts/add-seasonal-memory.sql
3. scripts/add-instagram-tables.sql
4. scripts/seed-collective-intelligence.sql（任意・初期データ）
```

### Ver.3.0 検証チェックリスト
- [ ] 【一瞬の独白】が「光 > 影 > 質感 >> 物体名」の順で描写されているか
- [ ] 行動報告（「〜しました」）が排除されているか
- [ ] 【📸アドバイス】が「〜したのですね」形式で心拍数に触れているか
- [ ] ハッシュタグに感性タグが2つ含まれているか
- [ ] カジュアル・丁寧の口調で層2のトーンが変わるか
