import { supabase } from './supabaseService.js';
import { askClaude } from './claudeService.js';

/**
 * 会話履歴を保存
 */
export async function saveConversation(userId, role, content) {
  try {
    await supabase.from('conversation_history').insert({
      user_id: userId,
      role, // 'user' または 'assistant'
      content,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Conversation] 履歴保存エラー:', err.message);
  }
}

/**
 * 直近の会話履歴を取得（最大10件）
 */
export async function getRecentConversations(userId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('conversation_history')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // 古い順に並び替え
    return data ? data.reverse() : [];
  } catch (err) {
    console.error('[Conversation] 履歴取得エラー:', err.message);
    return [];
  }
}

/**
 * 会話履歴をクリア（古い履歴を削除）
 */
export async function cleanOldConversations(userId, keepLast = 20) {
  try {
    const { data: conversations } = await supabase
      .from('conversation_history')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!conversations || conversations.length <= keepLast) {
      return; // 削除不要
    }

    const idsToDelete = conversations.slice(keepLast).map(c => c.id);

    await supabase
      .from('conversation_history')
      .delete()
      .in('id', idsToDelete);

    console.log(`[Conversation] 古い会話を削除: ${idsToDelete.length}件`);
  } catch (err) {
    console.error('[Conversation] クリーンアップエラー:', err.message);
  }
}

/**
 * コンテキスト情報を構築
 */
export async function buildContextForUser(user, store) {
  const context = [];

  // 店舗情報
  if (store) {
    context.push(`【店舗情報】
店名: ${store.name}
業種: ${store.category || '未設定'}
こだわり: ${store.strength || '未設定'}
口調: ${store.tone || '未設定'}`);
  }

  // 最近の投稿履歴（最大3件）
  if (store) {
    const { data: recentPosts } = await supabase
      .from('post_history')
      .select('content, created_at')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(3);

    if (recentPosts && recentPosts.length > 0) {
      context.push(`【最近の投稿】`);
      recentPosts.forEach((post, i) => {
        const date = new Date(post.created_at).toLocaleDateString('ja-JP');
        context.push(`${i + 1}. (${date}) ${post.content.slice(0, 50)}...`);
      });
    }
  }

  return context.join('\n\n');
}

/**
 * 自然な会話で応答を生成
 */
export async function generateConversationalResponse(user, store, userMessage, conversationHistory) {
  // コンテキストを構築
  const contextInfo = await buildContextForUser(user, store);

  // 会話履歴を整形
  const historyText = conversationHistory
    .map(h => `${h.role === 'user' ? 'ユーザー' : 'AI'}: ${h.content}`)
    .join('\n');

  const systemPrompt = `あなたはAI店舗秘書です。InstagramやX用の投稿文を自動生成するLINE Botとして、ユーザーをサポートします。

【あなたの役割】
- ユーザーの質問に答える
- 投稿生成をサポート
- 機能の使い方を説明
- 親しみやすく、わかりやすい対応

【利用可能な機能】
1. 投稿生成: 📸 画像を送信すると、InstagramやX用の投稿文を自動生成
   ※重要: テキストだけでは投稿生成できません。必ず画像を送ってください
2. 投稿修正: 「直し: もっとカジュアルに」で投稿を調整
3. フィードバック学習: 👍👎や「直し:」でAIが学習
4. エンゲージメント報告: 「報告: いいね120, 保存15, 投稿番号1」で実績を記録
5. 学習状況確認: 「学習状況」でAIの学習状態を確認
6. データリセット: 「データリセット」で投稿・学習データを削除
7. 店舗管理: 「店舗一覧」「切替: 店名」で複数店舗を管理
8. ヘルプ: 「ヘルプ」で詳しい使い方

【現在のユーザー情報】
${contextInfo}

【過去の会話】
${historyText || 'なし'}

【応答ルール】
- 自然で親しみやすい日本語で応答
- 質問には具体的に答える
- 投稿生成を依頼された場合は「📸 画像を送っていただければ、投稿文を作成しますよ！」と案内
- テキストだけでは投稿を作れないことを優しく説明
- コマンドの使い方を聞かれたら、具体例を示す
- 長文にならないよう、簡潔に（最大300文字程度）

ユーザーからの最新メッセージ:
"${userMessage}"

上記に対して、自然な会話で応答してください。`;

  try {
    const response = await askClaude(systemPrompt, {
      max_tokens: 500,
      temperature: 0.7,
    });

    return response;
  } catch (err) {
    console.error('[Conversation] 応答生成エラー:', err.message);
    return 'すみません、エラーが発生しました。もう一度お試しください。';
  }
}
