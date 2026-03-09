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
| **コンセプト** | LINE に写真を送るだけで、Instagram投稿文を AI が自動生成する「影の秘書」サービス |
| **テスト** | 188/188 passing |

### サービスの特徴

- **Ver.4.0 Dual Trigger Model**: 1投稿に2つのトリガーを埋め込む
  - **想起トリガー(7割)**: 五感・時間帯・小さな情景 → 店を思い出させる
  - **来店トリガー(3割)**: 今・数量・具体・小さな理由 → 押さずに動かす
- **影の秘書コンセプト**: 4原則（情報の言葉禁止/署名性/湿度/要約しない）
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
│   │   ├── feedbackHandler.js   # 修正指示・学習フィードバック
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
│   │   └── scheduler.js               # cron 定期処理
│   ├── utils/
│   │   ├── promptBuilder.js     # ★プロンプト生成（影の秘書・Dual Trigger）
│   │   ├── contentCategoryDetector.js # 被写体カテゴリー検出
│   │   └── learningData.js      # 学習データ集約
│   └── config/
│       ├── planConfig.js        # サブスクプラン定義（Free/Standard/Premium）
│       ├── categoryGroups.js    # カテゴリー分類定義
│       └── validationRules.js   # エンゲージメント指標検証ルール
├── database/                    # マイグレーションSQL
│   ├── migration_save_intensity.sql
│   ├── migration_post_structure.sql
│   ├── migration_status_column.sql
│   ├── migration_pending_image.sql
│   ├── migration_subscriptions.sql
│   ├── migration_instagram_publish.sql  # Instagram投稿用（image_url等）
│   └── migration_weekly_plans.sql       # 週間コンテンツ計画テーブル
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

### プロンプト設計（Ver.4.0 Dual Trigger Model + 影の秘書）

**Role**: 「影の秘書」
**4原則**: 情報の言葉禁止 / 署名性 / 湿度 / 要約しない

**describeImage（五感ベース5項目分析）：**
1. 何が写っているか — 被写体を具体的に
2. 視覚的な印象 — 色味・光・質感
3. 五感の推測 — 香り・音・温度・手触り
4. 時間帯・季節感
5. 記憶を呼ぶ要素

**3案のラベル（店舗用）：**
- 案A: 時間の肖像（記憶に残る日常）
- 案B: 誠実の肖像（さりげない誘い＝店主が勝手に楽しんでる姿を覗き見させる）
- 案C: 光の肖像（店主のひとりごと）

**3案のラベル（インフルエンサー用）：**
- 案A: 視点の切り取り
- 案B: 日常の一コマ
- 案C: 本音のひとりごと

**出力構成（店舗 各案3パート）**: 本文 + 想起の一言(15-25字) + 来店の一文 + ハッシュタグ
**出力構成（インフルエンサー 各案3パート）**: 本文 + ひとこと(15-25字) + さりげない導線 + ハッシュタグ

**Photo Advice**: 良い点1つ + 次の提案1つ（合計2行以内・物語的裏付け）

**禁止ワード**: 幻想的/素敵/魅力的/素晴らしい/完璧/最高/美しい/ぜひ/おすすめ/大好評/お得
**旧芸術語禁止**: 光の意志/質感の物語/沈黙のデザイン/肖像/独白/心拍数/体温

**「生の言葉」ルール**: 「綺麗すぎ注意ワード」制御 + 「この店・この瞬間でしか成立しない不純物」を必ず入れる

### インフルエンサー専用プロンプト設計

店舗用プロンプト（影の秘書・Dual Trigger）とは**完全分離**。`buildInfluencerImagePrompt` / `buildInfluencerTextPrompt` で独立管理。

- **コンセプト**: スマホでその場で書いたような自然なSNS文章
- **文章ルール**: 短文・会話口調・説明しすぎない・少し雑でも自然
- **禁止**: 広告っぽい文章・宣伝語・長い説明・ポエム調
- **オンボーディング**: 「何系の発信してますか？」1問のみ（店名・こだわり・口調は不要）
  - 回答をそのまま store.name / store.strength に使用、tone は 'casual' 固定

### 修正指示（buildRevisionPrompt）

- `style_rules` を**含めない**。修正指示を100%最優先
- `forbidden_words` のみ残す
- `getProfileAndPrompt` で学習データ反映

### diff学習フロー（API 2回に圧縮済み）

```
「直し:指示」→ ①修正生成(askClaude) → ②diff分析+指示集更新(analyzeFeedbackWithClaude)
```

- `analyzeFeedbackWithClaude` に `profileContext`（現在のbelief_logs + persona_definition + writing_style）を渡す
- 出力JSONに `persona_definition_next` を含めて、分析と指示集更新を1回のAPIで統合
- `profileContext` 未渡し時は従来の3回フロー（`regeneratePersonaDefinition` 別呼び出し）にフォールバック
- `getProfileAndPrompt`: DB1回でプロンプト注入用文字列 + profileContext を一括取得

### Instagram投稿時のキャプション処理

- `━━━` 区切り以降（撮影アドバイス）を除外して本文+ハッシュタグのみ投稿
- `latestPost.content.split(/\n━{3,}/)[0].trim()`

---

## 5. コマンド・操作リファレンス

### LINE ユーザーコマンド

| コマンド | 動作 |
|---|---|
| `登録` | オンボーディング開始 |
| 画像送信 | ヒント質問→一言入力→3案生成 |
| `A` / `B` / `C` | 案選択→確定（📸ボタン表示） |
| `instagram投稿` | 最新投稿をInstagramに直接投稿 |
| `直し: 〜` | 最新投稿を修正指示に従い再生成 |
| `学習: 〜` | 思想ログに手動追加 |
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

| | Free | Standard | Premium |
|---|---|---|---|
| **月額** | ¥0 | ¥3,000 | ¥7,000 |
| 生成回数/月 | 10 | 25 | 60 |
| 店舗数 | 1 | 3 | 無制限 |
| 3案生成・集合知 | ○ | ○ | ○ |
| 分析結果（因果分析） | - | ○ | ○ |
| 自動学習・季節記憶・人格AI化 | - | ○ | ○ |
| Instagram直接投稿 | - | ○ | ○ |
| 週間コンテンツ計画 | - | - | ○ |
| 強化版撮影アドバイス | - | - | ○ |

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
- `planConfig.js`: 11機能フラグ定義済み
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

### 残タスク（優先度順）

1. [ ] `migration_weekly_plans.sql` を Supabase SQL Editor で実行
2. [ ] Instagram API Advanced Access 申請（instagram_content_publish）
3. [ ] Stripe 環境変数設定・課金フロー検証（SUBSCRIPTION_ENABLED=true 後）
4. [ ] 単発追加課金（+5回/¥500）実装（Stripe One-time Payment）
5. [ ] セキュリティ残対応: H1(getStoreに所有者チェック) / H3(anon key分離)

---

## 9. 直近のセッションログ

### 2026-03-05（最新・完了）

**作業内容：インフルエンサー対応 + API圧縮最適化**
- インフルエンサーカテゴリー追加（categoryDictionary.js: クリエイティブ系グループ）
- インフルエンサー専用プロンプト完全分離（promptBuilder.js: `buildInfluencerImagePrompt` / `buildInfluencerTextPrompt`）
  - 店舗用（影の秘書・Dual Trigger）とは独立した「スマホで書いた自然なSNS文章」プロンプト
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
10. database/migration_weekly_plans.sql
```

### 単発追加課金（+5回/¥500）— 将来実装メモ
- ユーザーが月間生成上限に到達したとき「あと5回/¥500」で追加購入できる仕組み
- 実装方針: Stripe One-time Payment Link（サブスク不要・単発決済）
- DB: `subscriptions` テーブルに `bonus_generations` カラム追加
- `checkGenerationLimit()` で `月間上限 + bonus_generations` を合算チェック
- Stripe Webhook で `checkout.session.completed`（mode=payment）を検知 → bonus_generations +5
- 検討事項: 月末リセットするか繰り越すか / 月あたり購入回数の上限
- 導入タイミング: Stripe 環境変数設定・課金フロー検証が完了してから
