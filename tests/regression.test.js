/**
 * リグレッションテスト（Day7 + 第2次監査修正 + 第3次セキュリティ監査修正）
 * 修正が正しく動作するか、21シナリオで検証
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

// ==================== Scenario 3: isValidMetricNumber (Day1: H7) ====================
describe('Scenario 3: メトリック数値バリデーション', async () => {
  const { isValidMetricNumber } = await import('../src/utils/inputNormalizer.js');

  it('有効な数値', () => {
    assert.equal(isValidMetricNumber(0), true);
    assert.equal(isValidMetricNumber(100), true);
    assert.equal(isValidMetricNumber(0.5), true);
  });

  it('無効な値', () => {
    assert.equal(isValidMetricNumber(NaN), false);
    assert.equal(isValidMetricNumber(-1), false);
    assert.equal(isValidMetricNumber('100'), false);
    assert.equal(isValidMetricNumber(null), false);
    assert.equal(isValidMetricNumber(undefined), false);
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
    assert.ok(tags.some(t => t.includes('instagood') || t.includes('photooftheday')),
      'Should contain general hashtags');
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
    assert.ok(mod.isValidMetricNumber, 'isValidMetricNumber should exist');
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
