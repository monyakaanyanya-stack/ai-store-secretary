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

export async function savePostHistory(userId, storeId, content, imageData = null, imageUrl = null) {
  const insertData = {
    user_id: userId,
    store_id: storeId,
    content,
  };
  if (imageData) insertData.image_data = imageData;
  if (imageUrl) insertData.image_url = imageUrl;

  const { data, error } = await supabase
    .from('post_history')
    .insert(insertData)
    .select()
    .single();

  if (error) throw new Error(`投稿履歴保存失敗: ${error.message}`);
  return data;
}

/**
 * 画像を Supabase Storage にアップロードして公開URLを返す
 * @param {string} base64Data - Base64エンコードされた画像データ
 * @param {string} fileName - ストレージ内のファイルパス（例: "userId/timestamp.jpg"）
 * @returns {Promise<string>} 公開URL
 */
export async function uploadImageToStorage(base64Data, fileName) {
  const buffer = Buffer.from(base64Data, 'base64');
  const { data, error } = await supabase.storage
    .from('post-images')
    .upload(fileName, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) throw new Error(`画像アップロード失敗: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from('post-images')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
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
    .in('post_status', ['active', 'posted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

// ==================== 写真特徴（Premium分析AI） ====================

/**
 * 写真の構造化特徴タグを保存（post_features テーブル）
 * @param {string} storeId - 店舗ID
 * @param {string} postId - 投稿ID（post_history.id）
 * @param {object} features - 構造化特徴タグ
 */
export async function savePostFeatures(storeId, postId, features) {
  if (!features || !postId) return null;
  try {
    const { data, error } = await supabase
      .from('post_features')
      .upsert({
        store_id: storeId,
        post_id: postId,
        main_subject: features.main_subject_tag || 'other',
        scene_type: features.scene_type || 'other',
        has_person: features.has_person === true,
        action_type: features.action_type || 'none',
        lighting_type: features.lighting_type || 'natural_soft',
        camera_angle: features.camera_angle || 'eye_level',
        color_tone: features.color_tone || 'neutral',
        subject_density: features.subject_density || 'single',
        composition_type: features.composition_type || 'center',
      }, { onConflict: 'post_id' });

    if (error) {
      console.error('[PostFeatures] Save error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[PostFeatures] Unexpected error:', err.message);
    return null;
  }
}

/**
 * 写真特徴 × エンゲージメント集計（RPC関数経由）
 * @param {string} storeId - 店舗ID
 * @param {number} days - 集計期間（日数）
 * @returns {Array} 特徴別の平均保存率・エンゲージメント率
 */
export async function getFeatureAnalysis(storeId, days = 30) {
  try {
    const { data, error } = await supabase.rpc('analyze_post_features', {
      p_store_id: storeId,
      p_days: days,
    });
    if (error) {
      // RPC関数未作成の場合はフォールバック
      if (error.message.includes('function') || error.code === '42883') {
        console.warn('[PostFeatures] RPC関数未作成、JSフォールバックで集計');
        return getFeatureAnalysisFallback(storeId, days);
      }
      console.error('[PostFeatures] Analysis error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[PostFeatures] Analysis unexpected error:', err.message);
    return [];
  }
}

/**
 * 直近N件の投稿を特徴セット丸ごと + 保存率で取得（組み合わせ分析用）
 */
export async function getRecentPostsWithFeatures(storeId, limit = 30) {
  try {
    const { data: features, error } = await supabase
      .from('post_features')
      .select('post_id, main_subject, scene_type, has_person, action_type, lighting_type, camera_angle, color_tone, subject_density, composition_type')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !features || features.length === 0) return [];

    const postIds = features.map(f => f.post_id).filter(Boolean);
    const { data: metrics } = await supabase
      .from('engagement_metrics')
      .select('post_id, save_intensity, engagement_rate')
      .in('post_id', postIds)
      .eq('status', '報告済');

    if (!metrics || metrics.length === 0) return [];

    const metricsMap = new Map(metrics.map(m => [m.post_id, m]));
    const results = [];

    for (const f of features) {
      const m = metricsMap.get(f.post_id);
      if (!m) continue;
      results.push({
        save_rate: m.save_intensity || 0,
        engagement_rate: m.engagement_rate || 0,
        features: {
          main_subject: f.main_subject,
          scene_type: f.scene_type,
          has_person: f.has_person,
          action_type: f.action_type,
          lighting_type: f.lighting_type,
          camera_angle: f.camera_angle,
          color_tone: f.color_tone || 'neutral',
          subject_density: f.subject_density || 'single',
          composition_type: f.composition_type || 'center',
        },
      });
    }

    return results;
  } catch (err) {
    console.error('[PostFeatures] getRecentPostsWithFeatures error:', err.message);
    return [];
  }
}

/**
 * RPC関数が使えない場合のJSフォールバック集計
 */
async function getFeatureAnalysisFallback(storeId, days) {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: features, error } = await supabase
      .from('post_features')
      .select('post_id, main_subject, scene_type, has_person, action_type, lighting_type, camera_angle')
      .eq('store_id', storeId)
      .gte('created_at', cutoff);

    if (error || !features || features.length === 0) return [];

    // engagement_metricsと結合
    const postIds = features.map(f => f.post_id).filter(Boolean);
    const { data: metrics } = await supabase
      .from('engagement_metrics')
      .select('post_id, save_intensity, engagement_rate')
      .in('post_id', postIds)
      .eq('status', '報告済');

    if (!metrics || metrics.length === 0) return [];

    const metricsMap = new Map(metrics.map(m => [m.post_id, m]));
    const results = [];

    // 各特徴量で集計
    const featureKeys = ['main_subject', 'scene_type', 'has_person', 'action_type', 'lighting_type', 'camera_angle'];
    for (const key of featureKeys) {
      const groups = {};
      for (const f of features) {
        const m = metricsMap.get(f.post_id);
        if (!m) continue;
        const val = String(f[key] ?? 'unknown');
        if (!groups[val]) groups[val] = { saves: [], engagements: [] };
        groups[val].saves.push(m.save_intensity || 0);
        groups[val].engagements.push(m.engagement_rate || 0);
      }
      for (const [val, data] of Object.entries(groups)) {
        if (data.saves.length < 3) continue;
        const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        results.push({
          feature_name: key,
          feature_value: val,
          avg_save_rate: Math.round(avg(data.saves) * 10000) / 10000,
          avg_engagement_rate: Math.round(avg(data.engagements) * 10000) / 10000,
          post_count: data.saves.length,
        });
      }
    }
    return results;
  } catch (err) {
    console.error('[PostFeatures] Fallback analysis error:', err.message);
    return [];
  }
}

// ==================== 投稿ストック ====================

/**
 * 投稿のpost_statusを更新
 * @param {string} postId
 * @param {string} status - 'active' | 'draft' | 'scheduled' | 'posted'
 * @param {string|null} scheduledAt - ISO 8601 timestamp（'scheduled'の場合のみ）
 */
export async function updatePostStatus(postId, status, scheduledAt = null) {
  const updateData = { post_status: status };
  if (scheduledAt) updateData.scheduled_at = scheduledAt;
  if (status !== 'scheduled') updateData.scheduled_at = null;

  const { data, error } = await supabase
    .from('post_history')
    .update(updateData)
    .eq('id', postId)
    .select()
    .single();

  if (error) throw new Error(`投稿ステータス更新失敗: ${error.message}`);
  return data;
}

/**
 * 店舗のストック一覧を取得（draft + scheduled）
 * @param {string} storeId
 * @param {number} limit - 最大件数（デフォルト10）
 */
export async function getStockPosts(storeId, limit = 10) {
  const { data, error } = await supabase
    .from('post_history')
    .select('*')
    .eq('store_id', storeId)
    .in('post_status', ['draft', 'scheduled'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

/**
 * ストック投稿を1件取得
 */
export async function getStockPostById(postId) {
  const { data, error } = await supabase
    .from('post_history')
    .select('*')
    .eq('id', postId)
    .in('post_status', ['draft', 'scheduled'])
    .single();

  if (error) return null;
  return data;
}

/**
 * ストック投稿を削除
 */
export async function deleteStockPost(postId) {
  const { error } = await supabase
    .from('post_history')
    .delete()
    .eq('id', postId)
    .in('post_status', ['draft', 'scheduled']);

  if (error) throw new Error(`ストック削除失敗: ${error.message}`);
}

/**
 * ストック投稿を一括削除
 */
export async function deleteBatchStockPosts(postIds) {
  if (!postIds.length) return 0;
  const { data, error } = await supabase
    .from('post_history')
    .delete()
    .in('id', postIds)
    .in('post_status', ['draft', 'scheduled'])
    .select('id');

  if (error) throw new Error(`ストック一括削除失敗: ${error.message}`);
  return data?.length || 0;
}

/**
 * 予約投稿の期限が来たものを取得
 */
export async function getDueScheduledPosts() {
  const { data, error } = await supabase
    .from('post_history')
    .select('*')
    .eq('post_status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });

  if (error) return [];
  return data || [];
}

/**
 * 店舗のストック件数を取得
 */
export async function getStockCount(storeId) {
  const { count, error } = await supabase
    .from('post_history')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .in('post_status', ['draft', 'scheduled']);

  if (error) return 0;
  return count || 0;
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

/**
 * 投稿モードを更新（ai / direct）
 */
export async function updateStorePostMode(storeId, mode) {
  const { data: store } = await supabase
    .from('stores')
    .select('config')
    .eq('id', storeId)
    .single();

  const newConfig = {
    ...(store?.config || {}),
    post_mode: mode
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
 * 画像コンテキストを一時保存（「一言ヒント」質問待ち状態）
 */
export async function savePendingImageContext(userId, context) {
  const { error } = await supabase
    .from('users')
    .update({ pending_image_context: context })
    .eq('id', userId);
  if (error) throw new Error(`pending_image_context 保存失敗: ${error.message}`);
}

/**
 * 画像コンテキストをクリア
 */
export async function clearPendingImageContext(userId) {
  const { error } = await supabase
    .from('users')
    .update({ pending_image_context: null })
    .eq('id', userId);
  if (error) console.warn('[Supabase] pending_image_context クリア失敗:', error.message);
}

/**
 * pending_command をセット
 * 'revision' = 次のメッセージを「直し:」として処理
 * 'style_learning' = 次のメッセージを「学習:」として処理
 */
export async function setPendingCommand(userId, command) {
  const { error } = await supabase
    .from('users')
    .update({ pending_command: command })
    .eq('id', userId);
  if (error) {
    console.error('[Supabase] pending_command セット失敗 userId=%s command=%s:', userId, command, error.message);
    throw new Error(`pending_command セット失敗: ${error.message}`);
  }
  console.log('[Supabase] pending_command セット成功: userId=%s command=%s', userId, command);
}

/**
 * pending_command をクリア
 */
export async function clearPendingCommand(userId) {
  const { error } = await supabase
    .from('users')
    .update({ pending_command: null })
    .eq('id', userId);
  if (error) console.warn('[Supabase] pending_command クリア失敗:', error.message);
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
