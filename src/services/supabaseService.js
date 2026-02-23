import { createClient } from '@supabase/supabase-js';
import { normalizeCategory } from '../config/categoryDictionary.js';

// RLS有効時はservice_roleキーを使用（anon keyではアクセス不可）
// Supabase Dashboard > Project Settings > API > service_role key
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// ==================== ユーザー ====================

export async function getOrCreateUser(lineUserId) {
  // 既存ユーザーを検索
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('line_user_id', lineUserId)
    .single();

  if (existing) return existing;

  // 新規作成
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ line_user_id: lineUserId })
    .select()
    .single();

  if (error) throw new Error(`ユーザー作成失敗: ${error.message}`);
  console.log(`[Supabase] 新規ユーザー作成: ${lineUserId.slice(0, 4)}****`);
  return newUser;
}

export async function updateCurrentStore(userId, storeId) {
  const { error } = await supabase
    .from('users')
    .update({ current_store_id: storeId, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(`店舗切替失敗: ${error.message}`);
}

// ==================== 店舗 ====================

export async function createStore(userId, storeData) {
  // カテゴリー名を正規化（表記ゆれ吸収: "ネイル"→"ネイルサロン" 等）
  const normalizedCategory = storeData.category
    ? normalizeCategory(storeData.category) || storeData.category
    : null;

  const { data, error } = await supabase
    .from('stores')
    .insert({
      user_id: userId,
      name: storeData.name,
      strength: storeData.strength,
      tone: storeData.tone,
      category: normalizedCategory,
      config: storeData.config || {
        post_length: '中文',
        templates: {},
        customization: {}
      },
    })
    .select()
    .single();

  if (error) throw new Error(`店舗登録失敗: ${error.message}`);
  return data;
}

export async function getStore(storeId) {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single();

  if (error) return null;
  return data;
}

export async function getStoresByUser(userId) {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`店舗一覧取得失敗: ${error.message}`);
  return data || [];
}

export async function deleteStore(storeId) {
  // 関連データを順番に削除してから店舗本体を削除
  // ※ DB側にON DELETE CASCADEがあるが、RLS環境での安全性のため明示的に削除
  const errors = [];

  // 1. users.current_store_id をクリア（FK SET NULLだが明示的に）
  const { error: userErr } = await supabase
    .from('users')
    .update({ current_store_id: null })
    .eq('current_store_id', storeId);
  if (userErr) errors.push(`users: ${userErr.message}`);

  // 2. 子テーブルを削除（依存関係の葉から順に）
  const childTables = [
    'pending_reports',
    'engagement_metrics',
    'post_history',
    'learning_data',
    'learning_profiles',
    'follower_history',
    'instagram_accounts',
  ];

  for (const table of childTables) {
    const { error: childErr } = await supabase
      .from(table)
      .delete()
      .eq('store_id', storeId);
    if (childErr) {
      // テーブルが存在しない場合は無視（未マイグレーション環境対応）
      if (!childErr.message.includes('does not exist')) {
        errors.push(`${table}: ${childErr.message}`);
      }
    }
  }

  // 3. 店舗本体を削除
  const { error } = await supabase.from('stores').delete().eq('id', storeId);
  if (error) throw new Error(`店舗削除失敗: ${error.message}`);

  if (errors.length > 0) {
    console.warn(`[Store] 関連データ削除で一部エラー（店舗自体は削除済み）: ${errors.join(', ')}`);
  }
}

// ==================== 投稿履歴 ====================

export async function savePostHistory(userId, storeId, content, imageData = null) {
  const { data, error } = await supabase
    .from('post_history')
    .insert({
      user_id: userId,
      store_id: storeId,
      content,
      image_data: imageData,
    })
    .select()
    .single();

  if (error) throw new Error(`投稿履歴保存失敗: ${error.message}`);
  return data;
}

/**
 * 投稿履歴のcontentを更新（修正版で上書き）
 * フィードバック修正時に新レコードを作らず既存を更新する
 */
export async function updatePostContent(postId, newContent) {
  const { data, error } = await supabase
    .from('post_history')
    .update({
      content: newContent,
    })
    .eq('id', postId)
    .select()
    .single();

  if (error) throw new Error(`投稿内容更新失敗: ${error.message}`);
  return data;
}

export async function getLatestPost(storeId) {
  const { data, error } = await supabase
    .from('post_history')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

// ==================== 学習データ ====================

export async function saveLearningData(storeId, type, originalContent, feedback, data = {}) {
  const { error } = await supabase
    .from('learning_data')
    .insert({
      store_id: storeId,
      type,
      original_content: originalContent,
      feedback,
      data,
    });

  if (error) throw new Error(`学習データ保存失敗: ${error.message}`);
}

export async function getLearningDataByStore(storeId, limit = 20) {
  const { data, error } = await supabase
    .from('learning_data')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

// ==================== 設定管理 ====================

/**
 * 店舗設定を更新
 */
export async function updateStoreConfig(storeId, configUpdates) {
  const { error } = await supabase
    .from('stores')
    .update({
      config: configUpdates,
      updated_at: new Date().toISOString()
    })
    .eq('id', storeId);

  if (error) throw new Error(`設定更新失敗: ${error.message}`);
}

/**
 * テンプレート情報を更新
 */
export async function updateStoreTemplates(storeId, templates) {
  const { data: store } = await supabase
    .from('stores')
    .select('config')
    .eq('id', storeId)
    .single();

  const newConfig = {
    ...(store?.config || {}),
    templates: {
      ...(store?.config?.templates || {}),
      ...templates
    }
  };

  await updateStoreConfig(storeId, newConfig);
}

// ==================== フォロワー数管理 ====================

/**
 * フォロワー数を更新
 */
export async function updateFollowerCount(storeId, followerCount) {
  const { error } = await supabase
    .from('stores')
    .update({
      follower_count: followerCount,
      follower_count_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', storeId);

  if (error) throw new Error(`フォロワー数更新失敗: ${error.message}`);
}

/**
 * フォロワー履歴を保存
 */
export async function saveFollowerHistory(storeId, followerCount, source = 'manual') {
  const { error } = await supabase
    .from('follower_history')
    .insert({
      store_id: storeId,
      follower_count: followerCount,
      source: source,
      recorded_at: new Date().toISOString()
    });

  if (error) throw new Error(`フォロワー履歴保存失敗: ${error.message}`);
}

/**
 * 最新のフォロワー数履歴を取得
 */
export async function getLatestFollowerHistory(storeId, limit = 12) {
  const { data, error } = await supabase
    .from('follower_history')
    .select('*')
    .eq('store_id', storeId)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}
