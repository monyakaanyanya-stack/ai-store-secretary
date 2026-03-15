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
| **コンセプト** | LINE に写真を送るだけで、Instagram投稿文を AI が自動生成する「写真観察AI」サービス |
| **テスト** | 352/352 passing |

### サービスの特徴

- **写真観察AI**: 写真を観察し、視点・瞬間・空気感を見つけてSNS投稿のネタに変換
  - 観察（50%）→ ネタ変換（30%）→ 文体（20%）のバランス
  - Detection（写真の隠れた魅力発見）を内部処理として本文1行目に溶かし込む
- 店主ごとの口調・語尾・口癖を学習して投稿に反映（人格AI化）
- 同業種の集合知データでハッシュタグ・文字数を最適化
- Instagram直接投稿対応（Graph API Content Publishing）

### ターゲット

- **店舗オーナー**: 個人経営の店舗（ネイルサロン、カフェ、パン屋、アパレル等）。SNS投稿に時間をかけられない／文章を考えるのが苦手な人。
- **インフルエンサー**: SNSクリエイター。自然なSNS文章を効率的に生成したい人。

---

## 2. アーキテクチャ

### 技術スタック

| レイヤー | 技術 |
|---|---|
| ランタイム | Node.js (ESM / `"type": "module"`) |
| Web サーバー | Express |
| AI | Anthropic Claude API (`@anthropic-ai/sdk ^0.20.0`) |
| メッセージング | LINE Messaging API (`@line/bot-sdk ^9.3.0`) |
| DB・Storage | Supabase (PostgreSQL + Storage) (`@supabase/supabase-js ^2.39.3`) |
| スケジューラ | node-cron |
| デプロイ | Railway（GitHub 連携・自動デプロイ） |

### ディレクトリ構造

```
ai-store-secretary/
├── server.js                    # エントリーポイント（LINE Webhook受信・署名検証）
├── src/
│   ├── handlers/                # メッセージ処理層
│   │   ├── textHandler.js       # テキストメッセージのルーティング（★中心）
│   │   ├── imageHandler.js      # 画像→Storageアップロード→ヒント質問→待機
│   │   ├── pendingImageHandler.js # ヒント受取り→3案生成→返信
│   │   ├── proposalHandler.js   # A/B/C案選択→確定→Instagram投稿ボタン表示
│   │   ├── feedbackHandler.js   # 見本学習（学習:書き直し→diff分析）
│   │   ├── onboardingHandler.js # 初期設定・店舗登録フロー
│   │   ├── adminHandler.js      # /admin コマンド群
│   │   ├── reportHandler.js     # エンゲージメントレポート・分析結果
│   │   ├── instagramHandler.js  # Instagram連携・直接投稿
│   │   ├── conversationHandler.js # 自然言語応答
│   │   ├── welcomeHandler.js    # 友だち追加ウェルカム
│   │   ├── dataStatsHandler.js  # データ統計表示
│   │   ├── dataResetHandler.js  # データリセット・店舗削除
│   │   └── weeklyPlanHandler.js # 週間計画コマンド（今週の計画 / /weekly）
│   ├── services/                # ビジネスロジック層
│   │   ├── claudeService.js     # Claude API（askClaude / describeImage）
│   │   ├── supabaseService.js   # DB・Storageアクセス（SERVICE_ROLE_KEY 必須）
│   │   ├── lineService.js       # LINE 返信送信
│   │   ├── instagramService.js  # Instagram Graph API（連携・同期・投稿）
│   │   ├── subscriptionService.js # サブスク判定（checkGenerationLimit / isFeatureEnabled）
│   │   ├── prescriptionService.js   # 処方箋（因果分析・業界比較・信条ブレンド）
│   │   ├── weeklyPlanService.js     # 週間コンテンツ計画生成（Premium専用）
│   │   ├── collectiveIntelligence.js  # 集合知データ取得・分析
│   │   ├── personalizationEngine.js   # 学習プロファイル管理
│   │   ├── advancedPersonalization.js # 思想ログ学習・人格AI化
│   │   ├── seasonalMemoryService.js   # 季節記憶
│   │   ├── insightsOCRService.js      # インサイトスクショ自動読取
│   │   ├── dailyNudgeService.js       # デイリー撮影ナッジ（17時JST）
│   │   ├── nightlyEngagementService.js # 夜間エンゲージメント自動同期（2時JST）
│   │   └── scheduler.js               # cron 定期処理
│   ├── utils/
│   │   ├── promptBuilder.js     # ★プロンプト生成（写真観察AI・Detection内部化）
│   │   ├── contentCategoryDetector.js # 被写体カテゴリー検出
│   │   └── learningData.js      # 学習データ集約
│   └── config/
│       ├── planConfig.js        # サブスクプラン定義（Free/Light/Standard/Premium）
│       ├── categoryGroups.js    # カテゴリー分類定義
│       ├── nudgeTemplates.js   # 撮影ナッジテンプレート（6グループ×70件）
│       └── validationRules.js   # エンゲージメント指標検証ルール
├── database/                    # マイグレーションSQL
│   ├── migration_save_intensity.sql
│   ├── migration_post_structure.sql
│   ├── migration_status_column.sql
│   ├── migration_pending_image.sql
│   ├── migration_subscriptions.sql
│   ├── migration_instagram_publish.sql  # Instagram投稿用（image_url等）
│   ├── migration_weekly_plans.sql       # 週間コンテンツ計画テーブル
│   └── migration_learning_synced.sql    # 夜間同期用 learning_synced フラグ
├── scripts/                     # 初期セットアップSQL
├── docs/                        # LP・プライバシーポリシー
└── .env.example
```

### データフロー（画像→Instagram投稿）

```
LINE 画像メッセージ
  ↓
imageHandler.js（画像取得・base64変換）
  ├── uploadImageToStorage → Supabase Storage（公開URL取得）
  ├── describeImage（Claude API 画像分析）
  └── savePendingImageContext（待機状態へ）
  ↓
ユーザーが一言ヒントを入力
  ↓
pendingImageHandler.js
  ├── buildImagePostPrompt（プロンプト生成）
  ├── askClaude（3案生成）
  └── savePostHistory（image_url付きで保存）
  ↓
ユーザーが A/B/C 選択
  ↓
proposalHandler.js
  ├── extractSelectedProposal（案抽出）
  ├── updatePostContent（確定テキスト保存）
  └── replyWithQuickReply（📸 Instagram投稿ボタン表示）
  ↓
ユーザーが「📸 Instagram投稿」タップ
  ↓
instagramHandler.js → instagramService.js
  ├── 撮影アドバイス除外（━━━区切り以降をカット）
  ├── createMediaContainer（コンテナ作成）
  ├── waitForContainerReady（ステータスポーリング）
  └── publishMediaContainer（公開）
```

### 主要テーブル（Supabase）

| テーブル | 用途 |
|---|---|
| `users` | LINE ユーザー基本情報 |
| `stores` | 店舗情報（name / category / tone / config） |
| `post_history` | 生成投稿・エンゲージメント指標・image_url |
| `learning_profiles` | 学習プロファイル（profile_data: belief_logs / persona等） |
| `engagement_metrics` | 集合知用エンゲージメントデータ |
| `subscriptions` | サブスクリプション情報 |
| `instagram_accounts` | Instagram連携アカウント |
| `instagram_posts` | Instagram投稿履歴（published_via: sync/app） |

---

## 3. 環境変数（Railway に設定済み）

```env
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    ← RLS の delete が通るため必須
PORT=3000
ADMIN_LINE_USER_ID=
ADMIN_LINE_IDS=               ← 管理者判定用
ENABLE_ERROR_NOTIFICATIONS=false
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
CONTACT_EMAIL=rion.monya0224@gmail.com
SUBSCRIPTION_ENABLED=         ← true で制限ON、未設定で全員premium扱い
# Stripe関連（課金開始時に設定）
# STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
# STRIPE_STANDARD_PRICE_ID / STRIPE_PREMIUM_PRICE_ID
# STRIPE_STANDARD_PAYMENT_LINK / STRIPE_PREMIUM_PAYMENT_LINK
```

---

## 4. 設計方針

### プロンプト設計（写真観察AI）

**Role**: 「写真観察AI」— 写真を観察し、視点・瞬間・空気感を見つけてSNS投稿のネタに変換
**プロンプトバランス**: 観察指示50% / ネタ生成30% / 文体20%

**describeImage（五感ベース5項目分析 + 発見AI）：**
1. 何が写っているか — 被写体を具体的に
2. 視覚的な印象 — 色味・光・質感
3. 五感の推測 — 香り・音・温度・手触り
4. 時間帯・季節感
5. 記憶を呼ぶ要素
6. 写真の観察（Observation → Detection チェーン）— 店主本人も気づいていない「具体的な魅力」を発見
   - ゆるい制約: 物・光・行動・時間・空気感から観察（カテゴリ名は出力しない）
   - 「なぜ投稿ネタになるか」を考えて選ぶ（観察→意味→投稿ネタの思考チェーン）
   - 抽象NG / 撮影テクニックNG / 感想NG
   - Detection は内部処理として本文1行目に自然に溶かし込む（ユーザーにボタン選択させない）

**3案のラベル（店舗用）：**
- 案A: 視覚で伝える（色・形・質感・配置を言葉で描写。見た目の情報で勝負）
- 案B: ストーリーを添える（写真の裏側の時間・選択・気持ちの流れ。店主が勝手に楽しんでる姿を覗き見させる）
- 案C: 店主のひとりごと

**3案のラベル（インフルエンサー用）：**
- 案A: 視点の切り取り
- 案B: 日常の一コマ
- 案C: 本音のひとりごと

**出力構成（店舗 各案2パート）**: 本文 + ハッシュタグ
**出力構成（インフルエンサー 各案2パート）**: 本文 + ハッシュタグ

**Photo Advice（2セクション構成）**:
- 📸 撮影アドバイス: 同じ被写体の別アングル・光・構図の提案（全プラン）
- 🎯 明日撮るべきもの: 今日の写真の延長線上で別の切り口を提案（Premium専用）

**禁止ワード**: 幻想的/素敵/魅力的/素晴らしい/完璧/最高/美しい/ぜひ/おすすめ/大好評/お得
**旧芸術語禁止**: 光の意志/質感の物語/沈黙のデザイン/肖像/独白/心拍数/体温

**「生の言葉」ルール**: 「綺麗すぎ注意ワード」制御 + 「この店・この瞬間でしか成立しない不純物」を必ず入れる

### インフルエンサー専用プロンプト設計

店舗用プロンプト（写真観察AI）とは**完全分離**。`buildInfluencerImagePrompt` / `buildInfluencerTextPrompt` で独立管理。

- **コンセプト**: スマホでその場で書いたような自然なSNS文章
- **文章ルール**: 短文・会話口調・説明しすぎない・少し雑でも自然
- **禁止**: 広告っぽい文章・宣伝語・長い説明・ポエム調
- **オンボーディング**: 「何系の発信してますか？」1問のみ（店名・こだわり・口調は不要）
  - 回答をそのまま store.name / store.strength に使用、tone は 'casual' 固定

### 見本学習フロー（学習:）

```
「学習:書き直した文章」→ ①AI生成版とのdiff分析(analyzeFeedbackWithClaude) → ②指示集更新(updateAdvancedProfile) → ③投稿内容を書き直し版で上書き(updatePostContent)
```

- ユーザーが自分の言葉で書き直した文章とAI生成版を比較して文体・語尾・口癖を学習
- `analyzeFeedbackWithClaude` に `profileContext` を渡し、`persona_definition_next` を同時生成
- 書き直し文章で `updatePostContent` → そのままInstagram投稿可能
- Quick Reply: IG連携済みなら📸投稿ボタン付き
- ※「直し:」機能は削除済み（学習:のみ残存）

### persona自動更新（10投稿ごと）

- `autoRegeneratePersonaIfNeeded(storeId)`: 投稿生成後にfire-and-forgetで呼び出し
- 条件: 前回更新から10投稿以上経過 & persona系belief_logs 3件以上
- `filterPersonaBeliefs`: strategy系belief（投稿時間・数値傾向・曜日等）を除外し、文体・口調・表現に関するbeliefのみでpersona_definitionを再生成
- `_personaRegenerating` Map: 同一店舗の同時実行を防止（in-memory lock）
- エラーは catch してログのみ（投稿フローをブロックしない）

### Instagram投稿時のキャプション処理

- `━━━` 区切り以降（撮影アドバイス）を除外して本文+ハッシュタグのみ投稿
- `latestPost.content.split(/\n━{3,}/)[0].trim()`
- カルーセル投稿: `publishCarouselToInstagram(storeId, imageUrls, caption)` — 子コンテナ→親CAROUSEL→ポーリング→公開

### 撮影アドバイスの被写体バリエーション

- `nudgeTemplates.js` の70件以上のカテゴリ別テンプレートを Photo Advice の🎯セクションに注入
- `buildNextSubjectHints(category)`: 業種別にランダム3候補を季節フィルタ付きで選択
- 🎯 明日撮るべきもの: Premium専用。今日の写真の延長で別の切り口を提案

---

## 5. コマンド・操作リファレンス

### LINE ユーザーコマンド

| コマンド | 動作 |
|---|---|
| `登録` | オンボーディング開始 |
| 画像送信 | ヒント質問→一言入力→3案生成 |
| `A` / `B` / `C` | 案選択→確定（📸ボタン表示） |
| `instagram投稿` | 最新投稿をInstagramに直接投稿 |
| `複数枚投稿` | カルーセル投稿モード開始（2-10枚） |
| `学習: 〜` | 投稿を書き直してdiff学習（見本学習） |
| `報告: 数値` | エンゲージメント報告 |
| `フォロワー: 数` | フォロワー数更新 |
| `店舗一覧` / `店舗切り替え` / `店舗切替` | 店舗リスト+クイックリプライ（切替・削除） |
| `切替:店舗名` | 即切替 |
| `ヘルプ` | 6ボタン付きメニュー |
| `問い合わせ` | CONTACT_EMAIL表示 |
| `学習状況` | 学習内容を表示 |
| `プラン` / `/plan` | 現在プラン・使用状況を表示 |
| `アップグレード` / `/upgrade` | 有料プラン一覧・決済リンク表示 |
| `今週の計画` / `/weekly` | 週間コンテンツ計画を生成（Premium専用） |
| `データリセット` | 学習データ・投稿履歴をリセット |
| `キャンセル` | pending状態をキャンセル |
| `/instagram connect [トークン]` | Instagram連携 |
| `/instagram status` | 連携状態確認 |
| `/instagram sync` | データ同期 |
| `/instagram stats` | 統計表示 |
| `/instagram post` | 最新投稿をInstagramに投稿 |
| `/instagram disconnect` | 連携解除 |

### isSystemCommand（pending状態をバイパスするコマンド）

キャンセル/cancel/リセット/データリセット/店舗一覧/店舗切り替え/店舗切替/店舗削除/ヘルプ/help/学習状況/問い合わせ/登録/プラン/アップグレード/今週の計画/`切替:`始まり/`/`始まり

### 管理者コマンド（ADMIN_LINE_IDS で判定）

| コマンド | 動作 |
|---|---|
| `/admin` | メニュー表示 |
| `/admin report` | 実データ手動登録モード |
| `/admin test-data カテゴリー 件数` | テストデータ投入 |
| `/admin clear-test-data` | テストデータ削除 |
| `/admin category-requests` | カテゴリーリクエスト確認 |
| `/admin sub` | サブスク管理 |
| `/admin dev-store` | 開発者テスト店舗を作成（写真から業種自動検出・集合知隔離） |

---

## 6. ワークフロー原則

### 計画優先
- 3ステップ以上の作業やアーキテクチャ上の決定を伴うタスクでは、必ずプランモードに入る
- 停滞したら即中断して計画を練り直す

### サブエージェント活用
- メインコンテキストをクリーンに保つため、調査・探索はサブエージェントに委任

### 完了前の検証
- 動作証明できるまで完了としない。テスト実行・ログ確認

### コア原則
- **シンプルさ追求**: 影響範囲を最小限に
- **根本原因特定**: 一時しのぎの修正は行わない
- **影響最小化**: 必要な箇所のみ変更

---

## 7. 料金プラン

| | Free | Light | Standard | Premium |
|---|---|---|---|---|
| **月額** | ¥0 | ¥500 | ¥2,980 | ¥5,980 |
| 生成回数/月 | 10 | 10 | 60 | 200 |
| 店舗数 | 1 | 1 | 1 | 5 |
| 3案生成・集合知 | ○ | ○ | ○ | ○ |
| Instagram直接投稿 | - | ○ | ○ | ○ |
| 撮影ナッジ（毎日17時） | - | ○ | ○ | ○ |
| 分析結果（因果分析） | - | - | ○ | ○ |
| 自動学習・季節記憶・人格AI化 | - | - | ○ | ○ |
| 週間コンテンツ計画 | - | - | - | ○ |
| 強化版撮影アドバイス | - | - | - | ○ |

### コスト構造

| 項目 | コスト |
|---|---|
| 固定費（Railway） | ~$5/月（約¥750） |
| 固定費（Supabase） | $0（Freeプラン範囲内） |
| 1生成あたりAI原価 | 約¥6〜10（画像生成~¥6、直し~¥5(API圧縮後)） |
| ユーザー1人/月（1日1投稿+時々修正） | 約¥300〜450 |
| Standard粗利率 | 約90〜93% |
| Premium粗利率 | 約88〜92% |
| **損益分岐点** | **Standard 1人で黒字** |

### サブスク実装状況

- `subscriptions` テーブル: Supabase作成済み
- `SUBSCRIPTION_ENABLED` 環境変数: `true` で制限ON、未設定で全員premium扱い
- `planConfig.js`: 12機能フラグ定義済み（dailyPhotoNudge追加）
- `checkGenerationLimit()` / `isFeatureEnabled()`: imageHandler・pendingImageHandler・feedbackHandler に組み込み済み
- `handlePlanStatus()` / `handleUpgradePrompt()`: textHandler にルーティング済み（「プラン」「アップグレード」コマンド）
- Stripe Webhook: server.js にルート追加済み（`/stripe/webhook`）、Stripe環境変数は課金開始時に設定
- 処方箋機能: `prescriptionService.js` 実装済み（因果分析・業界比較・信条ブレンド）

---

## 8. 進捗管理

### 実装済みフェーズ一覧

| Phase | 内容 | 状態 |
|---|---|---|
| 1-2 | 基本機能（LINE Bot・画像生成・学習・RLS・季節記憶） | ✅ |
| 3 | エンゲージメント学習ループ（保存強度・投稿骨格・勝ちパターン） | ✅ |
| 4 | バグ修正・セキュリティ | ✅ |
| 5 | サブスク基盤（free/standard/premium）スタンドバイ | ✅ |
| 6 | 一言ヒント機能（画像→質問→ヒント→3案） | ✅ |
| 7 | UX改善・パフォーマンス・LP全面リデザイン | ✅ |
| 8 | コード整理・エラーメッセージ統一 | ✅ |
| 9 | 思想ログ学習（belief_logs → 人格AI化） | ✅ |
| 10 | Instagram API連携完成（IGAトークン・全メディアタイプ） | ✅ |
| 12 | エンゲージメント自動学習（報告時に自動分析→belief_logs） | ✅ |
| 13 | プロンプト改善+UX強化（生の言葉・伴走者トーン・店舗切替QR） | ✅ |
| 14 | Instagram Content Publishing API実装 | ✅ |
| 15 | サブスク接続完成 + 処方箋機能 | ✅ |
| 16 | Premium プラン価値リデザイン（週間計画・強化版撮影アドバイス・Instagram Standard開放） | ✅ |
| 17 | インフルエンサー対応 + API圧縮 + セキュリティ強化 | ✅ |
| 17.5 | 撮影ナッジ + 夜間エンゲージメント自動同期 + 直しカウント修正 + インサイト投稿選択 + 開発者テスト店舗 | ✅ |
| 18 | 発見AI（写真観察→投稿ネタ発見）+ hintType分岐 + 観察プロンプト改善 | ✅ |
| 19 | 1案集中生成（3案→1案即表示 + 別案再生成） | ✅ |
| 20 | Premium分析AI + ベースライン比較 + 写真特徴自動保存 | ✅ |
| 21 | 「直し:」削除 + Photo Advice 2セクション化 + 禁止ワード強化 + LP更新 | ✅ |

### 残タスク（優先度順）

1. [ ] Instagram API Advanced Access 申請（instagram_content_publish）
2. [ ] Stripe 環境変数設定・課金フロー検証（SUBSCRIPTION_ENABLED=true 後）
3. [ ] 単発追加課金（+5回/¥500）実装（Stripe One-time Payment）
4. [ ] セキュリティ残対応: H1(getStoreに所有者チェック) / H3(anon key分離)

---

## 9. 直近のセッションログ

### 2026-03-15（最新）

**作業内容：Phase 21 — 直し削除 + Photo Advice簡素化 + 禁止ワード強化 + LP更新**
- `feedbackHandler.js` — `handleFeedback` 関数削除、`handleStyleLearning` のみ残存
- `textHandler.js` — `直し:` コマンドブロック削除、`学習:` のみに統一
- `imageHandler.js` — `getRevisionExample` 参照削除
- `promptBuilder.js` — Photo Advice 3セクション→2セクション（📸撮影アドバイス + 🎯明日撮るべきもの）
- `promptBuilder.js` — `buildSupplementPrompt` に禁止ワードリスト追加（撮影アドバイスにも適用）
- `promptBuilder.js` — ハッシュタグにも禁止ワード適用明記（`buildBodyPrompt` + `buildImagePostPrompt`）
- `docs/index.html` — Feature #4 を学習ベースに変更、Premium に「写真分析AIレポート」追加、Free/Standard に disabled 表示
- テスト 352/352 passing

**次回への引き継ぎ事項：**
- Instagram API Advanced Access 申請（instagram_content_publish）
- Stripe 環境変数設定 → SUBSCRIPTION_ENABLED=true で本番テスト
- Entity Type 統一（Phase 23 プランあり）

### 2026-03-14（完了）

**作業内容：LP改善 — h1変更 + リングチャート比較セクション**
- `docs/index.html` 修正 — h1変更 + SVGリングチャート追加
- Phase 19: 1案集中生成（3案→1案即表示）
- Phase 20: Premium分析AI + ベースライン比較 + 写真特徴自動保存

**次回への引き継ぎ事項：**（→ 2026-03-15 で対応済み）

### 2026-03-12（完了）

**作業内容：Phase 18 発見AI — 写真観察→投稿ネタ発見ツール**
- `claudeService.js` 修正 — describeImage プロンプトに項目6「写真の観察（3つの視点）」追加
  - 初期: 固定カテゴリ方式（空間/光/過ごし方）→ 出力が単調
  - 改善1: 完全自由方式 → 抽象表現が暴れる（心の静寂・日常の断片等）
  - 改善2: ゆるい制約（物・光・行動・時間・空気感）+ 抽象NG明示 → 安定+発見
  - 改善3: 「なぜ投稿ネタになるか」1行追加 → 観察AI→発見AIに進化
  - 改善4: 監視感NG追加（客の行動を細かく観察しない。人→居心地・時間・空気で）
  - max_tokens 600→850、フォーマット `[① _]`（カテゴリ名は出力しない）
- `imageHandler.js` 修正 — `parseCharmViewpoints()` 新関数 + Push通知で3視点ボタン送信
  - 正規表現で `[①②③]` パース、旧フォーマット `[視点A/B/C]` フォールバック
  - `cleanDescription`（5項目のみ）を pending_image_context に保存
  - `charmViewpoints` 配列を pending_image_context に追加
  - 即reply: 「この写真を観察しています...」→ 数秒後Push: 3視点ボタン
  - 視点パース失敗時: 汎用ヒントボタン（お知らせ/日常感/お役立ち/スキップ）をPush
- `pendingImageHandler.js` 修正 — hintType検出追加
  - `charmViewpoints.includes(hint)` で viewpoint/manual を判定
- `promptBuilder.js` 修正 — hintType分岐 + 品質ルール追加
  - viewpoint: 「投稿の切り口（写真から発見した投稿コンセプト）」として扱う
  - manual: 「店主からの一言（この言葉を投稿の核にすること）」として扱う
  - 「客のフリをしない」ルール追加（3箇所）
  - 撮影アドバイスを3行以内に簡潔化
  - 「写真に写っていない情報を補わない」ルール追加（画像/テキスト両プロンプト）
- テスト 241 → 252（Scenario 47: 魅力発見AI 11件追加）

**次回への引き継ぎ事項：**
- Instagram API Advanced Access 申請（instagram_content_publish）
- Stripe 環境変数設定 → SUBSCRIPTION_ENABLED=true で本番テスト
- 実機テストで発見AIの出力品質を継続確認

### 2026-03-10（完了）

**作業内容：学習→Instagram投稿導線 + persona自動更新（10投稿ごと）**
- `feedbackHandler.js` 修正 — 「学習:」コマンド後にユーザーの書き直し文章で `updatePostContent` → Instagram 📸ボタン表示
  - `replyWithQuickReply` / `updatePostContent` / `getInstagramAccount` をimport追加
  - Instagram連携済み & 画像URLあり → クイックリプライで📸ボタン付き返信
- `advancedPersonalization.js` 修正 — persona自動更新システム追加
  - `regeneratePersonaDefinition` を export（private → public）
  - `autoRegeneratePersonaIfNeeded(storeId)` 新関数: 10投稿ごとにbelief_logs→persona_definition自動更新
  - `_personaRegenerating` Map による同時実行防止（in-memory lock）
  - `filterPersonaBeliefs(beliefLogs)` 新関数: persona系belief（文体・口調）とstrategy系belief（投稿時間・数値傾向）を分離
    - strategy系パターン: 投稿時間/保存率/エンゲージ/文字数/曜日/反応/ハッシュタグ数
  - `_last_persona_update_post_count` で前回更新時の投稿数を追跡
  - 先にカウント更新→regenerate実行（重複発火防止）
- `pendingImageHandler.js` 修正 — `savePostHistory()` 後に fire-and-forget で `autoRegeneratePersonaIfNeeded` 呼び出し
- テスト 234 → 241（Scenario 46: persona自動更新 7件追加）

**次回への引き継ぎ事項：**
- Instagram API Advanced Access 申請（instagram_content_publish）
- Stripe 環境変数設定 → SUBSCRIPTION_ENABLED=true で本番テスト
- Railway Hobbyプラン切替

### 2026-03-09（完了）

**作業内容：Phase 17.5 撮影ナッジ + 夜間エンゲージメント自動同期 + 直しカウント + インサイト投稿選択**
- `dailyNudgeService.js` 新規作成 — 毎日17時JSTに未投稿ユーザーへカテゴリ別撮影提案送信（Standard+Premium）
  - `nudgeTemplates.js` 新規作成（6グループ×70テンプレート、季節フィルタ付き）
  - Premium: Claude APIでパーソナライズ生成（失敗時テンプレートにフォールバック）
  - Freeプランはスキップ（LINE Push通数削減）、IG連携済みもスキップ
- `nightlyEngagementService.js` 新規作成 — 毎日深夜2時JSTにInstagram APIからエンゲージメント自動取得
  - instagram_postsテーブルのメトリクス更新 + post_historyとキャプションマッチング
  - 学習パイプライン発火: saveEngagementMetrics → applyEngagementToProfile → analyzeEngagementWithClaude
  - `learning_synced` フラグで重複学習防止
- `instagramService.js` 修正 — `graphApiRequestBase` / `GRAPH_API_BASE` / `INSTAGRAM_API_BASE` をexport
- `feedbackHandler.js` 修正 — 「直し:」の結果を `savePostHistory` で新規保存（生成回数カウントに含まれるように）
- `imageHandler.js` 修正 — インサイトスクショ報告時、複数投稿があれば番号選択UI表示
- `textHandler.js` 修正 — `awaiting_post_selection` ハンドラー追加
- `planConfig.js` 修正 — `dailyPhotoNudge` フラグ追加（12機能フラグ）
- `scheduler.js` 修正 — 撮影ナッジ(JST17:00) + 夜間同期(JST2:00) cronジョブ追加、週間計画をJST8:00→9:30に変更
- `database/migration_learning_synced.sql` 新規 — instagram_postsに learning_synced カラム追加 ✅実行済み
- CLAUDE.md セキュリティ: 機密ファイル読み取り禁止ルール追加
- テスト 225/225 passing（Scenario 43: 撮影ナッジ13件 + Scenario 44: 夜間同期10件）
- 「直し:」の結果を `savePostHistory` で新規保存（生成回数カウントに含まれるように変更）
- 開発者テスト店舗機能追加:
  - `/admin dev-store` コマンドで「開発者テスト」カテゴリーの特殊店舗を作成
  - 画像送信時に `contentCategoryDetector` で被写体カテゴリーを自動判定、`effectiveCategory` として使用
  - プロンプト・集合知クエリ・ハッシュタグに `effectiveCategory` を適用（毎回写真に応じて変わる）
  - 開発者テスト店舗のデータは集合知DB（`saveEngagementMetrics`）に保存しない
  - `isDevTestStore()` ヘルパーで判定（adminHandler.js から export）
- テスト 234/234 passing（Scenario 45: 開発者テスト店舗 9件追加）
- `claudeService.js` / `insightsOCRService.js` 修正 — Haikuモデル `claude-3-5-haiku-20241022`(廃止) → `claude-haiku-4-5-20251001` に更新
- `MODEL_HAIKU` を export して `insightsOCRService` で再利用（モデルID一元管理）
- `promptBuilder.js` 修正 — `categoryHint` から「開発者テスト」を除外（ハッシュタグ混入防止）

**次回への引き継ぎ事項：**
- Instagram API Advanced Access 申請（instagram_content_publish）
- Stripe 環境変数設定 → SUBSCRIPTION_ENABLED=true で本番テスト
- Railway Hobbyプラン切替（トライアル残7日）

### 2026-03-05（完了）

**作業内容：インフルエンサー対応 + API圧縮最適化**
- インフルエンサーカテゴリー追加（categoryDictionary.js: クリエイティブ系グループ）
- インフルエンサー専用プロンプト完全分離（promptBuilder.js: `buildInfluencerImagePrompt` / `buildInfluencerTextPrompt`）
  - 店舗用（写真観察AI）とは独立した「スマホで書いた自然なSNS文章」プロンプト
  - ポエム表現排除・分量削減（想起の一言→ひとこと、世界観→さりげない導線）
- インフルエンサー専用オンボーディング（onboardingHandler.js: `influencer_genre` ステップ）
  - 店名・こだわり・口調の3要素入力を省略し「何系の発信？」1問で登録完了
- 「直し:」「学習:」のAPI 3回→2回に圧縮（advancedPersonalization.js + feedbackHandler.js）
  - `analyzeFeedbackWithClaude` に `profileContext` 追加、`persona_definition_next` を同時生成
  - `getProfileAndPrompt` ヘルパー追加（DB1回で一括取得）
  - フォールバック: profileContext未渡し時は従来の3回フロー
- テスト 188/188 passing

**次回への引き継ぎ事項：**
- インフルエンサーの実際の出力品質をテスト・調整
- `migration_weekly_plans.sql` を Supabase SQL Editor で実行
- Stripe 環境変数設定 → SUBSCRIPTION_ENABLED=true で本番テスト
- Meta Developer で `instagram_content_publish` Advanced Access 申請

### 2026-03-04 #3（完了）

**作業内容：Phase 16 Premium プラン価値リデザイン**
- planConfig.js: `instagramSchedulePost` → `instagramPost` リネーム、Instagram投稿を Standard+Premium に開放（旧: Premium限定）
- planConfig.js: 新フラグ追加 `weeklyContentPlan`（Premium専用）、`enhancedPhotoAdvice`（Premium専用）。機能フラグ 9 → 11
- `weeklyPlanService.js` 新規作成 — Claude APIで週間コンテンツ計画生成（月〜金5日分: テーマ・撮影指示・最適投稿時間・異業種インサイト）
- `weeklyPlanHandler.js` 新規作成 — 「今週の計画」「/weekly」コマンド処理（Premium ゲーティング付き）
- textHandler.js に「今週の計画」「/weekly」ルーティング + isSystemCommand 追加
- scheduler.js に毎週月曜 08:00 JST の cron ジョブ追加（週間計画自動配信）
- promptBuilder.js: `options.isPremium` パラメータ追加、Premium ユーザーに「明日撮るべきもの」+「なぜ反応が取れそうか」セクション付与
- pendingImageHandler.js: `isFeatureEnabled('enhancedPhotoAdvice')` で isPremium 判定→ promptBuilder に渡す
- subscriptionService.js: `buildPlanSummaryMessage` を新機能フラグ対応に更新
- `database/migration_weekly_plans.sql` 新規作成 — `weekly_content_plans` テーブル
- テスト 14件追加（Scenario 38-40）→ 188/188 passing

**次回への引き継ぎ事項：**
- `migration_weekly_plans.sql` を Supabase SQL Editor で実行
- Stripe 環境変数設定 → SUBSCRIPTION_ENABLED=true で本番テスト
- Meta Developer で `instagram_content_publish` Advanced Access 申請
- 単発追加課金（+5回/¥500）実装の検討

### 2026-03-04 #2（完了）

**作業内容：Phase 15 サブスク接続完成 + 処方箋機能**
- feedbackHandler に `checkGenerationLimit` 追加（修正生成前に上限チェック）
- textHandler に「プラン」「アップグレード」コマンド追加 + isSystemCommand 拡張
- server.js に Stripe Webhook ルート追加（`/stripe/webhook`、LINE Webhook の前に定義）
- `prescriptionService.js` 新規作成（因果分析・業界比較・信条ブレンドの3分析）
- reportHandler の分析結果セクションを prescriptionService に置き換え（フォールバック付き）
- テスト 21件追加（Scenario 35-37）→ 174/174 passing

**次回への引き継ぎ事項：**
- 単発追加課金（+5回/¥500）実装の検討（Stripe One-time Payment Link）
- Stripe 環境変数設定 → SUBSCRIPTION_ENABLED=true で本番テスト
- Meta Developer で `instagram_content_publish` Advanced Access 申請
- プロンプト改善: お茶目な本音を強める

### 2026-03-04 #1（完了）

**作業内容：Instagram投稿テスト成功確認**
- Instagram直接投稿の動作確認完了（LINE → 画像 → ヒント → A/B/C → 📸ボタン → Instagram投稿 ✅）
- Railwayデプロイエラー（Docker Hub TLSタイムアウト）→ Redeployで解消

### 2026-03-03 #3（完了）

**作業内容：Instagram投稿機能仕上げ + セキュリティ監査**
- 撮影アドバイス除外・Supabase Storageバケット作成・セキュリティ修正3件（H2,M2,M3）
- テスト 153/153 passing

### 2026-03-03 #2（完了）

**作業内容：Instagram Content Publishing API 実装**
- 全9ファイル修正・新規作成
- LINE画像→Supabase Storage→Instagram投稿の一気通貫フロー

### 2026-03-03 #1（完了）

**作業内容：サブスク・表記変更・影の秘書プロンプト強化**
- SUBSCRIPTION_ENABLED=true テスト完了
- planConfig.js 刷新（新プラン設計・9機能フラグ）

---

## 10. ⚠️ セキュリティ警告

**「Shai-Hulud」という名前のパッケージは悪質なマルウェアです。絶対にインストールしない。**

### 機密ファイル読み取り禁止（絶対厳守）

以下のファイル・ディレクトリは**内容を絶対に読み取らない**。セキュリティ監査時も中身を見ずにファイルの存在確認のみ行う。

| 種別 | 対象 |
|---|---|
| 環境変数 | `.env` / `.env.*`（.env.local, .env.production 等すべて） |
| SSH鍵 | `.ssh/` 配下すべて（id_rsa, id_ed25519, known_hosts, config 等） |
| APIキー・トークン | APIキー・シークレット・トークンを含む可能性のあるファイル全般 |
| 認証情報 | `credentials.json` / `service-account*.json` / `token.json` / `auth.json` |
| Git認証 | `.git-credentials` / `.gitconfig`（トークン含む場合） / `.netrc` |
| クラウド設定 | `.aws/` / `.gcloud/` / `.azure/` / `.config/` 配下の認証ファイル |
| パッケージ認証 | `.npmrc`（authToken含む） / `.yarnrc` / `.pypirc` |
| Docker秘匿 | `docker-compose*.yml` 内の環境変数セクション（secrets/passwords） |
| 証明書・鍵 | `*.pem` / `*.key` / `*.p12` / `*.pfx` / `*.jks` |
| データベース | DB接続文字列を含むファイル / `database.yml` のパスワード部分 |
| セッション・Cookie | セッショントークン / Cookie値 / JWTシークレット |
| Stripe・決済 | Stripeキー / Webhook Secret / 決済関連シークレット |
| その他 | `secrets/` ディレクトリ / `*.secret` / パスワードマネージャーのエクスポートファイル |

**原則**: ファイル名やパスから「アカウント乗っ取り・API不正利用・認証情報漏洩」のリスクが少しでも疑われるものは、読み取りを拒否する。

---

## 11. メモ欄

### 口調設定（`store.tone`）
`casual` / `friendly` / `professional` / `passionate` / `luxury` の5種類

### 投稿文字数設定（`store.config.post_length`）
`xshort` の場合は3層構造を適用しない（200文字以上必要なため）

### Instagram Graph API
- プロアカウント必須 / Facebookページ紐づけ
- IGA トークン使用（60日有効期限）
- `/instagram connect [トークン]` で連携
- トークンタイプ検出: `accessToken.startsWith('IG')` → Instagram API / それ以外 → Facebook Graph API
- Content Publishing: 2ステップ（container作成→publish）、ポーリング最大10回×2秒間隔

### Supabase Storage
- `post-images` バケット（Public）— Instagram投稿用の画像公開URL
- LINE画像は一時的なので、base64→Storage→公開URLの変換が必要

### profile_data スキーマ（思想ログ学習）
- `belief_logs`: `[{text, source, created_at}]` 上限20件FIFO
- `persona_definition`: ライティング指示集（7項目以内の箇条書き）
- `persona_version` / `persona_history`: バージョニング（最新5件保持）
- `_last_persona_update_post_count`: persona自動更新時の投稿数（10投稿ごとに更新）
- source タイプ: `feedback` / `proposal_pattern` / `positive_streak` / `engagement_auto`

### Supabase SQL 実行順序
```
1. scripts/enable-rls.sql ✅
2. scripts/add-seasonal-memory.sql
3. scripts/add-instagram-tables.sql
4. database/migration_save_intensity.sql ✅
5. database/migration_post_structure.sql ✅
6. database/migration_status_column.sql ✅
7. database/migration_pending_image.sql ✅
8. database/migration_subscriptions.sql ✅
9. database/migration_instagram_publish.sql ✅
10. database/migration_weekly_plans.sql ✅
11. database/migration_learning_synced.sql ✅
```

### スケジューラー（cron ジョブ一覧）

| 時刻 (JST) | UTC | ジョブ名 | 内容 |
|---|---|---|---|
| 毎日 10:00 | 1:00 | デイリーリマインダー | 朝リマインダー送信 |
| 毎日 17:00 | 8:00 | デイリー撮影ナッジ | 未投稿ユーザーに撮影提案（Standard+） |
| 毎日 23:59 | 14:59 | デイリーサマリー | 管理者に1日の統計通知 |
| 毎日 2:00 | 17:00 | 夜間エンゲージメント同期 | IG投稿メトリクス取得→自動学習 |
| 月曜 9:00 | 0:00 | カテゴリー昇格チェック | otherカテゴリの昇格候補検出 |
| 月曜 9:30 | 0:30 | 週間コンテンツ計画 | Premiumに週間計画配信 |

### 単発追加課金（+5回/¥500）— 将来実装メモ
- ユーザーが月間生成上限に到達したとき「あと5回/¥500」で追加購入できる仕組み
- 実装方針: Stripe One-time Payment Link（サブスク不要・単発決済）
- DB: `subscriptions` テーブルに `bonus_generations` カラム追加
- `checkGenerationLimit()` で `月間上限 + bonus_generations` を合算チェック
- Stripe Webhook で `checkout.session.completed`（mode=payment）を検知 → bonus_generations +5
- 検討事項: 月末リセットするか繰り越すか / 月あたり購入回数の上限
- 導入タイミング: Stripe 環境変数設定・課金フロー検証が完了してから
