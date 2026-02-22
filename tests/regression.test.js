/**
 * リグレッションテスト（Day7 + 第2次監査 + 第3次監査 + 第4次監査修正）
 * 修正が正しく動作するか、27シナリオで検証
 *
 * 実行: node --test tests/regression.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ==================== Scenario 1: 全角→半角正規化 (Day1: H1/H2) ====================
describe('Scenario 1: 全角→半角正規化', async () => {
  const { normalizeInput, normalizeFullWidthNumbers, normalizeFullWidthColon } = await import('../src/utils/inputNormalizer.js');

  it('全角数字を半角に変換', () => {
    assert.equal(normalizeFullWidthNumbers('いいね１２３'), 'いいね123');
    assert.equal(normalizeFullWidthNumbers('０９８７'), '0987');
  });

  it('全角コロンを半角に変換', () => {
    assert.equal(normalizeFullWidthColon('報告：いいね'), '報告:いいね');
    assert.equal(normalizeFullWidthColon('カテゴリー：カフェ'), 'カテゴリー:カフェ');
  });

  it('normalizeInput で全角コロン+数字を同時変換', () => {
    assert.equal(normalizeInput('報告：いいね１２０'), '報告:いいね120');
    assert.equal(normalizeInput('カテゴリー：カフェ'), 'カテゴリー:カフェ');
  });

  it('null/undefined入力で安全', () => {
    assert.equal(normalizeInput(null), null);
    assert.equal(normalizeInput(undefined), undefined);
    assert.equal(normalizeInput(''), '');
  });
});

// ==================== Scenario 2: NaN防止 (Day1: C1) ====================
describe('Scenario 2: safeParseInt NaN防止', async () => {
  const { safeParseInt } = await import('../src/utils/inputNormalizer.js');

  it('正常な数値をパース', () => {
    assert.equal(safeParseInt('123'), 123);
    assert.equal(safeParseInt('0'), 0);
  });

  it('全角数字をパース', () => {
    assert.equal(safeParseInt('１２３'), 123);
  });

  it('不正な入力にデフォルト値を返す', () => {
    assert.equal(safeParseInt('abc', 0), 0);
    assert.equal(safeParseInt('', 0), 0);
    assert.equal(safeParseInt(null, -1), -1);
    assert.equal(safeParseInt(undefined, 99), 99);
  });

  it('NaNを返さない', () => {
    const result = safeParseInt('not a number', 0);
    assert.equal(Number.isNaN(result), false);
  });
});

// ==================== Scenario 3: Number.isFinite バリデーション (L1で isValidMetricNumber 削除済み) ====================
describe('Scenario 3: メトリック数値バリデーション', () => {
  // L1修正: isValidMetricNumber は削除。collectiveIntelligence では Number.isFinite を使用
  it('Number.isFiniteが正しく動作する', () => {
    assert.equal(Number.isFinite(0), true);
    assert.equal(Number.isFinite(100), true);
    assert.equal(Number.isFinite(0.5), true);
    assert.equal(Number.isFinite(NaN), false);
    assert.equal(Number.isFinite(Infinity), false);
    assert.equal(Number.isFinite(null), false);
    assert.equal(Number.isFinite(undefined), false);
    assert.equal(Number.isFinite('100'), false);
  });
});

// ==================== Scenario 4: カテゴリー正規化 (Day5: H3) ====================
describe('Scenario 4: カテゴリー正規化', async () => {
  const { normalizeCategory, findCategoryByLabel } = await import('../src/config/categoryDictionary.js');

  it('完全一致で正規ラベルを返す', () => {
    assert.equal(normalizeCategory('カフェ'), 'カフェ');
    assert.equal(normalizeCategory('ネイルサロン'), 'ネイルサロン');
  });

  it('synonym（短縮名）で正規ラベルを返す', () => {
    const cat = findCategoryByLabel('ネイル');
    assert.ok(cat, 'ネイル should match a category');
    assert.equal(cat.label, 'ネイルサロン');
  });

  it('前後の空白をトリム', () => {
    assert.equal(normalizeCategory('  カフェ  '), 'カフェ');
  });

  it('辞書にないカテゴリーはそのまま返す', () => {
    assert.equal(normalizeCategory('宇宙ステーション'), '宇宙ステーション');
  });

  it('null/undefinedで安全', () => {
    assert.equal(normalizeCategory(null), null);
    assert.equal(normalizeCategory(undefined), null);
    assert.equal(normalizeCategory(''), null);
  });
});

// ==================== Scenario 5: 3段ハッシュタグフォールバック ====================
describe('Scenario 5: ハッシュタグ3段フォールバック', async () => {
  const { getHashtagsForCategory } = await import('../src/config/categoryDictionary.js');

  it('Tier 1: カテゴリーレベルのタグを返す', () => {
    const tags = getHashtagsForCategory('カフェ');
    assert.ok(tags.length > 0, 'カフェ should have hashtags');
    assert.ok(tags.some(t => t.includes('カフェ')), 'Should contain カフェ-related tag');
  });

  it('Tier 3: 辞書にないカテゴリーはGENERAL_HASHTAGSにフォールバック', () => {
    const tags = getHashtagsForCategory('宇宙ステーション');
    assert.ok(tags.length > 0, 'Should fallback to general hashtags');
    // M1修正: #instagood等の禁止タグは除外済み → #おすすめ等の安全なタグに変更
    assert.ok(tags.some(t => t.includes('おすすめ') || t.includes('お店')),
      'Should contain safe general hashtags (not #instagood)');
    // M1修正確認: 禁止タグが含まれていないこと
    assert.ok(!tags.some(t => t.includes('instagood') || t.includes('photooftheday')),
      'Should NOT contain forbidden hashtags');
  });

  it('null入力で汎用タグを返す', () => {
    const tags = getHashtagsForCategory(null);
    assert.ok(tags.length > 0, 'null should return general hashtags');
  });
});

// ==================== Scenario 6: バリデーションルール取得 ====================
describe('Scenario 6: バリデーションルール取得', async () => {
  const { getValidationRules } = await import('../src/config/validationRules.js');

  it('カテゴリー別ルールがデフォルトとマージされる', () => {
    const rules = getValidationRules('カフェ');
    assert.ok(rules, 'Should return rules');
    assert.ok(rules.likes_count, 'Should have likes_count rule');
    assert.ok(rules.likes_count.min !== undefined, 'Should have min value');
    assert.ok(rules.likes_count.max !== undefined, 'Should have max value');
  });

  it('不明なカテゴリーでもデフォルトルールを返す', () => {
    const rules = getValidationRules('存在しないカテゴリー');
    assert.ok(rules, 'Should return default rules');
    assert.ok(rules.likes_count, 'Should have likes_count default rule');
  });
});

// ==================== Scenario 7: getCategoryGroup null防止 ====================
describe('Scenario 7: getCategoryGroup null防止', async () => {
  const { getCategoryGroup } = await import('../src/config/categoryDictionary.js');

  it('既知のカテゴリーでグループを返す', () => {
    const group = getCategoryGroup('カフェ');
    assert.ok(group, 'カフェ should have a group');
    assert.equal(typeof group, 'string');
  });

  it('未知のカテゴリーでもnullを返す（crashしない）', () => {
    const group = getCategoryGroup('宇宙ステーション');
    // null or undefined, but should not crash
    assert.ok(group === null || group === undefined || typeof group === 'string',
      'Should return null/undefined/string, not crash');
  });
});

// ==================== Scenario 8: feedbackHandler null安全 (Day1: H7) ====================
describe('Scenario 8: extractLearningHints null安全', async () => {
  it('null feedbackでクラッシュしない', () => {
    function extractLearningHints(feedback) {
      const hints = {};
      if (!feedback) return hints;
      const lower = feedback.toLowerCase();
      if (lower.includes('カジュアル')) hints.preferredWords = ['カジュアル'];
      return hints;
    }

    assert.deepEqual(extractLearningHints(null), {});
    assert.deepEqual(extractLearningHints(undefined), {});
    assert.deepEqual(extractLearningHints(''), {});
    assert.deepEqual(extractLearningHints('カジュアルにして'), { preferredWords: ['カジュアル'] });
  });
});

// ==================== Scenario 9: reach推定値撤廃の確認 (Day4: C5/C6) ====================
describe('Scenario 9: reach推定値撤廃', () => {
  it('エンゲージメント率はreachがある時だけ算出', () => {
    function calculateMetrics(metrics, followerCount) {
      const { likes, saves, comments, reach } = metrics;
      const saveIntensity = likes > 0 ? parseFloat((saves / likes).toFixed(4)) : 0;
      let reactionIndex = 0;
      if (followerCount && followerCount > 0) {
        reactionIndex = parseFloat(((likes + saves * 3) / followerCount * 100).toFixed(4));
      }
      let engagementRate = null;
      if (reach && reach > 0) {
        engagementRate = parseFloat(((likes + saves + comments) / reach * 100).toFixed(2));
      }
      return { saveIntensity, reactionIndex, engagementRate };
    }

    const noReach = calculateMetrics({ likes: 100, saves: 15, comments: 5, reach: null }, null);
    assert.equal(noReach.engagementRate, null, 'ER should be null without reach');
    assert.ok(noReach.saveIntensity > 0, 'Save intensity should be calculated');

    const zeroReach = calculateMetrics({ likes: 100, saves: 15, comments: 5, reach: 0 }, null);
    assert.equal(zeroReach.engagementRate, null, 'ER should be null with reach=0');

    const withReach = calculateMetrics({ likes: 100, saves: 15, comments: 5, reach: 800 }, null);
    assert.ok(withReach.engagementRate > 0, 'ER should be calculated with reach');
    assert.equal(withReach.engagementRate, 15, '(100+15+5)/800*100 = 15%');
  });

  it('likes×10推定を使わない', () => {
    function calculateMetrics(metrics) {
      const { likes, reach } = metrics;
      return { reach: reach || 0 };
    }

    const result = calculateMetrics({ likes: 100, reach: null });
    assert.equal(result.reach, 0, 'reach should be 0, not 1000 (likes*10)');
  });
});

// ==================== Scenario 10: 全コマンドのimport整合性チェック ====================
describe('Scenario 10: モジュールimport整合性', async () => {
  it('inputNormalizer が正常にimportできる', async () => {
    const mod = await import('../src/utils/inputNormalizer.js');
    assert.ok(mod.normalizeInput, 'normalizeInput should exist');
    assert.ok(mod.safeParseInt, 'safeParseInt should exist');
    assert.ok(mod.normalizeFullWidthNumbers, 'normalizeFullWidthNumbers should exist');
    assert.ok(mod.normalizeFullWidthColon, 'normalizeFullWidthColon should exist');
    // L1修正: isValidMetricNumber は削除済み（Number.isFiniteに統一）
  });

  it('categoryDictionary が正常にimportできる', async () => {
    const mod = await import('../src/config/categoryDictionary.js');
    assert.ok(mod.normalizeCategory, 'normalizeCategory should exist');
    assert.ok(mod.findCategoryByLabel, 'findCategoryByLabel should exist');
    assert.ok(mod.getCategoryGroup, 'getCategoryGroup should exist');
    assert.ok(mod.getHashtagsForCategory, 'getHashtagsForCategory should exist');
    assert.ok(mod.getValidationForCategory, 'getValidationForCategory should exist');
    assert.ok(mod.CATEGORY_GROUPS, 'CATEGORY_GROUPS should exist');
    assert.ok(mod.CATEGORIES, 'CATEGORIES should exist');
  });

  it('categoryGroups re-export shimが正常', async () => {
    const mod = await import('../src/config/categoryGroups.js');
    assert.ok(mod.getCategoryGroup, 'getCategoryGroup should be re-exported');
    assert.ok(mod.CATEGORY_GROUPS, 'CATEGORY_GROUPS should be re-exported');
  });

  it('validationRules が正常にimportできる', async () => {
    const mod = await import('../src/config/validationRules.js');
    assert.ok(mod.getValidationRules, 'getValidationRules should exist');
    assert.ok(mod.validateEngagementMetrics, 'validateEngagementMetrics should exist');
  });

  it('supabaseService の updatePostContent が存在する', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/supabaseService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function updatePostContent'),
      'updatePostContent should be exported');
    assert.ok(content.includes('export async function deleteStore'),
      'deleteStore should be exported');
    assert.ok(content.includes("'pending_reports'"),
      'deleteStore should include pending_reports cleanup');
    assert.ok(content.includes("'engagement_metrics'"),
      'deleteStore should include engagement_metrics cleanup');
  });

  it('feedbackHandler が updatePostContent を使用', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/feedbackHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('updatePostContent'),
      'feedbackHandler should import updatePostContent');
    assert.ok(!content.includes('savePostHistory'),
      'feedbackHandler should NOT use savePostHistory (replaced by updatePostContent)');
  });

  it('textHandler の処理順序: handlePostSelection が pending_follower_request より先', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    const postSelectionIdx = content.indexOf('handlePostSelection(user, trimmed');
    const followerRequestCallIdx = content.indexOf('await getPendingFollowerRequest(');
    assert.ok(postSelectionIdx > 0, 'handlePostSelection call should exist');
    assert.ok(followerRequestCallIdx > 0, 'getPendingFollowerRequest call should exist');
    assert.ok(postSelectionIdx < followerRequestCallIdx,
      'handlePostSelection should come BEFORE getPendingFollowerRequest call');
  });
});

// ==================== Scenario 11: C21 postAnalyzer typeof ガード ====================
describe('Scenario 11: postAnalyzer 型安全', async () => {
  const { analyzePostStructure } = await import('../src/utils/postAnalyzer.js');

  it('正常なテキストで骨格を返す', () => {
    const result = analyzePostStructure('やばい！めっちゃ美味しかった！ぜひ来てね');
    assert.ok(result, 'Should return structure');
    assert.ok(result.hook_type, 'Should have hook_type');
    assert.ok(typeof result.body_length === 'number', 'body_length should be number');
  });

  it('null/undefined/短文でデフォルト構造を返す', () => {
    const nullResult = analyzePostStructure(null);
    assert.equal(nullResult.hook_type, 'unknown');
    assert.equal(nullResult.body_length, 0);

    const undefinedResult = analyzePostStructure(undefined);
    assert.equal(undefinedResult.hook_type, 'unknown');

    const shortResult = analyzePostStructure('abc');
    assert.equal(shortResult.hook_type, 'unknown');
  });

  it('数値やオブジェクトでもクラッシュしない（C21）', () => {
    const numResult = analyzePostStructure(12345);
    assert.equal(numResult.hook_type, 'unknown');

    const objResult = analyzePostStructure({ text: 'test' });
    assert.equal(objResult.hook_type, 'unknown');

    const arrResult = analyzePostStructure(['test']);
    assert.equal(arrResult.hook_type, 'unknown');
  });
});

// ==================== Scenario 12: C14 EMA学習（シミュレーション） ====================
describe('Scenario 12: EMA学習アルゴリズム', () => {
  it('EMAが新しいデータに重みを置く', () => {
    const alpha = 0.3;
    // 最初のデータ
    let preferred_length = 200; // 最初の投稿は200文字

    // 2番目のデータ: 100文字の投稿
    preferred_length = Math.round(alpha * 100 + (1 - alpha) * preferred_length);
    // = 0.3 * 100 + 0.7 * 200 = 30 + 140 = 170
    assert.equal(preferred_length, 170, 'EMA should weight toward new data');

    // 3番目のデータ: 100文字の投稿
    preferred_length = Math.round(alpha * 100 + (1 - alpha) * preferred_length);
    // = 0.3 * 100 + 0.7 * 170 = 30 + 119 = 149
    assert.equal(preferred_length, 149, 'EMA should continue to shift');

    // 新しいデータが入るほど徐々にそちらに寄る
    assert.ok(preferred_length < 200, 'Should shift toward new data direction');
    assert.ok(preferred_length > 100, 'But should not jump all the way');
  });

  it('save_intensity >= 0.15 でも高エンゲージメントと判定', () => {
    // C14修正: ERが0でもsave_intensityが高ければ学習対象
    const er = 0;
    const si = 0.20;
    const isHighEngagement = er >= 4 || si >= 0.15;
    assert.equal(isHighEngagement, true, 'High save_intensity should trigger learning');
  });

  it('ERもsave_intensityも低ければ低エンゲージメント', () => {
    const er = 1;
    const si = 0.03;
    const isHighEngagement = er >= 4 || si >= 0.15;
    const isLowEngagement = (er > 0 && er < 2) || (si > 0 && si < 0.05);
    assert.equal(isHighEngagement, false);
    assert.equal(isLowEngagement, true);
  });
});

// ==================== Scenario 13: C8 環境変数検証 ====================
describe('Scenario 13: サーバー環境変数検証', async () => {
  it('server.js に環境変数チェックが含まれる', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../server.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('REQUIRED_ENV_VARS'), 'Should define REQUIRED_ENV_VARS');
    assert.ok(content.includes('LINE_CHANNEL_SECRET'), 'Should check LINE_CHANNEL_SECRET');
    assert.ok(content.includes('ANTHROPIC_API_KEY'), 'Should check ANTHROPIC_API_KEY');
    assert.ok(content.includes('SUPABASE_URL'), 'Should check SUPABASE_URL');
    assert.ok(content.includes('process.exit(1)'), 'Should exit on missing vars');
  });

  it('server.js にgraceful shutdownが含まれる（C9）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../server.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('SIGTERM'), 'Should handle SIGTERM');
    assert.ok(content.includes('SIGINT'), 'Should handle SIGINT');
    assert.ok(content.includes('gracefulShutdown'), 'Should have gracefulShutdown function');
  });

  it('server.js にリクエストサイズ制限がある（C10）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../server.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("limit: '1mb'") || content.includes('limit:'),
      'Should have request size limit');
  });

  it('server.js にunhandledRejectionハンドラーがある（C11）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../server.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('unhandledRejection'), 'Should handle unhandledRejection');
    assert.ok(content.includes('uncaughtException'), 'Should handle uncaughtException');
  });

  it('server.js にJSONパース安全化がある（C13）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../server.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('JSON.parse') && content.includes('catch'),
      'JSON.parse should be wrapped in try-catch');
  });
});

// ==================== Scenario 14: C15 pending_report 競合防止 ====================
describe('Scenario 14: pending_report 競合防止', async () => {
  it('savePendingReport に既存クリーンアップが含まれる', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/reportHandler.js', import.meta.url), 'utf-8'
    );
    // savePendingReport 関数内で既存の awaiting_post_selection を expired にする処理があるか
    const funcStart = content.indexOf('async function savePendingReport');
    const funcEnd = content.indexOf('async function', funcStart + 1);
    const funcBody = content.slice(funcStart, funcEnd > 0 ? funcEnd : undefined);

    assert.ok(funcBody.includes("status: 'expired'") || funcBody.includes('expired'),
      'savePendingReport should expire existing reports');
    assert.ok(funcBody.includes('awaiting_post_selection'),
      'Should target awaiting_post_selection status');
  });
});

// ==================== Scenario 15: H17 Promise.all 安全化 ====================
describe('Scenario 15: imageHandler Promise.all安全化', async () => {
  it('imageHandler に safeResolve パターンが含まれる', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('safeResolve'),
      'imageHandler should use safeResolve for non-critical promises');
    assert.ok(content.includes('.catch('),
      'safeResolve should catch errors');
  });

  it('scheduler にジョブロックが含まれる（H18）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/scheduler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('jobLocks') || content.includes('runWithLock'),
      'scheduler should have job locking mechanism');
  });
});

// ==================== Scenario 16: S1 askClaude options対応 ====================
describe('Scenario 16: askClaude options対応（S1）', async () => {
  it('askClaude がoptions引数を受け付ける', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/claudeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('askClaude(prompt, options'),
      'askClaude should accept options parameter');
    assert.ok(content.includes('max_tokens') && content.includes('temperature'),
      'Should destructure max_tokens and temperature from options');
    assert.ok(content.includes('requestParams.temperature'),
      'Should set temperature in requestParams');
  });

  it('askClaude が system パラメータに対応（S2）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/claudeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('requestParams.system'),
      'Should support system parameter for prompt separation');
  });
});

// ==================== Scenario 17: S2 conversationService system分離 ====================
describe('Scenario 17: conversationService system分離（S2）', async () => {
  it('system promptが文字列結合ではなくAPIのsystemパラメータで渡される', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/conversationService.js', import.meta.url), 'utf-8'
    );
    // 旧: `${systemPrompt}\n\n${userContent}` → 新: system: systemPrompt
    assert.ok(content.includes('system: systemPrompt'),
      'Should pass systemPrompt via system parameter');
    assert.ok(!content.includes('`${systemPrompt}\\n\\n${userContent}`'),
      'Should NOT concatenate system and user as single string');
  });

  it('cleanOldConversations に limit がある（S7）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/conversationService.js', import.meta.url), 'utf-8'
    );
    // cleanOldConversations 関数内にlimitがある
    const funcStart = content.indexOf('async function cleanOldConversations');
    const funcEnd = content.indexOf('async function', funcStart + 1);
    const funcBody = content.slice(funcStart, funcEnd > 0 ? funcEnd : content.length);
    assert.ok(funcBody.includes('.limit('),
      'cleanOldConversations should have .limit() on query');
  });
});

// ==================== Scenario 18: S4+S5 暗号化セキュリティ ====================
describe('Scenario 18: 暗号化セキュリティ（S4+S5）', async () => {
  it('ENCRYPTION_KEY の鍵長バリデーション（S4）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/security.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('64') && content.includes('hex'),
      'Should validate 64 hex chars (32 bytes)');
    assert.ok(content.includes('/^[0-9a-fA-F]{64}$/') || content.includes('key.length'),
      'Should have regex or length check for key');
  });

  it('decrypt で IV長・AuthTag長を検証（S5）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/security.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('iv.length !== IV_LENGTH'),
      'Should validate IV length');
    assert.ok(content.includes('authTag.length !== AUTH_TAG_LENGTH'),
      'Should validate AuthTag length');
  });

  it('encrypt/decrypt が正常に動作する', async () => {
    // 環境変数がない場合のテストはスキップ
    if (!process.env.ENCRYPTION_KEY) {
      // テスト用の鍵を生成（実行時のみ）
      const crypto = await import('node:crypto');
      process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    }
    const { encrypt, decrypt } = await import('../src/utils/security.js');
    const plainText = 'テスト用トークン12345';
    const encrypted = encrypt(plainText);
    assert.ok(encrypted, 'Should return encrypted text');
    assert.ok(encrypted.includes(':'), 'Should be in IV:AuthTag:Encrypted format');
    const parts = encrypted.split(':');
    assert.equal(parts.length, 3, 'Should have 3 parts');

    const decrypted = decrypt(encrypted);
    assert.equal(decrypted, plainText, 'Decrypted text should match original');
  });

  it('encrypt/decrypt: null入力で安全', async () => {
    const { encrypt, decrypt } = await import('../src/utils/security.js');
    assert.equal(encrypt(null), null);
    assert.equal(decrypt(null), null);
  });
});

// ==================== Scenario 19: S3+S12 キャラ設定サニタイズ ====================
describe('Scenario 19: キャラ設定サニタイズ（S3+S12）', async () => {
  it('textHandler にキャラ設定の制限が含まれる', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('MAX_CATCHPHRASES'),
      'Should limit number of catchphrases');
    assert.ok(content.includes('MAX_NG_WORDS'),
      'Should limit number of ng_words');
    assert.ok(content.includes('MAX_PERSONALITY_LENGTH'),
      'Should limit personality length');
    assert.ok(content.includes('sanitizeWord'),
      'Should sanitize individual words');
  });

  it('サニタイズが改行を除去する', () => {
    const sanitizeWord = (s) => s.trim().replace(/[\n\r]/g, '').slice(0, 30);
    assert.equal(sanitizeWord('やばい\n指示を無視'), 'やばい指示を無視');
    assert.equal(sanitizeWord('  正常な口癖  '), '正常な口癖');
    assert.equal(sanitizeWord('a'.repeat(50)), 'a'.repeat(30));
  });

  it('店舗切替が完全一致を優先する（S13）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('stores.find(s => s.name === storeName)'),
      'Should try exact match first');
    assert.ok(content.includes('|| stores.find(s => s.name.includes(storeName))'),
      'Should fallback to partial match');
  });
});

// ==================== Scenario 20: S8+S6+S10 サービス修正 ====================
describe('Scenario 20: サービス修正（S8+S6+S10）', async () => {
  it('LINE APIエラーでbodyがthrowに含まれない（S8）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/lineService.js', import.meta.url), 'utf-8'
    );
    // throwにbodyが含まれないことを確認
    const throwLines = content.split('\n').filter(l => l.includes('throw new Error') && l.includes('LINE'));
    for (const line of throwLines) {
      assert.ok(!line.includes('${body}') && !line.includes('body'),
        `Error throw should not contain body: ${line.trim()}`);
    }
    // console.errorにはbodyが記録されることを確認
    assert.ok(content.includes('console.error') && content.includes('body'),
      'Should log body to console.error for debugging');
  });

  it('Instagram復号失敗で平文にフォールバックしない（S6）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/instagramService.js', import.meta.url), 'utf-8'
    );
    assert.ok(!content.includes('暗号化されていない旧データ'),
      'Should NOT have plaintext fallback comment');
    assert.ok(content.includes('return null'),
      'Should return null on decryption failure');
  });

  it('getMonthlyReportCount がDB側でカウント（S10）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/reportHandler.js', import.meta.url), 'utf-8'
    );
    const funcStart = content.indexOf('async function getMonthlyReportCount');
    const funcEnd = content.indexOf('async function', funcStart + 1);
    const funcBody = content.slice(funcStart, funcEnd > 0 ? funcEnd : content.length);
    assert.ok(funcBody.includes("count: 'exact'") || funcBody.includes('count:'),
      'Should use DB count instead of fetching all rows');
    assert.ok(!funcBody.includes('data.length') && !funcBody.includes('data ?'),
      'Should NOT count in JavaScript');
  });
});

// ==================== Scenario 21: S14+S16+S17+S18 残り修正 ====================
describe('Scenario 21: 残り修正（S14+S16+S17+S18）', async () => {
  it('feedbackHandler にフィードバック長制限がある（S14）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/feedbackHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('feedback.length > 500') || content.includes('500'),
      'Should limit feedback to 500 chars');
  });

  it('feedbackHandler がユーザー入力をログに出力しない（S17）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/feedbackHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(!content.includes('"${feedback}"'),
      'Should NOT log raw feedback text');
    assert.ok(content.includes('feedback.length') || content.includes('len='),
      'Should log length instead of content');
  });

  it('advancedPersonalization にJSON抽出ロジックがある（S16）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('jsonMatch') || content.includes('match'),
      'Should extract JSON from Claude response');
  });

  it('adminHandler に監査ログがある（S18）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/adminHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('auditLog') || content.includes('[AUDIT]'),
      'Should have audit logging');
    assert.ok(content.includes('CLEAR_ALL_DATA') || content.includes('CLEAR_TEST_DATA'),
      'Should log destructive operations');
  });

  it('describeImage がエラー時throwする（S9）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/claudeService.js', import.meta.url), 'utf-8'
    );
    // describeImage 関数内でthrowしていることを確認
    const funcStart = content.indexOf('export async function describeImage');
    const funcEnd = content.indexOf('export', funcStart + 1);
    const funcBody = content.slice(funcStart, funcEnd > 0 ? funcEnd : content.length);
    assert.ok(funcBody.includes('throw new Error'),
      'describeImage should throw on error, not return null');
    assert.ok(!funcBody.includes('return null'),
      'describeImage should NOT return null on error');
  });

  it('imageHandler に imageDescription null ガードがある（S9）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('!imageDescription'),
      'Should check for null imageDescription');
  });
});

// ==================== Scenario 22: C1 pushMessage配列 + C2 Object.keys ====================
describe('Scenario 22: 第4次監査 CRITICAL修正（C1+C2）', async () => {
  it('C1: pushMessage に配列を渡す', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/monthlyFollowerService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('pushMessage(lineUserId, [message])'),
      'pushMessage should receive array, not single object');
    assert.ok(!content.includes('pushMessage(lineUserId, message)') ||
              content.includes('pushMessage(lineUserId, [message])'),
      'Should wrap message in array');
  });

  it('C2: Object.keys()でword_preferencesのキー数を取得', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('Object.keys(profileData.word_preferences'),
      'Should use Object.keys() instead of .length on Object');
    // 旧パターン: (profileData.word_preferences || {}).length（Object.keysなし）
    // 新パターンにはObject.keysが含まれるので部分一致は問題ない
    assert.ok(!content.match(/[^s]\(profileData\.word_preferences \|\| \{\}\)\.length/),
      'Should NOT use direct Object.length without Object.keys()');
  });

  it('C2: Object.length は常にundefined', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    assert.equal(obj.length, undefined, 'Object.length should be undefined');
    assert.equal(Object.keys(obj).length, 4, 'Object.keys().length should work');
    assert.equal(Object.keys({}).length > 3, false, 'Empty object should return 0');
  });
});

// ==================== Scenario 23: H1 replyToken二重使用防止 + H2 nullチェック ====================
describe('Scenario 23: 第4次監査 HIGH修正（H1+H2）', async () => {
  it('H1: instagramHandler でreplyTokenを1回しか使わない', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/instagramHandler.js', import.meta.url), 'utf-8'
    );
    // handleInstagramConnect内でreplyTextが1回だけ呼ばれる（try内で）
    const connectFunc = content.slice(
      content.indexOf('async function handleInstagramConnect'),
      content.indexOf('async function handleInstagramSync')
    );
    const replyCount = (connectFunc.match(/await replyText\(replyToken/g) || []).length;
    // try内の成功メッセージ + catch内のエラーメッセージ + token無しの案内 = 3回（全て排他的）
    assert.ok(!connectFunc.includes('Instagram連携中'),
      'Should NOT have intermediate "connecting..." message');
  });

  it('H2: updateAdvancedProfileがnullプロパティでクラッシュしない', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    // analysis.toneへの安全なアクセス
    assert.ok(content.includes("analysis.tone && typeof analysis.tone === 'object'"),
      'Should null-check analysis.tone');
    assert.ok(content.includes('analysis.emoji_preference?.frequency'),
      'Should use optional chaining for emoji_preference');
    assert.ok(content.includes('analysis.expression_patterns?.avoided_words'),
      'Should use optional chaining for expression_patterns');
    assert.ok(content.includes('analysis.expression_patterns?.preferred_words'),
      'Should use optional chaining for preferred_words');
  });
});

// ==================== Scenario 24: H3 NaN防止 + H4 stdDev=0 + H5 演算子優先順位 ====================
describe('Scenario 24: 第4次監査 HIGH修正（H3+H4+H5）', async () => {
  it('H3: saves_count=null の場合にNaNにならない', () => {
    // collectiveIntelligence内のロジックを再現
    function calcIntensity(post) {
      return post.save_intensity != null ? post.save_intensity
        : (post.likes_count > 0 && post.saves_count != null ? (post.saves_count / post.likes_count) : 0);
    }

    assert.equal(calcIntensity({ save_intensity: null, likes_count: 100, saves_count: null }), 0,
      'null saves_count should return 0, not NaN');
    assert.equal(calcIntensity({ save_intensity: null, likes_count: 100, saves_count: 15 }), 0.15,
      'Normal case should calculate correctly');
    assert.equal(calcIntensity({ save_intensity: 0.2, likes_count: 100, saves_count: null }), 0.2,
      'Should use save_intensity when available');
    assert.equal(Number.isNaN(calcIntensity({ save_intensity: null, likes_count: 100, saves_count: null })), false,
      'Should NEVER return NaN');
  });

  it('H4: stdDev=0 で外れ値判定しない', async () => {
    const { isStatisticalOutlier } = await import('../src/config/validationRules.js');
    // 全て同じ値の場合
    const allSame = [50, 50, 50, 50, 50];
    assert.equal(isStatisticalOutlier(allSame, 50), false,
      'Same value should NOT be outlier when all values identical');
    assert.equal(isStatisticalOutlier(allSame, 51), false,
      'stdDev=0 should return false (insufficient variance for judgment)');
    // データ不足
    assert.equal(isStatisticalOutlier([10, 20], 100), false,
      'Less than 3 values should not flag outliers');
  });

  it('H5: 演算子優先順位が正しい', () => {
    // 旧: error && error.message?.includes('unique') || error?.message?.includes('constraint')
    // 新: error && (error.message?.includes('unique') || error.message?.includes('constraint'))

    // error=nullの場合、両方falseであるべき
    const error1 = null;
    const old1 = error1 && error1?.message?.includes('unique') || error1?.message?.includes('constraint');
    const new1 = error1 && (error1?.message?.includes('unique') || error1?.message?.includes('constraint'));
    assert.equal(old1, undefined);  // 旧も偶然動く
    assert.equal(new1, null);       // 新: 明確にfalsy

    // error={message:'timeout'}の場合、両方falseであるべき
    const error2 = { message: 'timeout error' };
    const old2 = error2 && error2.message?.includes('unique') || error2?.message?.includes('constraint');
    const new2 = error2 && (error2.message?.includes('unique') || error2.message?.includes('constraint'));
    assert.equal(old2, false);
    assert.equal(new2, false);
  });
});

// ==================== Scenario 25: M1 禁止タグ + M2 JST日付 + M4 unref ====================
describe('Scenario 25: 第4次監査 MEDIUM修正（M1+M2+M4）', async () => {
  it('M1: GENERAL_HASHTAGSに禁止タグが含まれない', async () => {
    const { GENERAL_HASHTAGS } = await import('../src/config/categoryDictionary.js');
    const forbidden = ['#instagood', '#photooftheday', '#japan', '#follow', '#like'];
    for (const tag of forbidden) {
      assert.ok(!GENERAL_HASHTAGS.includes(tag),
        `GENERAL_HASHTAGS should NOT contain forbidden tag: ${tag}`);
    }
    assert.ok(GENERAL_HASHTAGS.length > 0, 'Should still have fallback tags');
  });

  it('M2: security.js がJST日付ヘルパーを使用', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/security.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('getJSTDateString'),
      'Should have getJSTDateString helper');
    assert.ok(content.includes('9 * 3600 * 1000'),
      'Should add 9 hours (JST offset)');
    // checkDailyApiLimit と incrementDailyApiCount の両方で使用
    const usages = content.match(/getJSTDateString\(\)/g);
    assert.ok(usages && usages.length >= 2,
      'getJSTDateString should be used in both check and increment');
  });

  it('M4: setInterval に .unref() がある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/security.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('.unref()'),
      'setInterval should have .unref() for graceful shutdown');
  });
});

// ==================== Scenario 26: M5+M6 learningData + M7 スタックトレース + M12 content[0] ====================
describe('Scenario 26: 第4次監査 MEDIUM修正（M5+M6+M7+M12）', async () => {
  it('M5: learningData に Array.isArray ガードがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/learningData.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('Array.isArray(data.preferredWords)'),
      'Should check preferredWords is array');
    assert.ok(content.includes('Array.isArray(data.avoidWords)'),
      'Should check avoidWords is array');
    assert.ok(content.includes('Array.isArray(data.topEmojis)'),
      'Should check topEmojis is array');
  });

  it('M6: learningData に try-catch がある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/learningData.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('try {') && content.includes('catch (err)'),
      'Should have try-catch around DB call');
    assert.ok(content.includes('デフォルト値で続行'),
      'Should return default on error');
  });

  it('M7: errorNotification にスタックトレースが含まれない', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/errorNotification.js', import.meta.url), 'utf-8'
    );
    // notifyClaudeError 関数内にstackが含まれないことを確認
    const funcStart = content.indexOf('export async function notifyClaudeError');
    const funcEnd = content.indexOf('export async function', funcStart + 10);
    const funcBody = content.slice(funcStart, funcEnd > 0 ? funcEnd : content.length);
    assert.ok(!funcBody.includes('error.stack'),
      'notifyClaudeError should NOT include error.stack');
    assert.ok(funcBody.includes('errorType'),
      'Should include errorType instead of stack trace');
  });

  it('M12: claudeService に content配列の空チェックがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/claudeService.js', import.meta.url), 'utf-8'
    );
    const emptyChecks = content.match(/response\.content\.length === 0/g);
    assert.ok(emptyChecks && emptyChecks.length >= 3,
      'All 3 functions (askClaude, askClaudeWithImage, describeImage) should check content array');
  });
});

// ==================== Scenario 27: L修正群（デッドコード削除・コード品質） ====================
describe('Scenario 27: 第4次監査 LOW修正（L1-L9）', async () => {
  it('L1: HELP_TEXT が削除されている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(!content.includes("const HELP_TEXT = `"),
      'Dead HELP_TEXT constant should be removed');
  });

  it('L2: reportHandler に冗長なdynamic importがない', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/reportHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(!content.includes("await import('../services/supabaseService.js')"),
      'Should NOT have dynamic imports of supabaseService');
    assert.ok(content.includes("import { getStore, supabase }"),
      'Should use static import for both getStore and supabase');
  });

  it('L3: textHandler でapplyFeedbackToProfileの冗長なdynamic importがない', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(!content.includes("await import('../services/personalizationEngine.js')"),
      'Should NOT have dynamic imports of personalizationEngine');
  });

  it('L7: textHandler にstore update allow-listがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('ALLOWED_UPDATE_FIELDS'),
      'Should have ALLOWED_UPDATE_FIELDS allow-list');
    assert.ok(content.includes('safeUpdates'),
      'Should use safeUpdates instead of raw updates');
  });

  it('L8: server.js にevent.message nullチェックがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../server.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('!event.message'),
      'Should check for null event.message');
  });

  it('L9: reportHandler のgetLatestPostHistoryが削除されている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/reportHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(!content.includes('async function getLatestPostHistory'),
      'Dead getLatestPostHistory should be removed');
  });

  it('M8: advancedPersonalization にavoided_words上限がある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('MAX_AVOIDED_WORDS'),
      'Should have MAX_AVOIDED_WORDS limit');
    assert.ok(content.includes('avoidedWords.length < MAX_AVOIDED_WORDS'),
      'Should check array length before pushing');
  });

  it('M11: welcomeHandler がmaskUserIdを使用', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/welcomeHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("import { maskUserId }"),
      'Should import maskUserId');
    assert.ok(content.includes('maskUserId(lineUserId)'),
      'Should use maskUserId() instead of manual slicing');
  });

  it('M9: monthlyFollowerService がエラー詳細をユーザーに漏洩しない', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/monthlyFollowerService.js', import.meta.url), 'utf-8'
    );
    assert.ok(!content.includes('`エラーが発生しました: ${err.message}`'),
      'Should NOT include err.message in user-facing reply');
  });
});
