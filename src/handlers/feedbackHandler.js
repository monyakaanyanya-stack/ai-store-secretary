import { replyText, replyWithQuickReply } from '../services/lineService.js';
import {
  getStore,
  getLatestPost,
  saveLearningData,
  updatePostContent,
} from '../services/supabaseService.js';
import { getOrCreateLearningProfile } from '../services/personalizationEngine.js';
import {
  analyzeFeedbackWithClaude,
  updateAdvancedProfile,
  getProfileAndPrompt,
} from '../services/advancedPersonalization.js';
import { getInstagramAccount } from '../services/instagramService.js';

/**
 * 見本学習: ユーザーが自分で書き直したバージョンと AI 生成版を比較して学習
 * 「学習:〇〇」コマンドから呼ばれる
 */
export async function handleStyleLearning(user, userRewrite, replyToken) {
  if (!user.current_store_id) {
    return await replyText(replyToken, 'まだアカウントが登録されていないみたいです。「登録」で始められます！');
  }

  if (!userRewrite.trim()) {
    return await replyText(replyToken, '「学習:」の後に書き直した文章を入れてください！\n\n例: 学習: α7C来たよ！まじ持ちやすくてやばい💫');
  }

  try {
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, 'アカウントが見つかりません。「アカウント一覧」で確認してみてください');
    }

    const latestPost = await getLatestPost(store.id);
    if (!latestPost) {
      return await replyText(replyToken, 'まだ投稿がないみたいです。先に投稿案を作ってから送ってください！');
    }

    console.log(`[StyleLearning] 見本学習開始: store=${store.name}, len=${userRewrite.length}`);

    // AI生成版とユーザー書き直し版の差分を分析（統合モード: 指示集も同時更新）
    const { profileContext } = await getProfileAndPrompt(store.id);
    const analysis = await analyzeFeedbackWithClaude(
      'ユーザーが書き直したバージョンとAI生成版を比較し、ユーザーの好む文体・語尾・口癖・表現の特徴を抽出してください。',
      latestPost.content,
      userRewrite,
      profileContext
    );

    if (analysis) {
      await updateAdvancedProfile(store.id, analysis);
      console.log(`[StyleLearning] 見本学習完了: beliefs=${analysis.beliefs?.length || 0}件, persona=${analysis.persona_definition_next ? '統合更新' : 'フォールバック'}`);
    }

    await saveLearningData(
      store.id,
      'style_sample',
      latestPost.content,
      userRewrite,
      analysis || {}
    );

    // 書き直し文章で投稿内容を上書き（そのままInstagram投稿できるように）
    await updatePostContent(latestPost.id, userRewrite);

    const profile = await getOrCreateLearningProfile(store.id);
    const profileData = profile?.profile_data || {};
    const latestLearnings = profileData.latest_learnings || [];

    const learningList = latestLearnings.length > 0
      ? latestLearnings.map(l => `✅ ${l}`).join('\n')
      : '✅ 文体パターンを学習しました';

    const message = `見本から学習しました！

【学んだこと】
${learningList}
📚 ${profile.interaction_count}回目の学習`;

    // Quick Reply: IG連携済みなら投稿ボタン付き
    const igAccount = await getInstagramAccount(store.id).catch(() => null);
    const quickReplies = [];
    if (igAccount && latestPost.image_url) {
      quickReplies.push(
        { type: 'action', action: { type: 'message', label: '📸 Instagram投稿', text: 'instagram投稿' } },
        { type: 'action', action: { type: 'message', label: '📸 複数枚投稿', text: '複数枚投稿' } },
        { type: 'action', action: { type: 'message', label: '⏰ 予約投稿', text: '予約投稿' } },
      );
    }
    quickReplies.push(
      { type: 'action', action: { type: 'message', label: '💾 ストック', text: 'ストック保存' } },
      { type: 'action', action: { type: 'message', label: '🔄 別案', text: '別案' } },
    );
    await replyWithQuickReply(replyToken, message, quickReplies);
  } catch (err) {
    console.error('[StyleLearning] エラー:', err);
    await replyText(replyToken, 'うまくいきませんでした...もう一度試してみてください');
  }
}

