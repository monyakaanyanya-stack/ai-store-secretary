import { replyText, replyWithQuickReply } from '../services/lineService.js';
import { askClaude } from '../services/claudeService.js';
import {
  createStore,
  updateCurrentStore,
  getStore,
  getStoresByUser,
  savePostHistory,
  supabase,
  updateStoreConfig,
  updateStoreTemplates,
  updateStorePostMode,
  setPendingCommand,
  clearPendingCommand,
  savePendingImageContext,
  clearPendingImageContext,
  getLatestPost,
} from '../services/supabaseService.js';
import { handleFeedback, handleStyleLearning } from './feedbackHandler.js';
import { handleEngagementReport, handlePostSelection, applyEngagementMetrics } from './reportHandler.js';
import { handleOnboardingStart, handleOnboardingResponse, handleHelpMenu, handleHelpCategory, handleCommandList } from './onboardingHandler.js';
import { handleDataStats } from './dataStatsHandler.js';
import { handleAdminMenu, handleAdminTestData, handleAdminClearData, handleAdminClearTestData, handleAdminReportMode, handleAdminReportSave, handleAdminCategoryRequests, handleAdminSub, handleAdminDevStore } from './adminHandler.js';
import { handleInstagramCommand } from './instagramHandler.js';
import { handlePendingImageResponse } from './pendingImageHandler.js';
import { handleFollowerCountResponse, getPendingFollowerRequest } from '../services/monthlyFollowerService.js';
import { handleDataResetPrompt, handleDataResetExecution, handleStoreDeletePrompt, handleStoreDeleteExecution } from './dataResetHandler.js';
import { handlePlanStatus, handleUpgradePrompt } from './subscriptionHandler.js';
import { handleWeeklyPlan } from './weeklyPlanHandler.js';
import { applyFeedbackToProfile } from '../services/personalizationEngine.js';
import {
  generateConversationalResponse,
  saveConversation,
  getRecentConversations,
  cleanOldConversations,
  classifyIntent,
} from '../services/conversationService.js';
import { buildStoreParsePrompt, buildTextPostPrompt, POST_LENGTH_MAP, appendTemplateFooter } from '../utils/promptBuilder.js';
import { getGlobalPromptRules } from '../services/promptTuningService.js';
import { normalizeInput } from '../utils/inputNormalizer.js';
import { normalizeCategory } from '../config/categoryDictionary.js';
import { getBlendedInsights, saveEngagementMetrics } from '../services/collectiveIntelligence.js';
import { getPersonalizationPromptAddition, getLearningStatus } from '../services/personalizationEngine.js';
import { getAdvancedPersonalizationPrompt, addSimpleBelief } from '../services/advancedPersonalization.js';
import { getSeasonalMemoryPromptAddition, getSeasonalMemoryStatus } from '../services/seasonalMemoryService.js';
import { getRevisionExample, getRevisionQuickReplies } from '../utils/categoryExamples.js';
import { checkGenerationLimit, isFeatureEnabled } from '../services/subscriptionService.js';

/**
 * テキストメッセージの振り分け処理
 */
export async function handleTextMessage(user, text, replyToken) {
  // H11修正: 入力長の上限チェック（5000文字以上はLINE仕様外 or 攻撃的入力）
  if (!text || text.length > 5000) {
    return await replyText(replyToken, 'メッセージが長すぎます。5000文字以内でお願いします。');
  }

  // 全角コロン「：」→半角「:」、全角数字「１２３」→半角「123」を最初に1回正規化
  const trimmed = normalizeInput(text.trim());

  // Instagram コマンド
  if (trimmed.startsWith('/instagram')) {
    const args = trimmed.replace(/^\/instagram\s*/, '');
    const handled = await handleInstagramCommand(user, args, replyToken);
    if (handled) return;
  }

  // 管理者コマンド（最優先で処理）
  if (trimmed.startsWith('/admin')) {
    const args = trimmed.replace(/^\/admin\s*/, '');

    if (args === '') {
      const handled = await handleAdminMenu(user, replyToken);
      if (handled) return;
    } else if (args.startsWith('test-data')) {
      const testArgs = args.replace(/^test-data\s*/, '');
      const handled = await handleAdminTestData(user, testArgs, replyToken);
      if (handled) return;
    } else if (args === 'clear-test-data') {
      const handled = await handleAdminClearTestData(user, replyToken);
      if (handled) return;
    } else if (args === 'clear-data') {
      const handled = await handleAdminClearData(user, replyToken);
      if (handled) return;
    } else if (args === 'report') {
      const handled = await handleAdminReportMode(user, replyToken);
      if (handled) return;
    } else if (args === 'category-requests') {
      const handled = await handleAdminCategoryRequests(user, replyToken);
      if (handled) return;
    } else if (args.startsWith('sub')) {
      const subArgs = args.replace(/^sub\s*/, '');
      const handled = await handleAdminSub(user, subArgs, replyToken);
      if (handled) return;
    } else if (args === 'dev-store') {
      const handled = await handleAdminDevStore(user, replyToken);
      if (handled) return;
    }
    // /admin で始まるメッセージは管理者以外には無視（後続ハンドラーに流さない）
    return;
  }

  // 管理者の実データ入力（カテゴリー: から始まる場合）
  if (trimmed.startsWith('カテゴリー:') || trimmed.startsWith('カテゴリ:')) {
    const handled = await handleAdminReportSave(user, trimmed, replyToken);
    if (handled) return;
  }

  // 画像「一言ヒント」待ち状態の処理
  // （システムコマンドはスキップ、それ以外はここで受け取る）
  const isSystemCommand = ['キャンセル', 'cancel', 'リセット', 'データリセット',
    '店舗一覧', '店舗切り替え', '店舗切替', '店舗削除', 'ヘルプ', 'help', '学習状況', '問い合わせ', '登録',
    'プラン', 'アップグレード', '今週の計画', '投稿ネタ', '投稿ネタ教えて', 'ネタ', 'コマンド一覧', 'コマンド',
    'モード切替', 'モード切り替え', 'AI投稿モード', 'そのまま投稿モード', 'そのまま投稿', 'direct投稿実行', 'direct複数枚投稿',
    'ストック', 'ストック保存', 'ストック投稿', 'ストック予約', 'ストック削除', 'ストック一括削除', '予約投稿', 'これで決定', '別案', 'コピー',
    'instagram投稿', '複数枚投稿'].includes(trimmed)
    || trimmed.startsWith('切替:') || trimmed.startsWith('ストック:') || trimmed.startsWith('予約:') || trimmed.startsWith('/') || trimmed.startsWith('学習:') || trimmed.startsWith('学習：') || trimmed.startsWith('直し:') || trimmed.startsWith('直し：');

  // カルーセルモード中のテキスト処理（通常のpending_image_contextより先に判定）
  if (user.pending_image_context?.carousel_mode && !isSystemCommand) {
    const { handleCarouselTextResponse } = await import('./instagramHandler.js');
    const handled = await handleCarouselTextResponse(user, trimmed, replyToken);
    if (handled) return;
  }

  // direct_modeの画像待ち → テキスト受信でテンプレ結合＆プレビュー表示
  if (user.pending_image_context?.direct_mode && !isSystemCommand) {
    const handled = await handleDirectModeText(user, trimmed, replyToken);
    if (handled) return;
  }

  // pending_command を pending_image_context より先に処理
  // （stock_mode中のpending_image_contextが予約日時入力を横取りしないため）
  if (user.pending_command && !isSystemCommand) {
    const cmd = user.pending_command;
    await clearPendingCommand(user.id);
    if (cmd === 'revision') {
      // 3案が未選択の場合はまず案を選ぶよう促す
      if (user.current_store_id) {
        const storeForCheck = await getStore(user.current_store_id);
        if (storeForCheck) {
          const { data: checkPost } = await supabase
            .from('post_history')
            .select('content')
            .eq('store_id', storeForCheck.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (checkPost?.content && /\[\s*案A[：:]/.test(checkPost.content)) {
            return await replyText(replyToken, '先にA / B / C のいずれかを選んでから修正指示を送ってください✉️');
          }
        }
      }
      return await handleFeedback(user, trimmed, replyToken);
    }
    if (cmd === 'style_learning') {
      // 後方互換: 旧style_learningはrevisionと同じ統合フローへ
      if (user.current_store_id) {
        const storeForCheck = await getStore(user.current_store_id);
        if (storeForCheck) {
          const { data: checkPost } = await supabase
            .from('post_history')
            .select('content')
            .eq('store_id', storeForCheck.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (checkPost?.content && !/\[\s*案A[：:]/.test(checkPost.content)) {
            return await handleFeedback(user, trimmed, replyToken);
          }
        }
      }
      return await handleStyleLearning(user, trimmed, replyToken);
    }
    if (cmd === 'awaiting_schedule_time') {
      // 予約投稿の日時入力待ち
      const { handleScheduleConfirm } = await import('./stockHandler.js');
      return await handleScheduleConfirm(user, trimmed, replyToken);
    }
    if (cmd === 'awaiting_stock_batch_delete') {
      // ストック一括削除の番号入力待ち
      const { handleBatchDeleteConfirm } = await import('./stockHandler.js');
      return await handleBatchDeleteConfirm(user, trimmed, replyToken);
    }
    if (cmd === 'awaiting_post_selection') {
      // インサイトスクショ後の投稿選択
      const ctx = user.pending_image_context;
      if (!ctx || !ctx.insightsData || !ctx.recentPosts) {
        await clearPendingImageContext(user.id);
        return await replyText(replyToken, 'セッションが切れました。もう一度スクショを送ってください');
      }
      const idx = parseInt(trimmed, 10);
      if (isNaN(idx) || idx < 1 || idx > ctx.recentPosts.length) {
        // 無効な選択 → 再度選択を促す（pending_commandを再設定）
        await setPendingCommand(user.id, 'awaiting_post_selection');
        return await replyText(replyToken,
          `1〜${ctx.recentPosts.length} の番号で選んでください`
        );
      }
      const selectedPost = ctx.recentPosts[idx - 1];
      await clearPendingImageContext(user.id);
      const store = await getStore(ctx.storeId);
      if (!store) {
        return await replyText(replyToken, '店舗が見つかりません');
      }
      return await applyEngagementMetrics(user, store, ctx.insightsData, selectedPost, replyToken);
    }
  }

  // 画像「一言ヒント」待ち状態の処理（pending_commandより後に判定）
  if (user.pending_image_context && !isSystemCommand) {
    const handled = await handlePendingImageResponse(user, trimmed, replyToken);
    if (handled) return;
  }

  // 重要なコマンドはオンボーディング中でも優先処理
  const priorityCommands = [
    '店舗削除', '店舗削除実行', 'データリセット', 'リセット', 'リセット実行', '学習リセット',
    'キャンセル', 'cancel', '店舗一覧', '店舗切り替え', '店舗切替', '学習状況', 'ヘルプ', 'help', '問い合わせ'
  ];
  const isPriorityCommand = priorityCommands.includes(trimmed);

  // オンボーディング中の入力を処理（優先コマンド以外）
  if (!isPriorityCommand) {
    const onboardingHandled = await handleOnboardingResponse(user, trimmed, replyToken);
    if (onboardingHandled) {
      return;
    }
  }

  // オンボーディング: 「登録」コマンド
  if (trimmed === '登録') {
    return await handleOnboardingStart(user, replyToken);
  }

  // 店舗登録: 「1:」で始まる（旧形式、後方互換性のため残す）
  if (trimmed.startsWith('1:')) {
    return await handleStoreRegistration(user, trimmed, replyToken);
  }

  // フォロワー数の報告: 「フォロワー:」で始まる
  if (trimmed.startsWith('フォロワー:')) {
    const followerCountMatch = trimmed.match(/フォロワー[:：]\s*(\d+)/);
    if (followerCountMatch) {
      const followerCount = parseInt(followerCountMatch[1], 10);
      return await handleFollowerCountResponse(user, followerCount, replyToken);
    }
  }

  // フィードバック: 「直し:」で始まる
  if (trimmed.startsWith('直し:')) {
    const feedback = trimmed.replace(/^直し[:：]\s*/, '');

    // 内容が空 = 「直し」ボタンが押された → 入力待ちモードへ
    if (!feedback.trim()) {
      try {
        await setPendingCommand(user.id, 'revision');
      } catch (e) {
        return await replyText(replyToken, '⚠️ 状態の保存に失敗しました。修正内容を「直し: もっとカジュアルに」の形で送ってください。');
      }
      // カテゴリーに応じたクイックリプライ選択肢を取得
      let revisionCategory = null;
      if (user.current_store_id) {
        try {
          const storeForCategory = await getStore(user.current_store_id);
          revisionCategory = storeForCategory?.category ?? null;
        } catch (_) { /* 取得失敗時はデフォルト選択肢を使用 */ }
      }
      return await replyWithQuickReply(
        replyToken,
        '✏️ どんな修正をしますか？\n\n修正指示を送ってください（自由入力でもOK）',
        getRevisionQuickReplies(revisionCategory)
      );
    }

    // H4: 3案が未選択の場合はまず案を選ぶよう促す
    if (user.current_store_id) {
      const storeForCheck = await getStore(user.current_store_id);
      if (storeForCheck) {
        const { data: checkPost } = await supabase
          .from('post_history')
          .select('content')
          .eq('store_id', storeForCheck.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (checkPost?.content && /\[\s*案A[：:]/.test(checkPost.content)) {
          return await replyText(replyToken, '先にA / B / C のいずれかを選んでから修正指示を送ってください✉️');
        }
      }
    }
    return await handleFeedback(user, feedback, replyToken);
  }

  // 統合学習: 「学習:」で始まる（修正指示 or スタイル記憶をAIが自動判定）
  if (trimmed.startsWith('学習:')) {
    const instruction = trimmed.replace(/^学習[:：]\s*/, '');

    // 内容が空 = 「学習」ボタンが押された → 入力待ちモードへ
    if (!instruction.trim()) {
      try {
        await setPendingCommand(user.id, 'revision');
      } catch (e) {
        return await replyText(replyToken, '⚠️ 状態の保存に失敗しました。「学習: もっとカジュアルに」の形で送ってください。');
      }
      // カテゴリーに応じたクイックリプライ選択肢を取得
      let revisionCategory = null;
      if (user.current_store_id) {
        try {
          const storeForCategory = await getStore(user.current_store_id);
          revisionCategory = storeForCategory?.category ?? null;
        } catch (_) { /* 取得失敗時はデフォルト選択肢を使用 */ }
      }
      return await replyWithQuickReply(
        replyToken,
        '📝 どう変えたいか教えてください\n\n例）もっとカジュアルに、短く、敬語で\n→ 今の投稿を修正＋今後にも反映します',
        getRevisionQuickReplies(revisionCategory)
      );
    }

    // 最新投稿がある → 修正生成＋diff学習（handleFeedback）
    // 最新投稿がない → スタイル記憶のみ（handleStyleLearning）
    if (user.current_store_id) {
      const storeForCheck = await getStore(user.current_store_id);
      if (storeForCheck) {
        const { data: checkPost } = await supabase
          .from('post_history')
          .select('content')
          .eq('store_id', storeForCheck.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        // 3案が未選択なら先に案を選んでもらう
        if (checkPost?.content && /\[\s*案A[：:]/.test(checkPost.content)) {
          return await replyText(replyToken, '先にA / B / C のいずれかを選んでから教えてください✉️');
        }
        // 最新投稿がある → 修正＋学習
        if (checkPost?.content) {
          return await handleFeedback(user, instruction, replyToken);
        }
      }
    }
    // 最新投稿がない → スタイル記憶のみ
    return await handleStyleLearning(user, instruction, replyToken);
  }

  // エンゲージメント報告: 「報告:」で始まる
  if (trimmed.startsWith('報告:')) {
    // H5: 3案が未選択の場合はまず案を選ぶよう促す
    if (user.current_store_id) {
      const storeForCheck = await getStore(user.current_store_id);
      if (storeForCheck) {
        const { data: checkPost } = await supabase
          .from('post_history')
          .select('content')
          .eq('store_id', storeForCheck.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (checkPost?.content && /\[\s*案A[：:]/.test(checkPost.content)) {
          return await replyText(replyToken, '先にA / B / C のいずれかを選んでから報告してください✉️');
        }
      }
    }
    return await handleEngagementReport(user, trimmed, replyToken);
  }

  // 店舗切替: 「切替:」で始まる
  if (trimmed.startsWith('切替:')) {
    const storeName = trimmed.replace(/^切替[:：]\s*/, '');
    return await handleStoreSwitch(user, storeName, replyToken);
  }

  // プラン確認
  if (trimmed === 'プラン' || trimmed === '/plan') {
    return await handlePlanStatus(user, replyToken);
  }

  // アップグレード
  if (trimmed === 'アップグレード' || trimmed === '/upgrade') {
    return await handleUpgradePrompt(user, replyToken);
  }

  // 週間コンテンツ計画
  if (['今週の計画', '/weekly', '投稿ネタ', '投稿ネタ教えて', 'ネタ'].includes(trimmed)) {
    return await handleWeeklyPlan(user, replyToken);
  }

  // コマンド一覧
  if (trimmed === 'コマンド一覧' || trimmed === 'コマンド') {
    return await handleCommandList(user, replyToken);
  }

  // ヘルプ: 階層型メニュー
  if (trimmed === 'ヘルプ' || trimmed === 'help') {
    return await handleHelpMenu(user, replyToken);
  }

  // ヘルプカテゴリー選択: 数字またはカテゴリー名
  const helpHandled = await handleHelpCategory(user, trimmed, replyToken);
  if (helpHandled !== null) {
    return;
  }

  // 店舗一覧 / 店舗切り替え / 店舗切替
  if (['店舗一覧', '店舗切り替え', '店舗切替'].includes(trimmed)) {
    return await handleStoreList(user, replyToken);
  }

  // 店舗更新
  if (trimmed === '店舗更新') {
    return await handleStoreUpdatePrompt(user, replyToken);
  }

  // 店舗更新の実行: 「更新: name: 新店名」など
  if (trimmed.startsWith('更新:')) {
    const updateData = trimmed.replace(/^更新[:：]\s*/, '');
    return await handleStoreUpdate(user, updateData, replyToken);
  }

  // 文章量設定: 「長さ: short」など
  if (trimmed.startsWith('長さ:')) {
    const length = trimmed.replace(/^長さ[:：]\s*/, '');
    return await handlePostLength(user, length, replyToken);
  }

  // テンプレート登録の説明表示
  if (
    trimmed === 'テンプレート登録' ||
    trimmed === 'テンプレ登録' ||
    trimmed === 'テンプレ登録したい' ||
    trimmed === 'テンプレート登録したい' ||
    trimmed === 'テンプレート設定' ||
    trimmed === 'テンプレ設定'
  ) {
    return await handleTemplateHelp(user, replyToken);
  }

  // テンプレート設定: 「テンプレート: address:住所」など
  if (trimmed.startsWith('テンプレート:') || trimmed.startsWith('テンプレ:')) {
    const templateData = trimmed.replace(/^(?:テンプレート|テンプレ)[:：]\s*/, '');
    // 「削除」系のワードが来た場合は削除プロンプトへ
    if (templateData === '削除' || templateData === '全削除' || templateData === 'all') {
      return await handleTemplateDeletePrompt(user, replyToken);
    }
    return await handleTemplate(user, templateData, replyToken);
  }

  // 設定確認（完全一致 + 前方一致で「表示して」などの変形にも対応）
  if (
    trimmed === 'テンプレート確認' || trimmed === '設定確認' ||
    trimmed === 'テンプレート表示' || trimmed === 'テンプレ表示' || trimmed === 'テンプレ確認' ||
    trimmed.startsWith('テンプレート表示') || trimmed.startsWith('テンプレ表示') ||
    trimmed.startsWith('テンプレート確認') || trimmed.startsWith('テンプレ確認')
  ) {
    return await handleShowSettings(user, replyToken);
  }

  // 学習状況（「学習」はhelpCategoryで先に捕捉されるため「学習状況」のみ有効）
  if (trimmed === '学習状況') {
    return await handleLearningStatus(user, replyToken);
  }

  // 問い合わせ
  if (trimmed === '問い合わせ') {
    const contactEmail = process.env.CONTACT_EMAIL;
    if (!contactEmail) {
      return await replyText(replyToken, '📩 お問い合わせ\n\n現在、お問い合わせ先が設定されていません。\n管理者にご連絡ください。');
    }
    return await replyText(replyToken, `📩 お問い合わせ

ご不明な点やご要望は、以下のメールアドレスまでお気軽にどうぞ！

${contactEmail}

件名に「AI店舗秘書について」と記載いただけると助かります。
通常2〜3営業日以内にご返信いたします。`);
  }

  // 季節提案
  if (trimmed === '季節提案' || trimmed === '季節記憶' || trimmed === '今月のヒント') {
    return await handleSeasonalMemory(user, replyToken);
  }

  // データ確認
  if (trimmed === 'データ確認' || trimmed === '集合知' || trimmed === 'データ') {
    return await handleDataStats(user, replyToken);
  }

  // データリセット（確認）
  if (trimmed === 'データリセット' || trimmed === 'リセット' || trimmed === '学習リセット') {
    console.log(`[TextHandler] Data reset matched! Calling handleDataResetPrompt`);
    return await handleDataResetPrompt(user, replyToken);
  }

  // データリセット実行
  if (trimmed === 'リセット実行') {
    return await handleDataResetExecution(user, replyToken);
  }

  // 店舗削除（確認）
  if (trimmed === '店舗削除') {
    return await handleStoreDeletePrompt(user, replyToken);
  }

  // 店舗削除実行
  if (trimmed === '店舗削除実行') {
    return await handleStoreDeleteExecution(user, replyToken);
  }

  // キャンセル（データリセット・店舗削除・入力待ち・カルーセル共通）
  if (trimmed === 'キャンセル' || trimmed === 'cancel') {
    if (user.pending_command) await clearPendingCommand(user.id);
    if (user.pending_image_context?.carousel_mode || user.pending_image_context?.stock_mode) {
      await clearPendingImageContext(user.id);
    }
    return await replyText(replyToken, 'キャンセルしました！');
  }

  // キャラクター設定
  if (trimmed === 'キャラ設定' || trimmed === 'キャラクター設定') {
    return await handleCharacterSettingsPrompt(user, replyToken);
  }

  // キャラクター設定の入力（「口癖:」から始まる）
  if (trimmed.startsWith('口癖:')) {
    return await handleCharacterSettingsSave(user, trimmed, replyToken);
  }

  // Instagram連携（日本語コマンド → /instagram connect へ転送）
  if (trimmed === 'instagram連携' || trimmed === 'インスタ連携' || trimmed === 'インスタグラム連携') {
    return await handleInstagramCommand(user, 'connect', replyToken);
  }

  // Instagram連携解除（日本語コマンド → /instagram disconnect へ転送）
  if (trimmed === 'instagram連携解除' || trimmed === 'インスタ連携解除' || trimmed === 'インスタ解除') {
    return await handleInstagramCommand(user, 'disconnect', replyToken);
  }

  // Instagram投稿（クイックリプライから送信される）
  if (trimmed === 'instagram投稿') {
    const { handleInstagramCommand } = await import('./instagramHandler.js');
    return await handleInstagramCommand(user, 'post', replyToken);
  }

  // Instagram複数枚投稿（カルーセルモード開始）
  if (trimmed === '複数枚投稿') {
    const { handleCarouselStart } = await import('./instagramHandler.js');
    return await handleCarouselStart(user, replyToken);
  }

  // 予約投稿（A/B/C選択後のクイックリプライから）
  if (trimmed === '予約投稿') {
    const { handleDirectSchedulePrompt } = await import('./stockHandler.js');
    return await handleDirectSchedulePrompt(user, replyToken);
  }

  // ==================== 投稿ストック ====================

  // ストック保存（A/B/C選択後のクイックリプライから）
  if (trimmed === 'ストック保存') {
    const { handleStockSave } = await import('./stockHandler.js');
    return await handleStockSave(user, replyToken);
  }

  // ストック一覧
  if (trimmed === 'ストック') {
    const { handleStockList } = await import('./stockHandler.js');
    return await handleStockList(user, replyToken);
  }

  // ストック番号選択（ストック:1, ストック:2, etc.）
  if (trimmed.startsWith('ストック:')) {
    const rest = trimmed.replace('ストック:', '');
    const idx = parseInt(rest, 10);
    if (!isNaN(idx)) {
      const { handleStockAction } = await import('./stockHandler.js');
      return await handleStockAction(user, idx, replyToken);
    }
  }

  // ストックから即時投稿
  if (trimmed === 'ストック投稿') {
    const { handleStockPublish } = await import('./stockHandler.js');
    return await handleStockPublish(user, replyToken);
  }

  // ストック予約時間選択画面
  if (trimmed === 'ストック予約') {
    const { handleSchedulePrompt } = await import('./stockHandler.js');
    return await handleSchedulePrompt(user, replyToken);
  }

  // 予約時間確定（予約:ISOタイムスタンプ）
  if (trimmed.startsWith('予約:')) {
    const timeStr = trimmed.replace('予約:', '');
    const { handleScheduleConfirm } = await import('./stockHandler.js');
    return await handleScheduleConfirm(user, timeStr, replyToken);
  }

  // ストック削除
  if (trimmed === 'ストック削除') {
    const { handleStockDelete } = await import('./stockHandler.js');
    return await handleStockDelete(user, replyToken);
  }

  // ストック一括削除
  if (trimmed === 'ストック一括削除') {
    const { handleBatchDeletePrompt } = await import('./stockHandler.js');
    return await handleBatchDeletePrompt(user, replyToken);
  }

  // モード切替（AI投稿 ↔ そのまま投稿）
  if (trimmed === 'モード切替' || trimmed === 'モード切り替え') {
    return await handlePostModeSwitch(user, replyToken);
  }
  // 「そのまま投稿」単体で聞かれたら説明+切替ボタン
  if (trimmed === 'そのまま投稿') {
    return await replyWithQuickReply(
      replyToken,
      '📷 そのまま投稿モードとは？\n\nAIを使わず、写真＋自分で書いたテキストをそのままInstagramに投稿できるモードです。\n\n使い方:\n1.「モード切替」→「📷 そのまま投稿」を選択\n2. 写真を送る\n3. テキストを入力 → そのまま投稿\n\n※ Standard プラン以上 + Instagram連携が必要です',
      [
        { type: 'action', action: { type: 'message', label: '🔄 モード切替', text: 'モード切替' } },
      ]
    );
  }
  if (trimmed === 'AI投稿モード') {
    return await handlePostModeSet(user, 'ai', replyToken);
  }
  if (trimmed === 'そのまま投稿モード') {
    return await handlePostModeSet(user, 'direct', replyToken);
  }

  // direct_mode投稿実行
  if (trimmed === 'direct投稿実行') {
    return await handleDirectPostExecute(user, replyToken);
  }

  // direct_mode複数枚投稿（カルーセル開始）
  if (trimmed === 'direct複数枚投稿') {
    return await handleDirectCarouselStart(user, replyToken);
  }

  // M1: 案選択: A, B, C, 案A, 案B, 案C, a, b, c, 1, 2, 3, 全角Ａ/Ｂ/Ｃ/１/２/３
  if (/^(案?[ABCabc１２３ＡＢＣａｂｃ]|[1-3])$/i.test(trimmed)) {
    if (user.current_store_id) {
      const store = await getStore(user.current_store_id);
      if (store) {
        const { data: latestPost } = await supabase
          .from('post_history')
          .select('*')
          .eq('store_id', store.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        // M2: 直近の投稿が3案フォーマットの場合のみ処理（柔軟なマーカー検出）
        if (latestPost?.content && /\[\s*案A[：:]/.test(latestPost.content)) {
          const { handleProposalSelection } = await import('./proposalHandler.js');
          return await handleProposalSelection(user, store, latestPost, trimmed, replyToken);
        }
      }
    }
  }

  // 🔄 別案（再生成）
  if (trimmed === '別案' || trimmed === '別の案' || trimmed === '別案を見る') {
    if (user.current_store_id) {
      const store = await getStore(user.current_store_id);
      if (store) {
        // 生成回数チェック
        const genLimit = await checkGenerationLimit(user.id);
        if (!genLimit.allowed) {
          return await replyText(replyToken, `⚠️ 今月の生成上限（${genLimit.limit}回）に達しました。\n「アップグレード」で上限を増やすことができます。`);
        }

        // pending_image_context から前回の素材を取得（TTLチェック付き）
        const ctx = user.pending_image_context;
        const { isContextValid } = await import('./imageHandler.js');
        if (!ctx || !ctx.imageDescription || ctx.analysisStatus === 'pending' || ctx.analysisStatus === 'generating' || !isContextValid(ctx)) {
          // 旧3案投稿の場合はフォールバック
          const { data: latestPost } = await supabase
            .from('post_history')
            .select('*')
            .eq('store_id', store.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (latestPost?.content && /\[\s*案B[：:]/.test(latestPost.content)) {
            const { handleShowAlternatives } = await import('./proposalHandler.js');
            return await handleShowAlternatives(user, store, latestPost, replyToken);
          }
          return await replyText(replyToken, '写真を送ってからお試しください');
        }

        await replyText(replyToken, '別の案を考えています...');

        // バックグラウンドで再生成
        const { regenerateBody } = await import('./imageHandler.js');
        regenerateBody(user, store, ctx, user.line_user_id).catch(e =>
          console.error('[TextHandler] 別案再生成エラー:', e.message));
        return;
      }
    }
  }

  // ✅ これで決定
  if (trimmed === 'これで決定') {
    if (user.current_store_id) {
      const store = await getStore(user.current_store_id);
      if (store) {
        const latestPost = await getLatestPost(store.id);
        if (!latestPost) {
          return await replyText(replyToken, 'まだ投稿がありません。写真を送ってみてください！');
        }

        // テンプレートフッター（住所・営業時間）を適用
        const finalContent = appendTemplateFooter(latestPost.content, store);
        if (finalContent !== latestPost.content) {
          const { updatePostContent } = await import('../services/supabaseService.js');
          await updatePostContent(latestPost.id, finalContent);
        }

        // Instagram連携チェック
        const { getInstagramAccount } = await import('../services/instagramService.js');
        const igAccount = await getInstagramAccount(store.id).catch(() => null);
        const hasImageUrl = !!latestPost.image_url;

        if (igAccount && hasImageUrl) {
          return await replyWithQuickReply(replyToken,
            '✅ 投稿が確定しました！\n\nInstagramに投稿しますか？',
            [
              { type: 'action', action: { type: 'message', label: '📸 Instagram投稿', text: 'instagram投稿' } },
              { type: 'action', action: { type: 'message', label: '📋 コピーして使う', text: 'コピー' } },
            ]
          );
        }

        return await replyText(replyToken, '✅ 投稿が確定しました！\n\n上のテキストをコピーしてSNSに貼り付けてください📋');
      }
    }
  }

  // 📋 コピーして使う（投稿テキストをコピーしやすい形で返す）
  if (trimmed === 'コピー') {
    if (user.current_store_id) {
      const store = await getStore(user.current_store_id);
      if (store) {
        const latestPost = await getLatestPost(store.id);
        if (latestPost) {
          // Photo Advice（━━━区切り以降）を除外して本文+ハッシュタグのみ
          const caption = latestPost.content.split(/\n━{3,}/)[0].trim();
          return await replyText(replyToken, `📋 コピーしてお使いください👇\n\n${caption}`);
        }
      }
    }
    return await replyText(replyToken, 'まだ投稿がありません。写真を送ってみてください！');
  }

  // 👍 良い評価
  if (trimmed === '👍') {
    return await handlePositiveFeedback(user, replyToken);
  }

  // 👎 イマイチ評価
  if (trimmed === '👎') {
    return await handleNegativeFeedback(user, replyToken);
  }

  // テンプレート削除（対話開始）
  if (
    trimmed === 'テンプレート削除' ||
    trimmed === 'テンプレ削除' ||
    trimmed === 'テンプレート:削除' ||
    trimmed === 'テンプレート：削除' ||
    trimmed === 'テンプレ:削除' ||
    trimmed === 'テンプレ：削除'
  ) {
    return await handleTemplateDeletePrompt(user, replyToken);
  }

  // テンプレート削除の実行: 「削除: address」など
  if (trimmed.startsWith('削除:')) {
    const fieldToDelete = trimmed.replace(/^削除[:：]\s*/, '');
    return await handleTemplateDelete(user, fieldToDelete, replyToken);
  }

  // リマインダー停止
  if (trimmed === 'リマインダー停止' || trimmed === 'リマインダー無効') {
    return await handleDisableReminder(user, replyToken);
  }

  // 投稿番号選択（pending_reportがある場合）
  // ★ pending_follower_request より先にチェック：
  //    pending_report中に数字がフォロワー数と誤解釈されるのを防止
  const postSelectionHandled = await handlePostSelection(user, trimmed, replyToken);
  if (postSelectionHandled) {
    return; // 処理完了
  }

  // pending_follower_request がある場合、数字のみの入力もフォロワー数として処理
  const numericMatch = trimmed.match(/^(\d+)$/);
  if (numericMatch) {
    const pendingRequest = await getPendingFollowerRequest(user.id, user.current_store_id);
    if (pendingRequest) {
      const followerCount = parseInt(numericMatch[1], 10);
      return await handleFollowerCountResponse(user, followerCount, replyToken);
    }
  }

  // リマインダー再開
  if (trimmed === 'リマインダー再開' || trimmed === 'リマインダー有効') {
    return await handleEnableReminder(user, replyToken);
  }

  // 個別文章量指定: 「超短文で: 新商品のケーキ」
  const lengthMatch = trimmed.match(/^(超短文|短文|中文|長文)で[:：]\s*(.+)/);
  if (lengthMatch) {
    const lengthMap = { '超短文': 'xshort', '短文': 'short', '中文': 'medium', '長文': 'long' };
    const length = lengthMap[lengthMatch[1]];
    const content = lengthMatch[2];
    return await handleTextPostGenerationWithLength(user, content, replyToken, length);
  }

  // ========== 意図分類ルーティング ==========
  // 明示コマンドに一致しなかったメッセージの意図をAIで分類
  if (user.current_store_id) {
    const intentStore = await getStore(user.current_store_id);
    if (intentStore) {
      const latestPost = await getLatestPost(intentStore.id);

      if (latestPost) {
        const hasProposals = /\[\s*案A[：:]/.test(latestPost.content);
        const intent = await classifyIntent(trimmed, {
          hasProposals,
          hasPost: true,
        });

        console.log(`[Intent] 分類結果: "${trimmed.slice(0, 30)}" → ${intent}`);

        if (intent === 'revision') {
          if (hasProposals) {
            return await replyText(replyToken, '先にA・B・Cのどれか選んでもらえますか？そのあと修正しますね');
          }
          return await handleFeedback(user, trimmed, replyToken);
        }

        if (intent === 'positive') {
          return await handlePositiveFeedback(user, replyToken);
        }

        if (intent === 'negative') {
          return await handleNegativeFeedback(user, replyToken);
        }

        if (intent.startsWith('select_') && hasProposals) {
          const selectionMap = { select_a: 'A', select_b: 'B', select_c: 'C' };
          const selection = selectionMap[intent];
          const { handleProposalSelection } = await import('./proposalHandler.js');
          return await handleProposalSelection(user, intentStore, latestPost, selection, replyToken);
        }

        // intent === 'conversation' → 通常会話フローへ
      }
    }
  }

  // ========== 自然な会話機能 ==========
  // テキストメッセージは全て会話として処理
  // 投稿生成は画像送信のみで行う

  // ユーザーメッセージを会話履歴に保存
  await saveConversation(user.id, 'user', trimmed);

  // 好み発言を検出して学習（「直し:」以外の自然な発言から）
  if (user.current_store_id) {
    const preferenceKeywords = [
      'もっと', 'もう少し', 'もうちょっと', 'もう少々',
      'カジュアル', '丁寧', 'フォーマル', '短く', '長く',
      '簡潔', '詳しく', '絵文字', 'emoji', 'テンポ',
      '明るく', '柔らかく', 'やわらかく', '硬く', 'かわいく',
      'シンプル', 'シック', 'ポップ', 'スタイリッシュ'
    ];
    const hasPreference = preferenceKeywords.some(kw => trimmed.includes(kw));
    if (hasPreference && trimmed.length > 5 && trimmed.length < 50) {
      // 重い分析は不要、基本学習（キーワードマッチ）だけ実行
      // S11修正: 空catchではなくエラーログを出力
      applyFeedbackToProfile(user.current_store_id, trimmed, '').catch(err => {
        console.warn('[TextHandler] 好み学習エラー（続行）:', err.message);
      });
    }
  }

  // M10修正: cleanOldConversationsを毎メッセージではなく確率的に実行
  // 約10回に1回のみ実行（毎回SELECTクエリが走るのを防止）
  if (Math.random() < 0.1) {
    await cleanOldConversations(user.id, 40);
  }

  // 自然な会話で応答
  const store = user.current_store_id ? await getStore(user.current_store_id) : null;
  const conversationHistory = await getRecentConversations(user.id, 10);

  const aiResponse = await generateConversationalResponse(user, store, trimmed, conversationHistory);

  // AI応答を会話履歴に保存
  await saveConversation(user.id, 'assistant', aiResponse);

  return await replyText(replyToken, aiResponse);
}

// ==================== 店舗登録 ====================

async function handleStoreRegistration(user, text, replyToken) {
  const input = text.replace(/^1[:：]\s*/, '');

  try {
    // Claude で入力テキストを解析
    const prompt = buildStoreParsePrompt(input);
    const jsonStr = await askClaude(prompt);

    let storeData;
    try {
      storeData = JSON.parse(jsonStr);
    } catch {
      return await replyText(replyToken,
        '入力の解析に失敗しました。\n\n以下の形式で送ってください:\n1: 業種,店名,こだわり,口調\n\n例: 1: ベーカリー,幸福堂,天然酵母の手作りパン,フレンドリー'
      );
    }

    // DB に保存
    const store = await createStore(user.id, storeData);
    await updateCurrentStore(user.id, store.id);

    console.log(`[Store] 登録完了: category=${store.category} id=${store.id?.slice(0, 4)}…`);
    await replyText(replyToken,
      `✅ 店舗「${store.name}」を登録しました！\n\n業種: ${store.category || '未設定'}\nこだわり: ${store.strength}\n口調: ${store.tone}\n\nこの店舗が選択中です。画像やテキストを送ると投稿案を作成します。`
    );
  } catch (err) {
    console.error('[Store] 登録エラー:', err);
    await replyText(replyToken, '店舗登録中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== 店舗切替 ====================

async function handleStoreSwitch(user, storeName, replyToken) {
  try {
    const stores = await getStoresByUser(user.id);

    if (stores.length === 0) {
      return await replyText(replyToken, '店舗がまだ登録されていません。\n\n1: 業種,店名,こだわり,口調\n\nの形式で登録してください。');
    }

    // S13修正: 完全一致を優先し、部分一致はフォールバック（曖昧マッチ防止）
    const target = stores.find(s => s.name === storeName)
      || stores.find(s => s.name.includes(storeName));

    if (!target) {
      const list = stores.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
      return await replyText(replyToken, `「${storeName}」が見つかりません。\n\n登録済み店舗:\n${list}\n\n切替: 店舗名 で切り替えてください。`);
    }

    await updateCurrentStore(user.id, target.id);
    await replyText(replyToken, `「${target.name}」に切り替えました！`);
  } catch (err) {
    console.error('[Store] 切替エラー:', err);
    await replyText(replyToken, '店舗切替中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== 店舗一覧 ====================

async function handleStoreList(user, replyToken) {
  try {
    const stores = await getStoresByUser(user.id);

    if (stores.length === 0) {
      return await replyText(replyToken, '店舗がまだ登録されていません。\n\n1: 業種,店名,こだわり,口調\n\nの形式で登録してください。');
    }

    const list = stores.map((s, i) => {
      const current = s.id === user.current_store_id ? ' ← 選択中' : '';
      return `${i + 1}. ${s.name}${current}`;
    }).join('\n');

    // 選択中以外の店舗をクイックリプライボタンにする（最大12個、LINE制限13 - 削除ボタン1）
    const switchButtons = stores
      .filter(s => s.id !== user.current_store_id)
      .slice(0, 12)
      .map(s => ({
        type: 'action',
        action: { type: 'message', label: s.name.slice(0, 20), text: `切替:${s.name}` },
      }));

    // 削除ボタンを末尾に追加（選択中の店舗を削除）
    if (user.current_store_id) {
      switchButtons.push({
        type: 'action',
        action: { type: 'message', label: '🗑 選択中を削除', text: '店舗削除' },
      });
    }

    if (switchButtons.length > 0) {
      await replyWithQuickReply(replyToken, `登録済みの店舗です👇\n${list}`, switchButtons);
    } else {
      await replyText(replyToken, `登録済みの店舗です👇\n${list}`);
    }
  } catch (err) {
    console.error('[Store] 一覧エラー:', err.message);
    await replyText(replyToken, 'エラーが発生しました。');
  }
}

// ==================== 店舗更新プロンプト ====================

async function handleStoreUpdatePrompt(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '選択中の店舗が見つかりません。');
    }

    const isInfluencer = store.category === 'インフルエンサー';
    const settingsDisplay = isInfluencer
      ? `【ジャンル】${store.name}\n【業種】${store.category}`
      : `【店舗名】${store.name}\n【業種】${store.category || '未設定'}\n【こだわり・強み】${store.strength}\n【口調】${store.tone}`;
    const message = `📝 現在の店舗設定

${settingsDisplay}

何を変更しますか？
以下の形式で送信してください：

更新: ${isInfluencer ? 'ジャンル' : '店名'}: ${isInfluencer ? '新しいジャンル' : '新しい店名'}
更新: 業種: カフェ
${isInfluencer ? '' : '更新: こだわり: 新しいこだわり'}
更新: 口調: フレンドリー

または複数同時に：
更新: 店名: 新店名, 業種: ネイルサロン, 口調: カジュアル`;

    await replyText(replyToken, message);
  } catch (err) {
    console.error('[Store] 更新プロンプトエラー:', err.message);
    await replyText(replyToken, 'エラーが発生しました。');
  }
}

// ==================== 店舗更新実行 ====================

async function handleStoreUpdate(user, updateData, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '選択中の店舗が見つかりません。');
    }

    // Parse: "店名: 新店名, こだわり: 新しいこだわり, 口調: カジュアル"
    // 全角コンマ「，」と日本語の読点「、」も区切り文字として許容
    const pairs = updateData.split(/[,，、]/).map(p => p.trim());
    const updates = {};

    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex === -1) continue;

      const key = pair.slice(0, colonIndex).trim();
      const value = pair.slice(colonIndex + 1).trim();

      // 日本語キーと英語キー両方に対応
      if (key === '店名' || key === 'name') {
        updates.name = value;
      } else if (key === 'こだわり' || key === 'strength') {
        updates.strength = value;
      } else if (key === '業種' || key === 'category') {
        // カテゴリー名を正規化（表記ゆれ吸収）
        updates.category = normalizeCategory(value) || value;
      } else if (key === '口調' || key === 'tone') {
        const validTones = ['カジュアル', 'フレンドリー', '丁寧', 'friendly', 'professional', 'casual'];
        if (validTones.includes(value)) {
          updates.tone = value;
        } else {
          return await replyText(replyToken,
            `口調は以下のいずれかを指定してください:\nカジュアル / フレンドリー / 丁寧`
          );
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return await replyText(replyToken,
        '更新する内容を指定してください。\n\n例:\n更新: 店名: 新店名\n更新: 業種: カフェ\n更新: こだわり: 新しいこだわり\n更新: 口調: カジュアル'
      );
    }

    // L7修正: allow-listフィルタ（将来の回帰防止）
    const ALLOWED_UPDATE_FIELDS = ['name', 'category', 'strength', 'tone'];
    const safeUpdates = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key];
    }

    // データベース更新
    const { error } = await supabase
      .from('stores')
      .update({
        ...safeUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', store.id);

    if (error) throw new Error(`更新失敗: ${error.message}`);

    // 更新内容を確認
    const summary = [];
    if (updates.name) summary.push(`店舗名: ${updates.name}`);
    if (updates.category) summary.push(`業種: ${updates.category}`);
    if (updates.strength) summary.push(`こだわり: ${updates.strength}`);
    if (updates.tone) summary.push(`口調: ${updates.tone}`);

    console.log(`[Store] 更新完了: ${store.name} → ${summary.join(', ')}`);
    await replyText(replyToken, `更新しました！\n\n${summary.join('\n')}`);
  } catch (err) {
    console.error('[Store] 更新エラー:', err);
    await replyText(replyToken, '更新中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== 文章量設定 ====================

async function handlePostLength(user, lengthParam, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const validLengths = Object.keys(POST_LENGTH_MAP);

    if (!validLengths.includes(lengthParam)) {
      return await replyText(replyToken,
        `長さ指定は以下のいずれかで入力してください:\n\n長さ: 超短文 (30文字以内)\n長さ: 短文 (100-150文字)\n長さ: 中文 (200-300文字)\n長さ: 長文 (400-500文字)`
      );
    }

    const newConfig = {
      ...(store.config || {}),
      post_length: lengthParam
    };

    await updateStoreConfig(store.id, newConfig);

    const lengthInfo = POST_LENGTH_MAP[lengthParam];
    await replyText(replyToken,
      `次から「${lengthInfo.description}（${lengthInfo.range}）」で書きますね！`
    );
  } catch (err) {
    console.error('[Settings] 長さ設定エラー:', err);
    await replyText(replyToken, '設定中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== テンプレート登録ヘルプ ====================

async function handleTemplateHelp(user, replyToken) {
  const message = `📋 テンプレート登録の使い方

投稿の末尾に毎回自動で追加する情報を登録できます。

【登録方法】
テンプレート: 住所:〇〇,営業時間:〇〇

【具体例】
テンプレート: 住所:東京都渋谷区神南1-1-1,営業時間:10:00〜20:00

【住所・営業時間以外も登録可】
テンプレート: 電話:03-1234-5678,予約:完全予約制,駐車場:あり

【複数まとめて登録】
テンプレート: 住所:大阪市中央区〇〇,営業時間:11:00〜19:00,電話:06-1234-5678

【ハッシュタグを固定登録】
毎回必ず使いたいタグをあらかじめ登録できます。
テンプレート: #カフェ #コーヒー #おうちカフェ

※ 登録したタグが最初に使われ、
　その後に内容に合うタグ・業種タグが追加されます

━━━━━━━━━━━
登録後は投稿のたびに自動で反映されます。

「設定確認」→ 現在のテンプレートを確認
「テンプレート削除」→ テンプレートを削除`;

  await replyText(replyToken, message);
}

// ==================== テンプレート設定 ====================

async function handleTemplate(user, templateData, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);

    // 既存のテンプレートをコピー（住所・営業時間など既存データを保持するため）
    const existingTemplates = store.config?.templates || {};
    const templates = {
      ...existingTemplates,
      custom_fields: { ...(existingTemplates.custom_fields || {}) },
    };

    // 「テンプレート: #カフェ #コーヒー」のように#で始まる場合はそのままハッシュタグとして登録
    if (templateData.trim().startsWith('#')) {
      templates.hashtags = templateData.trim().split(/\s+/).filter(t => t.startsWith('#'));
      const newConfig = {
        ...(store.config || {}),
        templates,
      };
      await updateStoreConfig(store.id, newConfig);
      await replyText(replyToken,
        `ハッシュタグ登録しました！\n\n${templates.hashtags.join(' ')}`
      );
      return;
    }

    // ハッシュタグだけ先に正規表現で抽出（#タグにスペースが含まれるため）
    const hashtagMatch = templateData.match(/(?:ハッシュタグ|hashtag|タグ)\s*[:：]\s*((?:#\S+\s*)+)/i);
    if (hashtagMatch) {
      const rawTags = hashtagMatch[1].trim();
      templates.hashtags = rawTags.split(/\s+/).filter(t => t.startsWith('#'));
    }

    // ハッシュタグ部分を除外してから残りをパース
    const dataWithoutHashtag = templateData
      .replace(/(?:ハッシュタグ|hashtag|タグ)\s*[:：]\s*(?:#\S+\s*)*/gi, '')
      .replace(/,\s*,/g, ',')
      .replace(/^,|,$/g, '')
      .trim();

    const pairs = dataWithoutHashtag ? dataWithoutHashtag.split(',').map(p => p.trim()).filter(p => p) : [];

    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex === -1) continue;

      const key = pair.slice(0, colonIndex).trim();
      const value = pair.slice(colonIndex + 1).trim();

      if (key === '住所') {
        templates.住所 = value;
      } else if (key === '営業時間') {
        templates.営業時間 = value;
      } else if (key) {
        templates.custom_fields[key] = value;
      }
    }

    // updateStoreConfigで直接保存（updateStoreTemplatesの二重マージを避ける）
    const newConfig = {
      ...(store.config || {}),
      templates,
    };
    await updateStoreConfig(store.id, newConfig);

    const summary = [];
    if (templates.住所) summary.push(`住所: ${templates.住所}`);
    if (templates.営業時間) summary.push(`営業時間: ${templates.営業時間}`);
    if (templates.hashtags?.length > 0) summary.push(`ハッシュタグ: ${templates.hashtags.join(' ')}`);
    if (Object.keys(templates.custom_fields).length > 0) {
      Object.entries(templates.custom_fields).forEach(([k, v]) => {
        summary.push(`${k}: ${v}`);
      });
    }

    await replyText(replyToken,
      `テンプレート登録しました！\n\n${summary.join('\n')}\n\n投稿のたびに自動で反映されます`
    );
  } catch (err) {
    console.error('[Template] 更新エラー:', err);
    await replyText(replyToken, '更新中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== 設定確認 ====================

async function handleShowSettings(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const config = store.config || {};
    const lengthInfo = POST_LENGTH_MAP[config.post_length || 'medium'];

    const isInfluencer = store.category === 'インフルエンサー';
    let message = isInfluencer
      ? `📋 現在の設定\n\n【ジャンル】${store.name}\n【業種】${store.category}\n【投稿長】${lengthInfo.description} (${lengthInfo.range})\n`
      : `📋 現在の設定\n\n【店舗名】${store.name}\n【業種】${store.category || '未設定'}\n【こだわり】${store.strength || '未設定'}\n【口調】${store.tone || '未設定'}\n【投稿長】${lengthInfo.description} (${lengthInfo.range})\n`;

    const templates = config.templates || {};
    if (templates.住所 || templates.営業時間 || templates.hashtags?.length > 0 || Object.keys(templates.custom_fields || {}).length > 0) {
      message += '\n【テンプレート】\n';
      if (templates.住所) message += `住所: ${templates.住所}\n`;
      if (templates.営業時間) message += `営業時間: ${templates.営業時間}\n`;
      if (templates.hashtags?.length > 0) message += `ハッシュタグ: ${templates.hashtags.join(' ')}\n`;
      Object.entries(templates.custom_fields || {}).forEach(([k, v]) => {
        message += `${k}: ${v}\n`;
      });
    } else {
      message += '\n【テンプレート】未設定\n（「テンプレート: 住所:〇〇,営業時間:〇〇」で登録できます）';
    }

    const character = config.character_settings;
    if (character && (character.catchphrases?.length > 0 || character.ng_words?.length > 0 || character.personality)) {
      message += '\n\n【キャラクター設定】\n';
      if (character.catchphrases?.length > 0) message += `口癖: ${character.catchphrases.join('、')}\n`;
      if (character.ng_words?.length > 0) message += `NGワード: ${character.ng_words.join('、')}\n`;
      if (character.personality) message += `個性: ${character.personality}\n`;
    } else {
      message += '\n\n【キャラクター設定】未設定\n（「キャラ設定」で設定できます）';
    }

    await replyText(replyToken, message);
  } catch (err) {
    console.error('[Settings] 確認エラー:', err);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== 個別文章量指定での投稿生成 ====================

async function handleTextPostGenerationWithLength(user, text, replyToken, lengthOverride) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    // 生成回数チェック（SUBSCRIPTION_ENABLED=true 時のみ有効）
    const genLimit = await checkGenerationLimit(user.id);
    if (!genLimit.allowed) {
      return await replyText(replyToken,
        `⚠️ 今月の生成上限（${genLimit.limit}回）に達しました。\n\n現在: ${genLimit.used}回 / ${genLimit.limit}回\n\n「アップグレード」で上限を増やすことができます。\n\n次月（1日）にリセットされます。`
      );
    }

    const store = await getStore(user.current_store_id);

    // 集合知を取得（カテゴリーが設定されている場合のみ）
    let blendedInsights = null;
    if (store.category) {
      blendedInsights = await getBlendedInsights(store.id, store.category);
    }

    // プラン別機能チェック
    const [canAdvanced, canSeasonal] = await Promise.all([
      isFeatureEnabled(user.id, 'advancedPersonalization'),
      isFeatureEnabled(user.id, 'seasonalMemory'),
    ]);

    // パーソナライゼーション情報を取得（基本は全プラン、高度+季節記憶は有料のみ）
    const basicPersonalization = await getPersonalizationPromptAddition(store.id);
    const advancedPersonalization = canAdvanced ? await getAdvancedPersonalizationPrompt(store.id) : '';
    const seasonalMemory = canSeasonal ? await getSeasonalMemoryPromptAddition(store.id) : '';
    const personalization = basicPersonalization + advancedPersonalization + seasonalMemory;

    const globalRules = await getGlobalPromptRules();
    const prompt = buildTextPostPrompt(store, text, lengthOverride, blendedInsights, personalization, { globalRules });
    const rawContent = await askClaude(prompt);

    // テンプレートの住所・営業時間などを末尾に固定追記（AIにアレンジさせない）
    const postContent = appendTemplateFooter(rawContent, store);

    const savedPost = await savePostHistory(user.id, store.id, postContent);

    // エンゲージメントメトリクスを保存（初期値）
    if (store.category) {
      await saveEngagementMetrics(store.id, store.category, {
        post_id: savedPost.id,
        content: postContent,
      });
    }

    console.log(`[Post] テキスト投稿生成完了 (length=${lengthOverride}): store=${store.name}`);

    // コピペしやすい形式でフォーマット
    const revisionExample = getRevisionExample(store.category);
    // 残り回数通知（Free/Standardなど上限のあるプランのみ）
    const remaining = Number.isFinite(genLimit.limit) ? genLimit.limit - (genLimit.used + 1) : null;
    const remainingNote = remaining !== null ? `\n📊 今月の残り: ${remaining}回` : '';
    const formattedReply = `できました！そのままコピペでどうぞ👇
━━━━━━━━━━━
${postContent}
━━━━━━━━━━━

気になるところがあれば「学習: ${revisionExample}」で修正＋今後にも反映${remainingNote}`;

    await replyWithQuickReply(replyToken, formattedReply, [
      { type: 'action', action: { type: 'message', label: '👍 良い', text: '👍' } },
      { type: 'action', action: { type: 'message', label: '👎 イマイチ', text: '👎' } },
      { type: 'action', action: { type: 'message', label: '📝 学習', text: '学習:' } },
    ]);
  } catch (err) {
    console.error('[Post] 生成エラー:', err);
    await replyText(replyToken, '投稿生成中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== テンプレート削除プロンプト ====================

async function handleTemplateDeletePrompt(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const templates = store.config?.templates || {};

    // テンプレートがない場合
    if (!templates.住所 && !templates.営業時間 && !templates.hashtags?.length && !Object.keys(templates.custom_fields || {}).length) {
      return await replyText(replyToken, '削除できるテンプレートがありません。');
    }

    // 削除可能なフィールドをリスト化
    const fields = [];
    if (templates.住所) fields.push('住所');
    if (templates.営業時間) fields.push('営業時間');
    if (templates.hashtags?.length > 0) fields.push('ハッシュタグ');
    if (templates.custom_fields) {
      Object.keys(templates.custom_fields).forEach(key => {
        fields.push(`${key}`);
      });
    }

    const message = `🗑️ テンプレート削除

削除したいフィールドを選んでください：

【登録済みフィールド】
${fields.map((f, i) => `${i + 1}. ${f}`).join('\n')}

削除方法：
削除: 住所
削除: 営業時間
削除: カスタムフィールド名

全削除する場合：
削除: all`;

    await replyText(replyToken, message);
  } catch (err) {
    console.error('[Template] 削除プロンプトエラー:', err);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== テンプレート削除実行 ====================

async function handleTemplateDelete(user, fieldToDelete, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const templates = { ...(store.config?.templates || {}) };

    // 全削除
    if (fieldToDelete === 'all' || fieldToDelete === '全て') {
      const newConfig = {
        ...(store.config || {}),
        templates: {}
      };
      await updateStoreConfig(store.id, newConfig);
      return await replyText(replyToken, 'テンプレートをすべて削除しました！');
    }

    // 個別削除
    let deleted = false;
    const deletedFields = [];

    if (fieldToDelete === '住所' && templates.住所) {
      delete templates.住所;
      deleted = true;
      deletedFields.push('住所');
    }

    if (fieldToDelete === '営業時間' && templates.営業時間) {
      delete templates.営業時間;
      deleted = true;
      deletedFields.push('営業時間');
    }

    if ((fieldToDelete === 'ハッシュタグ' || fieldToDelete === 'タグ') && templates.hashtags?.length > 0) {
      delete templates.hashtags;
      deleted = true;
      deletedFields.push('ハッシュタグ');
    }

    // カスタムフィールド削除
    if (templates.custom_fields && templates.custom_fields[fieldToDelete]) {
      delete templates.custom_fields[fieldToDelete];
      deleted = true;
      deletedFields.push(fieldToDelete);

      // custom_fields が空になったら削除
      if (Object.keys(templates.custom_fields).length === 0) {
        delete templates.custom_fields;
      }
    }

    if (!deleted) {
      return await replyText(replyToken, `「${fieldToDelete}」というフィールドは見つかりませんでした。\n\n設定確認 でテンプレートを確認してください。`);
    }

    // 更新を保存
    const newConfig = {
      ...(store.config || {}),
      templates
    };
    await updateStoreConfig(store.id, newConfig);

    await replyText(replyToken, `${deletedFields.join('・')} を削除しました！`);
  } catch (err) {
    console.error('[Template] 削除エラー:', err);
    await replyText(replyToken, '削除中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== キャラクター設定 ====================

async function handleCharacterSettingsPrompt(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const character = store.config?.character_settings;

    let currentSettings = '（未設定）';
    if (character) {
      const parts = [];
      if (character.catchphrases?.length > 0) parts.push(`口癖: ${character.catchphrases.join('、')}`);
      if (character.ng_words?.length > 0) parts.push(`NGワード: ${character.ng_words.join('、')}`);
      if (character.personality) parts.push(`個性: ${character.personality}`);
      if (parts.length > 0) currentSettings = parts.join('\n');
    }

    const message = `🎭 キャラクター設定

【現在の設定】
${currentSettings}

━━━━━━━━━━━━━━━
【設定方法】以下の形式で送信してください:

口癖: やん、なぁ、めっちゃ
NGワード: ありがとうございます、させていただきます
個性: 関西弁でコーヒーへの情熱が強め

※ 設定しない項目は省略できます
※ 「口癖:」から始まる形式で送信してください`;

    await replyText(replyToken, message);
  } catch (err) {
    console.error('[Character] 設定プロンプトエラー:', err);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
  }
}

async function handleCharacterSettingsSave(user, text, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const parsed = {};

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      parsed[key] = value;
    }

    // S3+S12修正: キャラクター設定のサニタイズ＋制限
    // - 各項目の文字数・個数を制限（プロンプトインジェクション緩和）
    // - 改行を除去（プロンプト構造の破壊を防止）
    const MAX_CATCHPHRASES = 10;
    const MAX_NG_WORDS = 10;
    const MAX_WORD_LENGTH = 30;
    const MAX_PERSONALITY_LENGTH = 100;

    const sanitizeWord = (s) => s.trim().replace(/[\n\r]/g, '').slice(0, MAX_WORD_LENGTH);

    const rawCatchphrases = parsed['口癖']
      ? parsed['口癖'].split(/[、,，]/).map(sanitizeWord).filter(s => s)
      : (store.config?.character_settings?.catchphrases || []);
    const rawNgWords = parsed['NGワード']
      ? parsed['NGワード'].split(/[、,，]/).map(sanitizeWord).filter(s => s)
      : (store.config?.character_settings?.ng_words || []);
    const rawPersonality = (parsed['個性'] || store.config?.character_settings?.personality || '')
      .replace(/[\n\r]/g, ' ').slice(0, MAX_PERSONALITY_LENGTH);

    const character_settings = {
      catchphrases: rawCatchphrases.slice(0, MAX_CATCHPHRASES),
      ng_words: rawNgWords.slice(0, MAX_NG_WORDS),
      personality: rawPersonality,
    };

    const newConfig = {
      ...(store.config || {}),
      character_settings,
    };

    await updateStoreConfig(store.id, newConfig);

    const summary = [];
    if (character_settings.catchphrases.length > 0) summary.push(`口癖: ${character_settings.catchphrases.join('、')}`);
    if (character_settings.ng_words.length > 0) summary.push(`NGワード: ${character_settings.ng_words.join('、')}`);
    if (character_settings.personality) summary.push(`個性: ${character_settings.personality}`);

    await replyText(replyToken, `キャラ設定を覚えました！\n\n${summary.join('\n')}\n\n次の投稿から反映しますね`);
  } catch (err) {
    console.error('[Character] 設定保存エラー:', err);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== 季節記憶表示 ====================

async function handleSeasonalMemory(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const status = await getSeasonalMemoryStatus(user.current_store_id);
    await replyText(replyToken, status);
  } catch (err) {
    console.error('[SeasonalMemory] 表示エラー:', err);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== 学習状況表示 ====================

async function handleLearningStatus(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const status = await getLearningStatus(store.id, store.category);
    await replyText(replyToken, status);
  } catch (err) {
    console.error('[Learning] 学習状況取得エラー:', err);
    await replyText(replyToken, '学習状況の取得中にエラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// L1修正: 旧HELP_TEXT削除 — handleHelpMenu/handleHelpCategoryに移行済み

// ==================== 👍 良い評価のハンドラー ====================

async function handlePositiveFeedback(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const { data: latestPost } = await supabase
      .from('post_history')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestPost) {
      return await replyText(replyToken, 'まだ投稿がありません。');
    }

    // 👍 は interaction_count のみインクリメント（旧式プロファイル経由）
    await applyFeedbackToProfile(store.id, '👍 良い投稿として学習', latestPost.content);

    // 連続3回 👍 → 思想ログに追加（単発は追加しない）
    const { data: profile } = await supabase
      .from('learning_profiles')
      .select('profile_data')
      .eq('store_id', store.id)
      .single();
    const consecutivePositive = (profile?.profile_data?._consecutive_positive || 0) + 1;
    if (consecutivePositive >= 3) {
      await addSimpleBelief(store.id, '現在の文体バランスに満足している', 'positive');
      // カウントリセット
      await supabase.from('learning_profiles').update({
        profile_data: { ...profile.profile_data, _consecutive_positive: 0 },
      }).eq('store_id', store.id);
    } else if (profile) {
      await supabase.from('learning_profiles').update({
        profile_data: { ...profile.profile_data, _consecutive_positive: consecutivePositive },
      }).eq('store_id', store.id);
    }

    console.log(`[Feedback] 👍 良い評価: store=${store.name}`);
    await replyText(replyToken, '👍 了解です！この感じ、覚えておきますね');
  } catch (err) {
    console.error('[Feedback] 👍 処理エラー:', err);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== 👎 イマイチ評価のハンドラー ====================

async function handleNegativeFeedback(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  try {
    const store = await getStore(user.current_store_id);
    const { data: latestPost } = await supabase
      .from('post_history')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestPost) {
      return await replyText(replyToken, 'まだ投稿がありません。');
    }

    await applyFeedbackToProfile(store.id, '👎 イマイチな投稿として学習', latestPost.content);

    // 連続 👍 カウントをリセット
    const { data: profile } = await supabase
      .from('learning_profiles')
      .select('profile_data')
      .eq('store_id', store.id)
      .single();
    if (profile?.profile_data?._consecutive_positive) {
      await supabase.from('learning_profiles').update({
        profile_data: { ...profile.profile_data, _consecutive_positive: 0 },
      }).eq('store_id', store.id);
    }

    console.log(`[Feedback] 👎 イマイチ評価: store=${store.name}`);
    await replyText(replyToken, '👎 なるほど、ちょっと違いましたか。\n\n「学習: 〜」で教えてもらえると修正＋次からも反映します！');
  } catch (err) {
    console.error('[Feedback] 👎 処理エラー:', err);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== リマインダー停止 ====================

async function handleDisableReminder(user, replyToken) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ reminder_enabled: false })
      .eq('id', user.id);

    if (error) throw error;

    console.log(`[Reminder] リマインダー停止`);
    await replyText(replyToken, 'リマインダー止めました！再開したいときは「リマインダー再開」でどうぞ');
  } catch (err) {
    console.error('[Reminder] 停止エラー:', err);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== リマインダー再開 ====================

async function handleEnableReminder(user, replyToken) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ reminder_enabled: true })
      .eq('id', user.id);

    if (error) throw error;

    console.log(`[Reminder] リマインダー再開`);
    await replyText(replyToken, 'リマインダー再開しました！毎朝10時にお知らせしますね');
  } catch (err) {
    console.error('[Reminder] 再開エラー:', err);
    await replyText(replyToken, 'エラーが発生しました。しばらくしてから再度お試しください。');
  }
}

// ==================== モード切替（AI投稿 ↔ そのまま投稿） ====================

async function handlePostModeSwitch(user, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  const store = await getStore(user.current_store_id);
  const currentMode = store.config?.post_mode || 'ai';
  const modeLabel = currentMode === 'direct' ? 'そのまま投稿モード' : 'AI投稿モード';

  return await replyWithQuickReply(
    replyToken,
    `📋 投稿モード切替\n\n現在: ${modeLabel}\n\nどちらに切り替えますか？`,
    [
      { type: 'action', action: { type: 'message', label: '🤖 AI投稿', text: 'AI投稿モード' } },
      { type: 'action', action: { type: 'message', label: '📷 そのまま投稿', text: 'そのまま投稿モード' } },
    ]
  );
}

async function handlePostModeSet(user, mode, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, '店舗が選択されていません。');
  }

  // direct_modeはStandard以上（Instagram連携が前提）
  if (mode === 'direct') {
    const canInstagram = await isFeatureEnabled(user.id, 'instagramPost');
    if (!canInstagram) {
      return await replyText(replyToken, '⚠️ そのまま投稿モードはStandardプラン以上で利用できます。\n\n「アップグレード」で確認してみてください。');
    }

    // Instagram連携チェック
    const { getInstagramAccount } = await import('../services/instagramService.js');
    const igAccount = await getInstagramAccount(user.current_store_id);
    if (!igAccount) {
      return await replyText(replyToken, '⚠️ そのまま投稿モードにはInstagram連携が必要です。\n\n「インスタ連携」で連携してください。');
    }
  }

  await updateStorePostMode(user.current_store_id, mode);
  const label = mode === 'direct' ? 'そのまま投稿モード' : 'AI投稿モード';
  const desc = mode === 'direct'
    ? '写真＋テキストを送ると、テンプレートとハッシュタグを付けてそのまま投稿できます。'
    : '写真を送ると、AIが3案の投稿文を生成します。';

  return await replyText(replyToken, `✅ ${label}に切り替えました！\n\n${desc}`);
}

// ==================== direct_mode テキスト受信 → テンプレ結合 ====================

async function handleDirectModeText(user, text, replyToken) {
  const ctx = user.pending_image_context;
  if (!ctx?.direct_mode || !ctx.imageUrl) return false;

  try {
    const store = await getStore(ctx.storeId);
    if (!store) {
      await clearPendingImageContext(user.id);
      return await replyText(replyToken, '店舗が見つかりません。');
    }

    // 投稿テキストを組み立て: 冒頭テキスト + テンプレート + ハッシュタグ
    const templates = store.config?.templates || {};
    const parts = [text]; // 冒頭テキスト

    // テンプレート情報（住所・営業時間・カスタムフィールド）
    const infoLines = [];
    if (templates.住所) infoLines.push(`📍 ${templates.住所}`);
    if (templates.営業時間) infoLines.push(`🕐 ${templates.営業時間}`);
    Object.entries(templates.custom_fields || {}).forEach(([k, v]) => {
      infoLines.push(`${k}: ${v}`);
    });
    if (infoLines.length > 0) {
      parts.push(infoLines.join('\n'));
    }

    // ハッシュタグ
    if (templates.hashtags?.length > 0) {
      parts.push(templates.hashtags.join(' '));
    }

    const caption = parts.join('\n\n');

    // pending_image_context を更新（キャプション保存）
    await savePendingImageContext(user.id, {
      ...ctx,
      direct_caption: caption,
    });

    // プレビュー表示 + 確認ボタン
    return await replyWithQuickReply(
      replyToken,
      `📝 投稿プレビュー\n━━━━━━━━━━━\n${caption}\n━━━━━━━━━━━\n\nこの内容で投稿しますか？`,
      [
        { type: 'action', action: { type: 'message', label: '📸 投稿する', text: 'direct投稿実行' } },
        { type: 'action', action: { type: 'message', label: '📸 複数枚投稿', text: 'direct複数枚投稿' } },
        { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' } },
      ]
    );
  } catch (err) {
    console.error('[DirectMode] テキスト処理エラー:', err);
    await clearPendingImageContext(user.id);
    await replyText(replyToken, 'エラーが発生しました。もう一度お試しください。');
    return true;
  }
}

// ==================== direct_mode 投稿実行 ====================

async function handleDirectPostExecute(user, replyToken) {
  const ctx = user.pending_image_context;
  if (!ctx?.direct_mode || !ctx.direct_caption || !ctx.imageUrl) {
    return await replyText(replyToken, '投稿データがありません。写真を送り直してください。');
  }

  try {
    const { publishToInstagram } = await import('../services/instagramService.js');
    const store = await getStore(ctx.storeId);
    if (!store) {
      await clearPendingImageContext(user.id);
      return await replyText(replyToken, '店舗が見つかりません。');
    }

    // post_historyに保存（Instagram投稿の記録として）
    await savePostHistory(user.id, store.id, ctx.direct_caption, null, ctx.imageUrl);

    // Instagram投稿
    const result = await publishToInstagram(store.id, ctx.imageUrl, ctx.direct_caption);
    await clearPendingImageContext(user.id);

    return await replyText(replyToken, `✅ Instagramに投稿しました！\n\n投稿ID: ${result.id}`);
  } catch (err) {
    console.error('[DirectMode] 投稿エラー:', err);
    await clearPendingImageContext(user.id);
    return await replyText(replyToken, `⚠️ 投稿に失敗しました。\n\n${err.message}\n\nもう一度お試しください。`);
  }
}

// ==================== direct_mode 複数枚投稿（カルーセル開始） ====================

async function handleDirectCarouselStart(user, replyToken) {
  const ctx = user.pending_image_context;
  if (!ctx?.direct_mode || !ctx.direct_caption || !ctx.imageUrl) {
    return await replyText(replyToken, '投稿データがありません。写真を送り直してください。');
  }

  // カルーセルモードに切り替え（1枚目は既にある）
  await savePendingImageContext(user.id, {
    ...ctx,
    carousel_mode: true,
    images: [ctx.imageUrl],
  });

  return await replyWithQuickReply(
    replyToken,
    `📸 複数枚投稿モード\n\n1枚目は受け取り済みです。\n続けて画像を送ってください（最大10枚）。\n\n送り終わったら「完了」を押してください。`,
    [
      { type: 'action', action: { type: 'message', label: '✅ 完了', text: '完了' } },
      { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' } },
    ]
  );
}
