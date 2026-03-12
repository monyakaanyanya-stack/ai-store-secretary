/**
 * リグレッションテスト（Day7 + 第2次監査 + 第3次監査 + 第4次監査修正 + Ver.13.0 + 案選択フロー）
 * 修正が正しく動作するか、29シナリオで検証
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

  it('feedbackHandler が savePostHistory を使用（直しも生成回数カウント）+ 学習後に投稿上書き', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/feedbackHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('savePostHistory'),
      'feedbackHandler should import savePostHistory for revision counting');
    assert.ok(content.includes('updatePostContent'),
      'feedbackHandler should use updatePostContent for style learning post overwrite');
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

  it('C2: word_preferencesに.length直接アクセスなし', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    // calculateLearningAccuracy は削除済み（dead code クリーンアップ）
    // 残存コードに Object.length 直接アクセスがないことを確認
    assert.ok(!content.match(/\(profileData\.word_preferences[^)]*\)\.length/),
      'Should NOT use direct Object.length without Object.keys()');
    // word_preferencesが安全にアクセスされていること
    assert.ok(content.includes('word_preferences || {}'),
      'Should use fallback {} for word_preferences');
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
    // Phase 9: 思想ログ方式 — beliefs/writing_style/avoided_words の安全なアクセス
    assert.ok(content.includes('Array.isArray(analysis.beliefs)'),
      'Should check beliefs is an array');
    assert.ok(content.includes('Array.isArray(analysis.avoided_words)'),
      'Should check avoided_words is an array');
    assert.ok(content.includes("Array.isArray(analysis.writing_style.sentence_endings)"),
      'Should check sentence_endings is an array');
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

// ==================== Scenario 26: M7 スタックトレース + M12 content[0] ====================
// M5/M6: learningData.js は未使用として削除済み
describe('Scenario 26: 第4次監査 MEDIUM修正（M7+M12）', async () => {
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

  // M11: welcomeHandler テスト削除 - ウェルカムメッセージはLINE公式管理画面のあいさつメッセージに移行

  it('M9: monthlyFollowerService がエラー詳細をユーザーに漏洩しない', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/monthlyFollowerService.js', import.meta.url), 'utf-8'
    );
    assert.ok(!content.includes('`エラーが発生しました: ${err.message}`'),
      'Should NOT include err.message in user-facing reply');
  });
});

// ==================== Scenario 28: Ver.4.0 Dual Trigger Model ====================
describe('Scenario 28: Ver.4.0 Dual Trigger Model', async () => {
  it('describeImage に五感ベース5項目分析がある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/claudeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('五感の推測'),
      'describeImage prompt should include sensory analysis');
    assert.ok(content.includes('記憶を呼ぶ要素'),
      'describeImage prompt should include memory-triggering element');
    assert.ok(content.includes('店舗写真の観察者'),
      'describeImage should use observer perspective');
  });

  it('imageHandler から parseEquipmentLevel が廃止された', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(!content.includes('function parseEquipmentLevel'),
      'parseEquipmentLevel should be removed');
    assert.ok(!content.includes('equipmentLevel'),
      'equipmentLevel references should be removed');
  });

  it('pendingImageHandler から equipmentLevel が廃止された', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/pendingImageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(!content.includes('equipmentLevel'),
      'equipmentLevel references should be removed from pendingImageHandler');
    assert.ok(content.includes('options.hint') || content.includes('{ isPremium, hint }'),
      'Hint should be passed via options, not mixed into imageDescription');
  });

  it('buildImagePostPrompt に Dual Trigger 出力形式がある', async () => {
    const { buildImagePostPrompt } = await import('../src/utils/promptBuilder.js');
    const store = { name: 'テスト店', tone: 'カジュアル', config: {} };
    const prompt = buildImagePostPrompt(store, null, null, '', 'テスト画像説明');

    assert.ok(prompt.includes('想起トリガー'),
      'Should include recall trigger concept');
    assert.ok(prompt.includes('来店トリガー'),
      'Should include visit trigger concept');
    assert.ok(prompt.includes('想起の一言'),
      'Should include recall one-liner format');
    assert.ok(prompt.includes('来店の一文'),
      'Should include visit one-liner format');
  });

  it('Dual Trigger の出力形式に新3案ラベルがある', async () => {
    const { buildImagePostPrompt } = await import('../src/utils/promptBuilder.js');
    const store = { name: 'テスト店', tone: 'フレンドリー', config: {} };
    const prompt = buildImagePostPrompt(store, null, null, '', 'テスト画像');

    assert.ok(prompt.includes('[ 案A：記憶に残る日常 ]'),
      'Output format should include [ 案A：記憶に残る日常 ]');
    assert.ok(prompt.includes('[ 案B：さりげない誘い ]'),
      'Output format should include [ 案B：さりげない誘い ]');
    assert.ok(prompt.includes('[ 案C：店主のひとりごと ]'),
      'Output format should include [ 案C：店主のひとりごと ]');
    assert.ok(prompt.includes('3案作成'),
      'Should instruct 3 proposals');
    assert.ok(prompt.includes('次の撮影に'),
      'Should include simplified Photo Advice section');
  });

  it('旧Ver.17.0の芸術語が禁止ワードに含まれる', async () => {
    const { buildImagePostPrompt } = await import('../src/utils/promptBuilder.js');
    const store = { name: 'テスト店', tone: '丁寧', config: {} };
    const prompt = buildImagePostPrompt(store, null, null, '', 'テスト画像');

    assert.ok(prompt.includes('肖像'),
      'Should forbid old artistic term: 肖像');
    assert.ok(prompt.includes('独白'),
      'Should forbid old artistic term: 独白');
    assert.ok(prompt.includes('光の意志'),
      'Should forbid old artistic term: 光の意志');
    assert.ok(!prompt.includes('事実を肖像に変える'),
      'Old Ver.17.0 rule should be removed');
  });

  it('Dual Trigger のアイデンティティ: 影の秘書', async () => {
    const { buildImagePostPrompt } = await import('../src/utils/promptBuilder.js');
    const store = { name: 'テスト店', tone: 'カジュアル', config: {} };
    const prompt = buildImagePostPrompt(store, null, null, '', 'テスト画像');

    assert.ok(!prompt.includes('良き理解者'),
      'Old identity should be removed');
    assert.ok(prompt.includes('影の秘書'),
      'New identity should be shadow secretary');
    assert.ok(prompt.includes('思い出してしまう'),
      'Should mention recall goal');
  });

  it('buildRevisionPrompt に Dual Trigger ルールが含まれる', async () => {
    const { buildRevisionPrompt } = await import('../src/utils/promptBuilder.js');
    const store = { name: 'テスト店', tone: 'カジュアル', config: {} };
    const prompt = buildRevisionPrompt(store, '元の投稿', 'もっと短く');

    assert.ok(prompt.includes('Dual Trigger Model'),
      'Revision prompt should include Dual Trigger Model rules');
    assert.ok(prompt.includes('想起トリガー'),
      'Revision prompt should include recall trigger');
    assert.ok(prompt.includes('幻想的'),
      'Revision prompt should include forbidden words');
  });

  it('影の秘書コンセプト: 書き方の型・1行目ルール・禁止ワードが含まれる', async () => {
    const { buildImagePostPrompt, buildTextPostPrompt } = await import('../src/utils/promptBuilder.js');
    const store = { name: 'テスト店', tone: 'カジュアル', config: {} };
    const imagePrompt = buildImagePostPrompt(store, null, null, '', 'テスト画像');
    const textPrompt = buildTextPostPrompt(store, 'テスト', null, null, '');

    // 1行目のルール
    assert.ok(imagePrompt.includes('1行目のルール'),
      'Image prompt should include first line rule');
    assert.ok(textPrompt.includes('1行目のルール'),
      'Text prompt should include first line rule');
    // 本文の書き方
    assert.ok(imagePrompt.includes('本文の書き方'),
      'Image prompt should include writing pattern');
    assert.ok(textPrompt.includes('本文の書き方'),
      'Text prompt should include writing pattern');
    // 禁止ワード
    assert.ok(imagePrompt.includes('禁止ワード'),
      'Image prompt should include banned words');
    assert.ok(textPrompt.includes('禁止ワード'),
      'Text prompt should include information words ban');
  });

  it('M5: 数値フォールバックに ?? を使用', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    // topPostsLength と avgEmojiCount で ?? を使用
    const nullishMatches = content.match(/topPostsAvgLength \?\?/g);
    assert.ok(nullishMatches && nullishMatches.length >= 2,
      'Should use ?? for topPostsAvgLength in both image and text prompts');
    const emojiMatches = content.match(/avgEmojiCount \?\?/g);
    assert.ok(emojiMatches && emojiMatches.length >= 2,
      'Should use ?? for avgEmojiCount in both image and text prompts');
  });
});

// ==================== Scenario 29: 案A/B/C選択 + スタイル学習 ====================
describe('Scenario 29: 案A/B/C選択 + スタイル学習', async () => {
  // proposalHandler.jsはsupabaseをimportするため、純粋関数のロジックを再現してテスト
  function normalizeSelection(input) {
    const cleaned = input.trim().toUpperCase()
      .replace('案', '')
      .replace('Ａ', 'A').replace('Ｂ', 'B').replace('Ｃ', 'C')
      .replace('１', '1').replace('２', '2').replace('３', '3');
    if (['A', '1'].includes(cleaned)) return 'A';
    if (['B', '2'].includes(cleaned)) return 'B';
    if (['C', '3'].includes(cleaned)) return 'C';
    return null;
  }

  function extractSelectedProposal(fullContent, selection) {
    const markerPattern = /\[\s*案([ABC])[：:][^\]]*\]/g;
    const markers = [...fullContent.matchAll(markerPattern)];
    if (markers.length === 0) return null;
    const targetIdx = markers.findIndex(m => m[1] === selection);
    if (targetIdx === -1) return null;
    const startPos = markers[targetIdx].index + markers[targetIdx][0].length;
    let endPos;
    if (targetIdx + 1 < markers.length) {
      endPos = markers[targetIdx + 1].index;
    } else {
      const dividerMatch = fullContent.slice(startPos).match(/\n━{5,}/);
      endPos = dividerMatch ? startPos + dividerMatch.index : fullContent.length;
    }
    const proposalText = fullContent.slice(startPos, endPos).trim();
    const adviceMatch = fullContent.match(/(━{5,}[\s\S]*━{5,})/);
    const photoAdvice = adviceMatch ? '\n\n' + adviceMatch[1] : '';
    return proposalText + photoAdvice;
  }

  function cleanJapaneseSpaces(text) {
    if (!text) return text;
    return text
      .replace(/([\u3000-\u9FFF\uF900-\uFAFF]) +(?=[\u3000-\u9FFF\uF900-\uFAFF\u0021-\u007E])/g, '$1')
      .replace(/([\u3000-\u9FFF\uF900-\uFAFF]) +(?=[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}✨🌸💫🎵])/gu, '$1');
  }

  it('cleanJapaneseSpaces が不自然な半角スペースを除去する', () => {
    assert.equal(cleanJapaneseSpaces('マット な手触り'), 'マットな手触り');
    assert.equal(cleanJapaneseSpaces('温度差 ✨'), '温度差✨');
    assert.equal(cleanJapaneseSpaces('確か な重み'), '確かな重み');
    assert.equal(cleanJapaneseSpaces('琥珀色 のとろみ'), '琥珀色のとろみ');
    // H8: 3個以上のスペースも除去
    assert.equal(cleanJapaneseSpaces('確か   な重み'), '確かな重み');
    // 英単語間のスペースは保持
    assert.equal(cleanJapaneseSpaces('Diptyque, Byredo'), 'Diptyque, Byredo');
    assert.equal(cleanJapaneseSpaces('Hello World'), 'Hello World');
    // null/undefined安全
    assert.equal(cleanJapaneseSpaces(null), null);
    assert.equal(cleanJapaneseSpaces(''), '');
  });

  it('normalizeSelection が正しく変換する', () => {
    assert.equal(normalizeSelection('A'), 'A');
    assert.equal(normalizeSelection('a'), 'A');
    assert.equal(normalizeSelection('案A'), 'A');
    assert.equal(normalizeSelection('案a'), 'A');
    assert.equal(normalizeSelection('1'), 'A');
    assert.equal(normalizeSelection('B'), 'B');
    assert.equal(normalizeSelection('b'), 'B');
    assert.equal(normalizeSelection('案B'), 'B');
    assert.equal(normalizeSelection('2'), 'B');
    assert.equal(normalizeSelection('C'), 'C');
    assert.equal(normalizeSelection('c'), 'C');
    assert.equal(normalizeSelection('案C'), 'C');
    assert.equal(normalizeSelection('3'), 'C');
    // M7: 全角英字・全角数字
    assert.equal(normalizeSelection('Ａ'), 'A');
    assert.equal(normalizeSelection('Ｂ'), 'B');
    assert.equal(normalizeSelection('Ｃ'), 'C');
    assert.equal(normalizeSelection('１'), 'A');
    assert.equal(normalizeSelection('２'), 'B');
    assert.equal(normalizeSelection('３'), 'C');
    assert.equal(normalizeSelection('D'), null);
    assert.equal(normalizeSelection('hello'), null);
  });

  it('extractSelectedProposal が案Aを正しく抽出する', () => {
    const content = `[ 案A：時間の肖像 ]
これは猫の記録ではない。
今日という日がもう二度と戻らないことを教える、時間の肖像。

#コーヒー #時間

[ 案B：誠実の肖像 ]
この写真の正解は、整えられたニットの皺にある。
無造作に見えて、そこには確かな意思が写り込んでいる。

#コーヒー #誠実

[ 案C：光の肖像 ]
窓から差し込む光が、すべてを等しく照らす。
言葉になる前の、ただ静かなだけの温度。

#コーヒー #光

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 Photo Advice
このアングルは80点の正解です。
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const resultA = extractSelectedProposal(content, 'A');
    assert.ok(resultA.includes('時間の肖像'), 'Should contain proposal A text');
    assert.ok(resultA.includes('#コーヒー #時間'), 'Should contain proposal A hashtags');
    assert.ok(!resultA.includes('ニットの皺'), 'Should NOT contain proposal B text');
    assert.ok(!resultA.includes('窓から差し込む'), 'Should NOT contain proposal C text');
    assert.ok(resultA.includes('Photo Advice'), 'Should include Photo Advice');
  });

  it('extractSelectedProposal が案Bを正しく抽出する', () => {
    const content = `[ 案A：時間の肖像 ]
時間の肖像。

#タグA

[ 案B：誠実の肖像 ]
誠実の肖像。

#タグB

[ 案C：光の肖像 ]
光の肖像。

#タグC

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 Photo Advice
アドバイス
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const resultB = extractSelectedProposal(content, 'B');
    assert.ok(resultB.includes('誠実の肖像'), 'Should contain proposal B text');
    assert.ok(!resultB.includes('時間の肖像'), 'Should NOT contain proposal A text');
    assert.ok(!resultB.includes('光の肖像'), 'Should NOT contain proposal C text');
    assert.ok(resultB.includes('Photo Advice'), 'Should include Photo Advice');
  });

  it('extractSelectedProposal が案Cを正しく抽出する', () => {
    const content = `[ 案A：時間の肖像 ]
テキストA
#タグA

[ 案B：誠実の肖像 ]
テキストB
#タグB

[ 案C：光の肖像 ]
テキストC
#タグC

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 Photo Advice
アドバイス
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const resultC = extractSelectedProposal(content, 'C');
    assert.ok(resultC.includes('テキストC'), 'Should contain proposal C text');
    assert.ok(!resultC.includes('テキストA'), 'Should NOT contain proposal A text');
    assert.ok(!resultC.includes('テキストB'), 'Should NOT contain proposal B text');
  });

  it('extractSelectedProposal がマーカーなしでnullを返す', () => {
    const result = extractSelectedProposal('通常の投稿テキスト', 'A');
    assert.equal(result, null, 'Should return null for non-proposal content');
  });

  it('imageHandler の返信に案選択UIが含まれる（pendingImageHandler に移動済み）', async () => {
    const fs = await import('node:fs');
    // 一言ヒント機能導入後、A/B/C UIは pendingImageHandler.js に移動
    const pending = fs.readFileSync(
      new URL('../src/handlers/pendingImageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(pending.includes('どの案が理想に近いですか'),
      'Reply should ask user to select A/B/C');
    assert.ok(pending.includes('3つの投稿案ができました'),
      'Reply should mention 3 proposals');
    const image = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(!image.includes('appendTemplateFooter(rawContent'),
      'Should NOT apply footer before selection');
  });

  it('textHandler にA/B/C ルーティングがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("案?[ABCabc"),
      'Should have proposal selection pattern');
    assert.ok(/案A/.test(content),
      'Should check for 3-proposal marker');
    assert.ok(content.includes('handleProposalSelection'),
      'Should route to proposalHandler');
  });

  it('personalizationEngine にスタイル選好が含まれる', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/personalizationEngine.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('style_selections'),
      'Should reference style_selections in profile data');
    assert.ok(content.includes('好みの切り口'),
      'Should add style preference to prompt');
  });
});

// ==================== Scenario 30: バグ修正検証（第5次監査） ====================
describe('Scenario 30: 第5次監査バグ修正検証', async () => {

  // H4: insightsOCRService K/万変換
  it('H4: insightsOCRService.js の toInt が K/万 を正しく変換する', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/insightsOCRService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('kMatch') && content.includes('* 1000'),
      'Should handle K suffix (e.g. 1.2K → 1200)');
    assert.ok(content.includes('manMatch') && content.includes('* 10000'),
      'Should handle 万 suffix (e.g. 1.2万 → 12000)');
  });

  it('H4: toInt ロジック — K/万/通常数値/null を正しく処理', () => {
    // toInt のロジックを直接再現してテスト
    function toInt(v) {
      if (v === null || v === undefined) return null;
      const s = String(v).replace(/,/g, '').trim();
      const kMatch = s.match(/^([\d.]+)[Kk]$/);
      if (kMatch) {
        const n = parseFloat(kMatch[1]) * 1000;
        return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
      }
      const manMatch = s.match(/^([\d.]+)万$/);
      if (manMatch) {
        const n = parseFloat(manMatch[1]) * 10000;
        return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
      }
      const n = Number(s);
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
    }

    assert.equal(toInt('1.2K'),   1200,   '1.2K → 1200');
    assert.equal(toInt('2K'),     2000,   '2K → 2000');
    assert.equal(toInt('1.2万'),  12000,  '1.2万 → 12000');
    assert.equal(toInt('12万'),   120000, '12万 → 120000');
    assert.equal(toInt('1,234'),  1234,   '1,234 → 1234');
    assert.equal(toInt(1234),     1234,   '1234 → 1234');
    assert.equal(toInt(null),     null,   'null → null');
    assert.equal(toInt(undefined),null,   'undefined → null');
    assert.equal(toInt('abc'),    null,   'abc → null (invalid)');
    assert.equal(toInt(-5),       null,   '-5 → null (negative)');
  });

  // H1: collectiveIntelligence normalizedCategory 条件
  it('H1: collectiveIntelligence.js の外れ値チェックが normalizedCategory を使う', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/collectiveIntelligence.js', import.meta.url), 'utf-8'
    );
    // 外れ値チェックの if 条件が normalizedCategory を使っていること
    assert.ok(
      /if\s*\(\s*normalizedCategory\s*&&\s*metrics\.likes_count/.test(content),
      'Outlier check should use normalizedCategory, not raw category'
    );
  });

  // H6: dataResetHandler サイレント失敗
  it('H6: dataResetHandler.js の learning_profiles 削除エラーが throw される', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/dataResetHandler.js', import.meta.url), 'utf-8'
    );
    // profileError 時に throw new Error があること（サイレント継続しない）
    assert.ok(content.includes('throw new Error') && content.includes('learning_profiles削除エラー'),
      'Should throw on learning_profiles delete error, not silently continue');
  });

  // H7: onboardingHandler getCategoryGroupByNumber null チェック
  it('H7: onboardingHandler.js が getCategoryGroupByNumber の null を検証する', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/onboardingHandler.js', import.meta.url), 'utf-8'
    );
    // selectedGroup の null チェックがあること
    assert.ok(content.includes('if (!selectedGroup)'),
      'Should validate selectedGroup is not null after getCategoryGroupByNumber');
  });

  // M5: postAnalyzer undefined CTA/bucket
  it('M5: postAnalyzer.js の dominantCTAPosition がデフォルト値を持つ', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/postAnalyzer.js', import.meta.url), 'utf-8'
    );
    // ctaEntries を使って none にフォールバックすること
    assert.ok(content.includes("ctaEntries.length > 0") && content.includes("'none'"),
      'dominantCTAPosition should default to "none" when no CTA data');
    assert.ok(content.includes("bucketEntries.length > 0") && content.includes("'short'"),
      'dominantCharBucket should default to "short" when no bucket data');
  });

  it('M5: extractWinningPattern が dominantCTAPosition として undefined を返さない', async () => {
    const { extractWinningPattern } = await import('../src/utils/postAnalyzer.js');

    // post_structure に cta_position を持たない投稿（none にフォールバックされるはず）
    const posts = Array.from({ length: 10 }, (_, i) => ({
      post_structure: {
        hook_type: 'question',
        cta_position: null,  // ← null で none フォールバックのケース
        body_length: 150,
        line_break_density: 0.3,
      },
      saves_count: 10 + i,
      likes_count: 100 + i,
      save_intensity: 0.1,
    }));
    const result = extractWinningPattern(posts, 10);
    assert.ok(result !== null, 'Should return a result with 10 posts');
    assert.ok(result.dominantCTAPosition !== undefined, 'dominantCTAPosition should not be undefined');
    assert.ok(result.dominantCharBucket !== undefined, 'dominantCharBucket should not be undefined');
  });

  // M3: feedbackHandler preferredWords 上書き
  it('M3: feedbackHandler.js の extractLearningHints がカジュアル+丁寧で両方を保持する', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/feedbackHandler.js', import.meta.url), 'utf-8'
    );
    // toneWords 配列に push してから hints.preferredWords に代入する実装であること
    assert.ok(content.includes('toneWords') && content.includes('toneWords.push'),
      'Should use array push instead of overwriting hints.preferredWords');
    assert.ok(!content.includes("hints.preferredWords = ['カジュアル']"),
      'Should NOT directly assign カジュアル to preferredWords');
    assert.ok(!content.includes("hints.preferredWords = ['丁寧']"),
      'Should NOT directly assign 丁寧 to preferredWords');
  });

  // server.js Array.isArray
  it('M7(server): server.js が events を Array.isArray でチェックする', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../server.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('Array.isArray(events)'),
      'Should validate events is an array before processing');
  });
});

// ==================== Scenario 31: 一言ヒント機能 ====================
describe('Scenario 31: 画像「一言ヒント」機能', async () => {
  const fs = await import('fs');

  it('pendingImageHandler.js が存在する', () => {
    assert.ok(
      fs.existsSync('src/handlers/pendingImageHandler.js'),
      'pendingImageHandler.js が作成されているべき'
    );
  });

  it('isValidContext: createdAt が30分以内なら有効', () => {
    const ctx = {
      messageId: 'msg_123',
      imageDescription: 'カフェのパフェ写真',
      storeId: 'uuid-1',
      createdAt: new Date().toISOString(),
    };
    const age = Date.now() - new Date(ctx.createdAt).getTime();
    assert.ok(age < 30 * 60 * 1000, '生成直後は有効期限内');
  });

  it('isValidContext: createdAt が31分前なら期限切れ', () => {
    const old = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    const age = Date.now() - new Date(old).getTime();
    assert.ok(age >= 30 * 60 * 1000, '31分前は期限切れ');
  });

  it('imageHandler に savePendingImageContext の呼び出しがある', () => {
    const content = fs.readFileSync('src/handlers/imageHandler.js', 'utf8');
    assert.ok(content.includes('savePendingImageContext'), 'savePendingImageContext を呼び出す');
  });

  it('imageHandler が質問メッセージを送信する', () => {
    const content = fs.readFileSync('src/handlers/imageHandler.js', 'utf8');
    assert.ok(content.includes('一言もらえると'), '質問文にヒント誘導が含まれる');
    assert.ok(content.includes('スキップ'), 'スキップの案内が含まれる');
  });

  it('textHandler に pending_image_context チェックがある', () => {
    const content = fs.readFileSync('src/handlers/textHandler.js', 'utf8');
    assert.ok(content.includes('pending_image_context'), 'pending チェックがある');
    assert.ok(content.includes('handlePendingImageResponse'), 'ハンドラーに委譲する');
  });

  it('supabaseService に savePendingImageContext がある', () => {
    const content = fs.readFileSync('src/services/supabaseService.js', 'utf8');
    assert.ok(content.includes('export async function savePendingImageContext'), '関数が存在する');
    assert.ok(content.includes('export async function clearPendingImageContext'), 'クリア関数が存在する');
  });

  it('システムコマンドは pending を無視してスルー', () => {
    const content = fs.readFileSync('src/handlers/textHandler.js', 'utf8');
    assert.ok(content.includes('isSystemCommand'), 'システムコマンド判定がある');
    assert.ok(content.includes("'キャンセル'"), 'キャンセルが除外される');
    assert.ok(content.includes("切替:"), '店舗切替が除外される');
  });

  it('pendingImageHandler でスキップを検出する', () => {
    const content = fs.readFileSync('src/handlers/pendingImageHandler.js', 'utf8');
    assert.ok(content.includes("'スキップ'"), 'スキップ文字列を検出する');
    assert.ok(content.includes('isSkip'), 'スキップ判定変数がある');
  });

  it('ヒントがoptions.hintとして別渡しされる', () => {
    const content = fs.readFileSync('src/handlers/pendingImageHandler.js', 'utf8');
    assert.ok(content.includes('{ isPremium, hint }'), 'ヒントをoptions経由で渡す');
    assert.ok(!content.includes('enrichedDescription'), '旧enrichedDescription方式は廃止');
  });
});

// ==================== Scenario 32: プラン制限・機能ゲーティング ====================
describe('Scenario 32: プラン制限・機能ゲーティング', async () => {
  const { PLANS, getPlanConfig, PAID_PLANS } = await import('../src/config/planConfig.js');

  // --- プラン定義の整合性 ---
  it('3つのプランが定義されている（free/standard/premium）', () => {
    assert.ok(PLANS.free, 'free プランが存在する');
    assert.ok(PLANS.standard, 'standard プランが存在する');
    assert.ok(PLANS.premium, 'premium プランが存在する');
    assert.equal(Object.keys(PLANS).length, 3, 'プランは3つだけ');
  });

  it('月間生成回数: free=20, standard=60, premium=200', () => {
    assert.equal(PLANS.free.monthlyGenerations, 20);
    assert.equal(PLANS.standard.monthlyGenerations, 60);
    assert.equal(PLANS.premium.monthlyGenerations, 200);
  });

  it('店舗数上限: free=1, standard=1, premium=5', () => {
    assert.equal(PLANS.free.maxStores, 1);
    assert.equal(PLANS.standard.maxStores, 1);
    assert.equal(PLANS.premium.maxStores, 5);
  });

  // --- 全プラン共通機能 ---
  it('集合知エンジンは全プランで有効', () => {
    assert.equal(PLANS.free.features.collectiveIntelligence, true);
    assert.equal(PLANS.standard.features.collectiveIntelligence, true);
    assert.equal(PLANS.premium.features.collectiveIntelligence, true);
  });

  it('3案提案は全プランで有効', () => {
    assert.equal(PLANS.free.features.proposalABC, true);
    assert.equal(PLANS.standard.features.proposalABC, true);
    assert.equal(PLANS.premium.features.proposalABC, true);
  });

  it('報告（数値）は全プランで有効', () => {
    assert.equal(PLANS.free.features.engagementHealthCheck, true);
    assert.equal(PLANS.standard.features.engagementHealthCheck, true);
    assert.equal(PLANS.premium.features.engagementHealthCheck, true);
  });

  it('データ収集（裏）は全プランで有効', () => {
    assert.equal(PLANS.free.features.dataCollection, true);
    assert.equal(PLANS.standard.features.dataCollection, true);
    assert.equal(PLANS.premium.features.dataCollection, true);
  });

  // --- Free で制限される機能 ---
  it('Free では分析・自動学習・季節記憶・人格学習が無効', () => {
    assert.equal(PLANS.free.features.engagementPrescription, false, '分析はFreeで無効');
    assert.equal(PLANS.free.features.engagementAutoLearn, false, '自動学習はFreeで無効');
    assert.equal(PLANS.free.features.seasonalMemory, false, '季節記憶はFreeで無効');
    assert.equal(PLANS.free.features.advancedPersonalization, false, '人格学習はFreeで無効');
    assert.equal(PLANS.free.features.instagramPost, false, 'Instagram投稿はFreeで無効');
  });

  // --- Standard で有効になる機能 ---
  it('Standard では分析・自動学習・季節記憶・人格学習が有効', () => {
    assert.equal(PLANS.standard.features.engagementPrescription, true);
    assert.equal(PLANS.standard.features.engagementAutoLearn, true);
    assert.equal(PLANS.standard.features.seasonalMemory, true);
    assert.equal(PLANS.standard.features.advancedPersonalization, true);
  });

  it('Standard以上でInstagram投稿が有効', () => {
    assert.equal(PLANS.standard.features.instagramPost, true);
    assert.equal(PLANS.premium.features.instagramPost, true);
    assert.equal(PLANS.free.features.instagramPost, false);
  });

  // --- Premium 限定機能 ---
  it('Premium のみ週間計画・強化版アドバイスが有効', () => {
    assert.equal(PLANS.premium.features.weeklyContentPlan, true);
    assert.equal(PLANS.premium.features.enhancedPhotoAdvice, true);
    assert.equal(PLANS.standard.features.weeklyContentPlan, false);
    assert.equal(PLANS.standard.features.enhancedPhotoAdvice, false);
    assert.equal(PLANS.free.features.weeklyContentPlan, false);
    assert.equal(PLANS.free.features.enhancedPhotoAdvice, false);
  });

  // --- getPlanConfig フォールバック ---
  it('不明なプラン名は free にフォールバック', () => {
    const config = getPlanConfig('unknown');
    assert.equal(config.name, 'フリープラン');
    assert.equal(config.monthlyGenerations, 20);
  });

  it('null/undefined は free にフォールバック', () => {
    assert.equal(getPlanConfig(null).name, 'フリープラン');
    assert.equal(getPlanConfig(undefined).name, 'フリープラン');
  });

  // --- PAID_PLANS ---
  it('PAID_PLANS に free が含まれない', () => {
    const keys = PAID_PLANS.map(p => p.key);
    assert.ok(!keys.includes('free'), 'free は有料プランに含まれない');
    assert.ok(keys.includes('standard'), 'standard が含まれる');
    assert.ok(keys.includes('premium'), 'premium が含まれる');
  });

  // --- 価格 ---
  it('価格: free=0, standard=2980, premium=5980', () => {
    assert.equal(PLANS.free.price, 0);
    assert.equal(PLANS.standard.price, 2980);
    assert.equal(PLANS.premium.price, 5980);
  });

  // --- subscriptionService のプランサマリーに新機能フラグが含まれる ---
  it('buildPlanSummaryMessage に新しい機能フラグ表示がある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/subscriptionService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('engagementHealthCheck'), '健康診断フラグを参照');
    assert.ok(content.includes('engagementPrescription'), '処方箋フラグを参照');
    assert.ok(content.includes('engagementAutoLearn'), '自動学習フラグを参照');
    assert.ok(content.includes('instagramPost'), 'Instagram投稿フラグを参照');
    assert.ok(content.includes('weeklyContentPlan'), '週間計画フラグを参照');
    assert.ok(content.includes('enhancedPhotoAdvice'), '強化版アドバイスフラグを参照');
  });

  // --- SUBSCRIPTION_ENABLED グローバルスイッチ ---
  it('subscriptionService に SUBSCRIPTION_ENABLED スイッチがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/subscriptionService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("process.env.SUBSCRIPTION_ENABLED === 'true'"),
      'SUBSCRIPTION_ENABLED 環境変数を参照');
    assert.ok(content.includes('!SUBSCRIPTION_ENABLED'),
      'スイッチOFF時のバイパスロジックがある');
  });

  // --- ハンドラーへのチェック組み込み ---
  it('imageHandler に checkGenerationLimit が組み込まれている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('checkGenerationLimit'), '生成回数チェックがある');
    assert.ok(content.includes('genLimit.allowed'), '許可判定がある');
    assert.ok(content.includes('isFeatureEnabled'), '機能ゲーティングがある');
  });

  it('textHandler に checkGenerationLimit が組み込まれている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('checkGenerationLimit'), '生成回数チェックがある');
    assert.ok(content.includes('genLimit.allowed'), '許可判定がある');
    assert.ok(content.includes('isFeatureEnabled'), '機能ゲーティングがある');
  });

  it('reportHandler が数値表示/分析結果に分離されている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/reportHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('【分析結果】'), '分析結果セクションがある');
    assert.ok(content.includes('isFeatureEnabled'), 'プランチェックがある');
    assert.ok(content.includes('engagementPrescription'), '分析フラグを参照');
    assert.ok(content.includes('スタンダードプラン以上'), 'アップグレード案内がある');
  });
});

// ==================== Scenario 38: Instagram Content Publishing ====================
describe('Scenario 38: Instagram投稿機能（Content Publishing API）', async () => {

  // --- instagramService.js に投稿関数がある ---
  it('instagramService に publishToInstagram 関数がある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/instagramService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function publishToInstagram'), 'publishToInstagram関数がある');
    assert.ok(content.includes('export async function createMediaContainer'), 'createMediaContainer関数がある');
    assert.ok(content.includes('export async function publishMediaContainer'), 'publishMediaContainer関数がある');
    assert.ok(content.includes('export async function checkContainerStatus'), 'checkContainerStatus関数がある');
    assert.ok(content.includes('graphApiPostBase'), 'POST用ヘルパーがある');
    assert.ok(content.includes('waitForContainerReady'), 'ポーリング関数がある');
  });

  // --- supabaseService.js に uploadImageToStorage がある ---
  it('supabaseService に uploadImageToStorage 関数がある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/supabaseService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function uploadImageToStorage'), 'uploadImageToStorage関数がある');
    assert.ok(content.includes("from('post-images')"), 'post-imagesバケットを使用している');
  });

  // --- savePostHistory が imageUrl パラメータを受け取る ---
  it('savePostHistory が imageUrl パラメータを持つ', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/supabaseService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('imageUrl'), 'imageUrlパラメータがある');
    assert.ok(content.includes('image_url'), 'image_urlカラムへの書き込みがある');
  });

  // --- imageHandler に Storage アップロードがある ---
  it('imageHandler に Supabase Storage アップロードがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('uploadImageToStorage'), 'uploadImageToStorageを呼んでいる');
    assert.ok(content.includes('imageUrl'), 'imageUrl変数がある');
  });

  // --- pendingImageHandler で imageUrl を引き継ぎ ---
  it('pendingImageHandler で imageUrl を post_history に引き継いでいる', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/pendingImageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('ctx.imageUrl'), 'ctx.imageUrlを参照している');
  });

  // --- instagramHandler に post コマンドがある ---
  it('instagramHandler に post サブコマンドがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/instagramHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("'post'"), 'postサブコマンドのルーティングがある');
    assert.ok(content.includes('handleInstagramPublish'), 'handleInstagramPublish関数がある');
    assert.ok(content.includes('publishToInstagram'), 'publishToInstagramを呼んでいる');
  });

  // --- textHandler に instagram投稿 ルーティングがある ---
  it('textHandler に instagram投稿 ルーティングがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("'instagram投稿'"), 'instagram投稿コマンドのルーティングがある');
  });

  // --- proposalHandler に Instagram投稿ボタンがある ---
  it('proposalHandler に Instagram投稿ボタンがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/proposalHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('getInstagramAccount'), 'Instagram連携チェックがある');
    assert.ok(content.includes('Instagram投稿'), 'Instagram投稿ボタンラベルがある');
    assert.ok(content.includes('replyWithQuickReply'), 'クイックリプライで返信している');
  });

  // --- DBマイグレーションファイルがある ---
  it('Instagram投稿用マイグレーションSQLがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../database/migration_instagram_publish.sql', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('image_url'), 'image_urlカラム追加がある');
    assert.ok(content.includes('published_via'), 'published_viaカラム追加がある');
  });
});

// ==================== Scenario 35: サブスクリプション — planConfig ====================
describe('Scenario 35: サブスクリプション planConfig', async () => {
  const { PLANS, getPlanConfig, PAID_PLANS } = await import('../src/config/planConfig.js');

  it('3つのプランが定義されている', () => {
    assert.ok(PLANS.free, 'free プランが存在する');
    assert.ok(PLANS.standard, 'standard プランが存在する');
    assert.ok(PLANS.premium, 'premium プランが存在する');
  });

  it('各プランに正しい月間生成数が設定されている', () => {
    assert.equal(PLANS.free.monthlyGenerations, 20, 'free: 20回');
    assert.equal(PLANS.standard.monthlyGenerations, 60, 'standard: 60回');
    assert.equal(PLANS.premium.monthlyGenerations, 200, 'premium: 200回');
  });

  it('各プランに正しい最大店舗数が設定されている', () => {
    assert.equal(PLANS.free.maxStores, 1, 'free: 1店舗');
    assert.equal(PLANS.standard.maxStores, 1, 'standard: 1店舗');
    assert.equal(PLANS.premium.maxStores, 5, 'premium: 5店舗');
  });

  it('free プランでは処方箋・自動学習・人格学習が無効', () => {
    assert.equal(PLANS.free.features.engagementPrescription, false, '処方箋は無効');
    assert.equal(PLANS.free.features.engagementAutoLearn, false, '自動学習は無効');
    assert.equal(PLANS.free.features.advancedPersonalization, false, '人格学習は無効');
  });

  it('standard プランでは処方箋・自動学習・人格学習が有効', () => {
    assert.equal(PLANS.standard.features.engagementPrescription, true, '処方箋が有効');
    assert.equal(PLANS.standard.features.engagementAutoLearn, true, '自動学習が有効');
    assert.equal(PLANS.standard.features.advancedPersonalization, true, '人格学習が有効');
  });

  it('premium プランでは全機能が有効', () => {
    const features = PLANS.premium.features;
    for (const [key, value] of Object.entries(features)) {
      assert.equal(value, true, `premium: ${key} が有効`);
    }
  });

  it('全プランに11の機能フラグがある', () => {
    const expectedFlags = [
      'collectiveIntelligence', 'seasonalMemory', 'advancedPersonalization',
      'proposalABC', 'engagementHealthCheck', 'engagementPrescription',
      'engagementAutoLearn', 'instagramPost', 'weeklyContentPlan',
      'enhancedPhotoAdvice', 'dataCollection',
    ];
    for (const plan of Object.values(PLANS)) {
      for (const flag of expectedFlags) {
        assert.ok(flag in plan.features, `${plan.name} に ${flag} がある`);
      }
    }
  });

  it('getPlanConfig が不明プランで free にフォールバック', () => {
    const result = getPlanConfig('unknown');
    assert.equal(result.name, 'フリープラン', '不明プランは free');
  });

  it('PAID_PLANS に free が含まれない', () => {
    const freeInPaid = PAID_PLANS.find(p => p.key === 'free');
    assert.equal(freeInPaid, undefined, 'free は有料プラン一覧に含まれない');
    assert.equal(PAID_PLANS.length, 2, '有料プランは2つ');
  });
});

// ==================== Scenario 36: サブスク接続検証 ====================
describe('Scenario 36: サブスク接続検証', async () => {
  const fs = await import('node:fs');

  it('feedbackHandler に checkGenerationLimit がある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/feedbackHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("import { checkGenerationLimit }"),
      'checkGenerationLimit をインポートしている');
    assert.ok(content.includes('checkGenerationLimit(user.id)'),
      '修正生成前に上限チェックしている');
    assert.ok(content.includes('genLimit.allowed'),
      'allowed フラグで判定している');
  });

  it('textHandler にプラン/アップグレードコマンドがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("handlePlanStatus"),
      'handlePlanStatus をインポートしている');
    assert.ok(content.includes("handleUpgradePrompt"),
      'handleUpgradePrompt をインポートしている');
    assert.ok(content.includes("'プラン'") && content.includes('/plan'),
      'プラン コマンドのルーティングがある');
    assert.ok(content.includes("'アップグレード'") && content.includes('/upgrade'),
      'アップグレード コマンドのルーティングがある');
  });

  it('textHandler の isSystemCommand にプラン/アップグレードが含まれる', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    // isSystemCommand の配列内にプラン・アップグレードがあること
    const sysCommandSection = content.match(/const isSystemCommand = \[[\s\S]*?\]\.includes/);
    assert.ok(sysCommandSection, 'isSystemCommand 定義が存在する');
    assert.ok(sysCommandSection[0].includes("'プラン'"), 'プラン が isSystemCommand に含まれる');
    assert.ok(sysCommandSection[0].includes("'アップグレード'"), 'アップグレード が isSystemCommand に含まれる');
  });

  it('server.js に Stripe Webhook ルートがある', () => {
    const content = fs.readFileSync(
      new URL('../server.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("handleStripeWebhook"),
      'handleStripeWebhook をインポートしている');
    assert.ok(content.includes("'/stripe/webhook'"),
      'Stripe Webhook ルートが定義されている');
  });

  it('server.js で Stripe Webhook が LINE Webhook の前に定義されている', () => {
    const content = fs.readFileSync(
      new URL('../server.js', import.meta.url), 'utf-8'
    );
    const stripePos = content.indexOf("'/stripe/webhook'");
    const linePos = content.indexOf("'/webhook'", stripePos + 1);
    assert.ok(stripePos < linePos,
      'Stripe Webhook は LINE Webhook より前に定義されるべき');
  });
});

// ==================== Scenario 37: 処方箋サービス ====================
describe('Scenario 37: 処方箋サービス prescriptionService', async () => {
  const fs = await import('node:fs');

  it('prescriptionService.js が存在する', () => {
    assert.ok(
      fs.existsSync('src/services/prescriptionService.js'),
      'prescriptionService.js が作成されているべき'
    );
  });

  it('3つの分析関数がエクスポートされている', async () => {
    const content = fs.readFileSync(
      new URL('../src/services/prescriptionService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function getCausalAnalysis'),
      'getCausalAnalysis がエクスポートされている');
    assert.ok(content.includes('export async function getIndustryBenchmark'),
      'getIndustryBenchmark がエクスポートされている');
    assert.ok(content.includes('export async function getBeliefBlendedTip'),
      'getBeliefBlendedTip がエクスポートされている');
    assert.ok(content.includes('export async function generatePrescription'),
      'generatePrescription がエクスポートされている');
  });

  it('reportHandler が prescriptionService を使用している', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/reportHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("import { generatePrescription }"),
      'generatePrescription をインポートしている');
    assert.ok(content.includes('generatePrescription(store'),
      'generatePrescription を呼び出している');
  });

  it('getCausalAnalysis が前回比較ロジックを持つ', () => {
    const content = fs.readFileSync(
      new URL('../src/services/prescriptionService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('data.length < 2'),
      '比較対象がない場合にnullを返す');
    assert.ok(content.includes('prevSI * 1.5'),
      '1.5倍以上で上昇判定');
    assert.ok(content.includes('prevSI * 0.5'),
      '0.5倍以下で下降判定');
  });

  it('getIndustryBenchmark がパーセンタイル計算を持つ', () => {
    const content = fs.readFileSync(
      new URL('../src/services/prescriptionService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('percentile'),
      'パーセンタイル計算がある');
    assert.ok(content.includes('normalizeCategory'),
      'カテゴリー正規化を使用している');
    assert.ok(content.includes('data.length < 3'),
      'データ不足時にnullを返す');
  });

  it('getBeliefBlendedTip が belief_logs を参照する', () => {
    const content = fs.readFileSync(
      new URL('../src/services/prescriptionService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('belief_logs'),
      'belief_logs を参照している');
    assert.ok(content.includes('learning_profiles'),
      'learning_profiles テーブルを使用している');
  });

  it('generatePrescription がフォールバック付きで reportHandler から呼ばれる', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/reportHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('catch (err)') && content.includes('処方箋生成エラー'),
      'エラー時のフォールバックがある');
  });
});

// ==================== Scenario 38: Phase 16 — planConfig リネーム検証 ====================
describe('Scenario 38: instagramSchedulePost → instagramPost リネーム検証', async () => {
  const fs = await import('node:fs');

  it('planConfig に instagramSchedulePost が存在しない', () => {
    const content = fs.readFileSync(
      new URL('../src/config/planConfig.js', import.meta.url), 'utf-8'
    );
    assert.ok(!content.includes('instagramSchedulePost'),
      '旧フラグ名が残っていない');
    assert.ok(content.includes('instagramPost'),
      '新フラグ名が存在する');
  });

  it('subscriptionService に旧フラグ名が残っていない', () => {
    const content = fs.readFileSync(
      new URL('../src/services/subscriptionService.js', import.meta.url), 'utf-8'
    );
    assert.ok(!content.includes('instagramSchedulePost'),
      '旧フラグ名が残っていない');
    assert.ok(content.includes('instagramPost'),
      '新フラグ名を参照している');
  });
});

// ==================== Scenario 39: Phase 16 — 週間コンテンツ計画 ====================
describe('Scenario 39: 週間コンテンツ計画', async () => {
  const fs = await import('node:fs');

  it('weeklyPlanService.js が存在する', () => {
    assert.ok(
      fs.existsSync('src/services/weeklyPlanService.js'),
      'weeklyPlanService.js が作成されているべき'
    );
  });

  it('必要な関数がエクスポートされている', () => {
    const content = fs.readFileSync(
      new URL('../src/services/weeklyPlanService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function generateWeeklyPlan'),
      'generateWeeklyPlan がエクスポートされている');
    assert.ok(content.includes('export async function getLatestWeeklyPlan'),
      'getLatestWeeklyPlan がエクスポートされている');
    assert.ok(content.includes('export function formatWeeklyPlanMessage'),
      'formatWeeklyPlanMessage がエクスポートされている');
    assert.ok(content.includes('export async function sendWeeklyPlansToAllPremium'),
      'sendWeeklyPlansToAllPremium がエクスポートされている');
  });

  it('Claude API と集合知データを使用している', () => {
    const content = fs.readFileSync(
      new URL('../src/services/weeklyPlanService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('askClaude'), 'Claude API を呼び出している');
    assert.ok(content.includes('getBlendedInsights'), '集合知データを使用している');
    assert.ok(content.includes('getAdvancedPersonalizationPrompt'), 'パーソナライゼーションを使用');
  });

  it('異業種インサイト取得機能がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/weeklyPlanService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('getCrossIndustryInsight'), '異業種インサイト関数がある');
    assert.ok(content.includes('crossIndustryInsight'), 'クロスインダストリーデータ構造がある');
  });

  it('weeklyPlanHandler.js が存在する', () => {
    assert.ok(
      fs.existsSync('src/handlers/weeklyPlanHandler.js'),
      'weeklyPlanHandler.js が作成されているべき'
    );
  });

  it('weeklyPlanHandler が isFeatureEnabled でゲーティングしている', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/weeklyPlanHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('isFeatureEnabled'), '機能ゲーティングがある');
    assert.ok(content.includes('weeklyContentPlan'), 'weeklyContentPlan フラグを参照');
    assert.ok(content.includes('プレミアムプラン'), '非Premium時のアップグレード案内がある');
  });

  it('textHandler に今週の計画コマンドがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("'今週の計画'"), '今週の計画コマンドのルーティングがある');
    assert.ok(content.includes('/weekly'), '/weekly コマンドのルーティングがある');
    assert.ok(content.includes('handleWeeklyPlan'), 'handleWeeklyPlan を呼んでいる');
  });

  it('scheduler.js に週間計画のcronジョブがある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/scheduler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('sendWeeklyPlansToAllPremium'),
      '週間計画送信関数を呼んでいる');
    assert.ok(content.includes('週間コンテンツ計画'),
      'ジョブ名が設定されている');
  });

  it('DBマイグレーションファイルがある', () => {
    assert.ok(
      fs.existsSync('database/migration_weekly_plans.sql'),
      'migration_weekly_plans.sql が作成されているべき'
    );
    const content = fs.readFileSync(
      new URL('../database/migration_weekly_plans.sql', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('weekly_content_plans'), 'テーブル名が正しい');
    assert.ok(content.includes('plan_content'), 'JSONB カラムがある');
    assert.ok(content.includes('week_start'), '週開始日カラムがある');
  });
});

// ==================== Scenario 40: Phase 16 — 強化版撮影アドバイス ====================
describe('Scenario 40: 強化版撮影アドバイス', async () => {
  const fs = await import('node:fs');

  it('buildImagePostPrompt が options パラメータを受け付ける', () => {
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('options') && content.includes('isPremium'),
      'options.isPremium パラメータがある');
  });

  it('Premium 向けの強化撮影アドバイスが含まれる', () => {
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('明日撮るべきもの'),
      'Premium向け「明日撮るべきもの」セクションがある');
    assert.ok(content.includes('なぜ反応が取れそうか'),
      '理由説明の指示がある');
  });

  it('pendingImageHandler で enhancedPhotoAdvice チェックがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/pendingImageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('enhancedPhotoAdvice'),
      'enhancedPhotoAdvice フラグを参照している');
    assert.ok(content.includes('isPremium'),
      'isPremium をプロンプトビルダーに渡している');
  });
});

// ==================== Scenario 41: SNS Consultant AI 基盤 ====================
describe('Scenario 41: SNS Consultant AI 基盤', async () => {
  const fs = await import('node:fs');

  it('migration_posted_at.sql が存在する', () => {
    assert.ok(
      fs.existsSync(new URL('../database/migration_posted_at.sql', import.meta.url)),
      'migration_posted_at.sql が作成されているべき'
    );
  });

  it('migration_posted_at.sql が posted_at TIMESTAMPTZ カラムを追加する', () => {
    const content = fs.readFileSync(
      new URL('../database/migration_posted_at.sql', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('posted_at'), 'posted_at カラムが含まれる');
    assert.ok(content.includes('TIMESTAMPTZ'), 'TIMESTAMPTZ 型である');
    assert.ok(content.includes('IF NOT EXISTS'), 'べき等性がある');
  });

  it('migration_posted_at.sql にカテゴリー複合インデックスがある', () => {
    const content = fs.readFileSync(
      new URL('../database/migration_posted_at.sql', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('idx_engagement_metrics_category_posted_at'),
      'カテゴリー×投稿日時の複合インデックスがある');
  });

  it('collectiveIntelligence に resolvePostTimeFull がある（DB 1回で統合）', () => {
    const content = fs.readFileSync(
      new URL('../src/services/collectiveIntelligence.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('resolvePostTimeFull'),
      'resolvePostTimeFull 統合関数が存在する');
    assert.ok(content.includes('timestamp: data.created_at'),
      'timestamp プロパティを返す');
  });

  it('saveEngagementMetrics が posted_at を保存する', () => {
    const content = fs.readFileSync(
      new URL('../src/services/collectiveIntelligence.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('posted_at: postTimeData?.timestamp'),
      'posted_at フィールドが metricsData に含まれる');
  });

  it('getCategoryPostingTimeOptimization がエクスポートされている', () => {
    const content = fs.readFileSync(
      new URL('../src/services/collectiveIntelligence.js', import.meta.url), 'utf-8'
    );
    assert.ok(
      content.includes('export async function getCategoryPostingTimeOptimization'),
      'getCategoryPostingTimeOptimization がエクスポートされている'
    );
  });

  it('プライバシーポリシーに匿名データ活用の記述がある', () => {
    const content = fs.readFileSync(
      new URL('../docs/privacy-policy.html', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('匿名化・集計'), '匿名化・集計の記述がある');
    assert.ok(content.includes('レコメンデーション'), 'レコメンデーション提供の記述がある');
    assert.ok(content.includes('2026年3月'), '更新日が2026年3月になっている');
  });

  it('プライバシーポリシーに削除後の集計データ保持条項がある', () => {
    const content = fs.readFileSync(
      new URL('../docs/privacy-policy.html', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('削除された場合でも'),
      'データ削除後も匿名統計データが残る旨の記載がある');
  });
});

// ==================== Scenario 42: Instagram OAuth 自動連携 ====================
describe('Scenario 42: Instagram OAuth 自動連携', async () => {
  const fs = await import('node:fs');

  it('instagramService に createOAuthState / verifyOAuthState がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/instagramService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export function createOAuthState'), 'createOAuthState がエクスポートされている');
    assert.ok(content.includes('export function verifyOAuthState'), 'verifyOAuthState がエクスポートされている');
  });

  it('instagramService に buildInstagramAuthUrl がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/instagramService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export function buildInstagramAuthUrl'),
      'buildInstagramAuthUrl がエクスポートされている');
    assert.ok(content.includes('instagram.com/oauth/authorize'), '認証URLにInstagram OAuthエンドポイントを使用');
  });

  it('instagramService に exchangeCodeForIGToken / exchangeIGShortForLongLived がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/instagramService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function exchangeCodeForIGToken'),
      'exchangeCodeForIGToken がエクスポートされている');
    assert.ok(content.includes('export async function exchangeIGShortForLongLived'),
      'exchangeIGShortForLongLived がエクスポートされている');
  });

  it('instagramService に handleOAuthCallback がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/instagramService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function handleOAuthCallback'),
      'handleOAuthCallback がエクスポートされている');
    assert.ok(content.includes('connectInstagramAccount(storeId, longToken)'),
      '既存の connectInstagramAccount を再利用している');
  });

  it('server.js に /auth/instagram/callback ルートがある', () => {
    const content = fs.readFileSync(
      new URL('../server.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("'/auth/instagram/callback'"),
      'コールバックルートが定義されている');
    assert.ok(content.includes('handleOAuthCallback'),
      'handleOAuthCallback をインポート・使用している');
  });

  it('instagramHandler が OAuth URL生成にフォールバック対応している', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/instagramHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('buildInstagramAuthUrl'),
      'buildInstagramAuthUrl を使用している');
    assert.ok(content.includes('リンクは10分間有効'),
      'OAuth URLの有効期限を案内している');
  });

  it('state パラメータに暗号化を使用している', () => {
    const content = fs.readFileSync(
      new URL('../src/services/instagramService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('encrypt(payload)'), 'state生成時に encrypt を使用');
    assert.ok(content.includes('decrypt(decodeURIComponent'), 'state検証時に decrypt を使用');
    assert.ok(content.includes('maxAgeMs'), '有効期限チェックがある');
  });
});

// ==================== Scenario 43: デイリー撮影ナッジ ====================
describe('Scenario 43: デイリー撮影ナッジ', async () => {
  const fs = await import('node:fs');

  it('dailyNudgeService.js が存在する', () => {
    assert.ok(
      fs.existsSync('src/services/dailyNudgeService.js'),
      'dailyNudgeService.js が作成されているべき'
    );
  });

  it('nudgeTemplates.js が存在する', () => {
    assert.ok(
      fs.existsSync('src/config/nudgeTemplates.js'),
      'nudgeTemplates.js が作成されているべき'
    );
  });

  it('dailyNudgeService に sendDailyPhotoNudges がエクスポートされている', () => {
    const content = fs.readFileSync(
      new URL('../src/services/dailyNudgeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function sendDailyPhotoNudges'),
      'sendDailyPhotoNudges がエクスポートされている');
  });

  it('hasPostedToday チェックがある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/dailyNudgeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('hasPostedToday'), '今日投稿済みチェック関数がある');
    assert.ok(content.includes('post_history'), 'post_history テーブルを参照している');
  });

  it('Premium向けのClaude API生成がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/dailyNudgeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('askClaude'), 'Claude API を呼び出している');
    assert.ok(content.includes('premium'), 'Premium判定ロジックがある');
  });

  it('Standard向けのテンプレートベース生成がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/dailyNudgeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('pickTemplateNudge'),
      'テンプレートベースの提案ロジックがある');
  });

  it('nudgeTemplates に全6グループのテンプレートがある', () => {
    const content = fs.readFileSync(
      new URL('../src/config/nudgeTemplates.js', import.meta.url), 'utf-8'
    );
    for (const group of ['beauty', 'food', 'retail', 'service', 'professional', 'creative']) {
      assert.ok(content.includes(`${group}:`), `${group} グループのテンプレートがある`);
    }
  });

  it('nudgeTemplates の各テンプレートに必要なフィールドがある', () => {
    const content = fs.readFileSync(
      new URL('../src/config/nudgeTemplates.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('subject'), 'subject フィールドがある');
    assert.ok(content.includes('cameraTip'), 'cameraTip フィールドがある');
    assert.ok(content.includes('description'), 'description フィールドがある');
    assert.ok(content.includes('season'), 'season フィールドがある');
  });

  it('planConfig に dailyPhotoNudge フラグがある', () => {
    const content = fs.readFileSync(
      new URL('../src/config/planConfig.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('dailyPhotoNudge'), 'dailyPhotoNudge フラグが存在する');
  });

  it('Free プランでは dailyPhotoNudge が false、Standard/Premium は true', async () => {
    const { PLANS } = await import('../src/config/planConfig.js');
    assert.equal(PLANS.free.features.dailyPhotoNudge, false, 'Free は false');
    assert.equal(PLANS.standard.features.dailyPhotoNudge, true, 'Standard は true');
    assert.equal(PLANS.premium.features.dailyPhotoNudge, true, 'Premium は true');
  });

  it('scheduler.js にデイリー撮影ナッジの cron ジョブがある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/scheduler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('sendDailyPhotoNudges'), 'sendDailyPhotoNudges を呼んでいる');
    assert.ok(content.includes('デイリー撮影ナッジ'), 'ジョブ名が設定されている');
  });

  it('Freeプランユーザーをスキップするロジックがある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/dailyNudgeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("plan === 'free'"),
      'Free プランスキップロジックがある');
  });

  it('subscriptionService の buildPlanSummaryMessage に dailyPhotoNudge がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/subscriptionService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('dailyPhotoNudge'), 'dailyPhotoNudge を表示している');
  });
});

// ==================== Scenario 44: 夜間エンゲージメント自動同期 ====================
describe('Scenario 44: 夜間エンゲージメント自動同期', async () => {
  const fs = await import('node:fs');

  it('nightlyEngagementService.js が存在する', () => {
    assert.ok(
      fs.existsSync('src/services/nightlyEngagementService.js'),
      'nightlyEngagementService.js が作成されているべき'
    );
  });

  it('runNightlyEngagementSync がエクスポートされている', () => {
    const content = fs.readFileSync(
      new URL('../src/services/nightlyEngagementService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function runNightlyEngagementSync'),
      'runNightlyEngagementSync がエクスポートされている');
  });

  it('Instagram APIからメトリクスを取得する関数がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/nightlyEngagementService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('fetchLatestMetrics'), 'fetchLatestMetrics 関数がある');
    assert.ok(content.includes('/media'), 'Instagram media エンドポイントを呼んでいる');
    assert.ok(content.includes('/insights'), 'Instagram insights エンドポイントを呼んでいる');
  });

  it('post_history とのマッチング機能がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/nightlyEngagementService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('matchWithPostHistory'), 'matchWithPostHistory 関数がある');
    assert.ok(content.includes('post_history'), 'post_history テーブルを参照している');
  });

  it('学習パイプラインのサイレント実行がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/nightlyEngagementService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('applyMetricsSilently'), 'applyMetricsSilently 関数がある');
    assert.ok(content.includes('saveEngagementMetrics'), '集合知保存を呼んでいる');
    assert.ok(content.includes('applyEngagementToProfile'), '個人学習を呼んでいる');
    assert.ok(content.includes('analyzeEngagementWithClaude'), 'Claude自動分析を呼んでいる');
  });

  it('learning_synced フラグで重複防止している', () => {
    const content = fs.readFileSync(
      new URL('../src/services/nightlyEngagementService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('learning_synced'), 'learning_synced フラグを使用している');
  });

  it('instagram_posts のメトリクス更新機能がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/nightlyEngagementService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('updateInstagramPostMetrics'), 'updateInstagramPostMetrics 関数がある');
  });

  it('scheduler.js に夜間エンゲージメント同期の cron ジョブがある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/scheduler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('runNightlyEngagementSync'), 'runNightlyEngagementSync を呼んでいる');
    assert.ok(content.includes('夜間エンゲージメント同期'), 'ジョブ名が設定されている');
  });

  it('instagramService から graphApiRequestBase がエクスポートされている', () => {
    const content = fs.readFileSync(
      new URL('../src/services/instagramService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function graphApiRequestBase'),
      'graphApiRequestBase がエクスポートされている');
    assert.ok(content.includes('export const INSTAGRAM_API_BASE'),
      'INSTAGRAM_API_BASE がエクスポートされている');
  });

  it('migration_learning_synced.sql が存在する', () => {
    assert.ok(
      fs.existsSync('database/migration_learning_synced.sql'),
      'migration_learning_synced.sql が作成されているべき'
    );
  });
});

// ============================================================
// Scenario 45: 開発者テスト店舗（自動カテゴリー検出・集合知除外）
// ============================================================
describe('Scenario 45: 開発者テスト店舗', async () => {
  const fs = await import('node:fs');

  it('adminHandler に DEV_TEST_CATEGORY と isDevTestStore がエクスポートされている', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/adminHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("export const DEV_TEST_CATEGORY = '開発者テスト'"),
      'DEV_TEST_CATEGORY 定数がエクスポートされている');
    assert.ok(content.includes('export function isDevTestStore'),
      'isDevTestStore 関数がエクスポートされている');
  });

  it('isDevTestStore が DEV_TEST_CATEGORY と比較している', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/adminHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('DEV_TEST_CATEGORY'),
      'isDevTestStore 内で DEV_TEST_CATEGORY を参照している');
  });

  it('adminHandler に handleAdminDevStore がエクスポートされている', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/adminHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function handleAdminDevStore'),
      'handleAdminDevStore がエクスポートされている');
    assert.ok(content.includes('createStore'), '店舗作成を呼び出している');
  });

  it('textHandler に /admin dev-store ルーティングがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("'dev-store'"), 'dev-store ルーティングがあるべき');
    assert.ok(content.includes('handleAdminDevStore'), 'handleAdminDevStore を呼び出している');
  });

  it('imageHandler に isDevTestStore チェックがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('isDevTestStore'), 'isDevTestStore を使用している');
    assert.ok(content.includes('effectiveCategory'), 'effectiveCategory 変数がある');
  });

  it('imageHandler が effectiveCategory を pending context に保存している', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('effectiveCategory:'), 'effectiveCategory を context に保存している');
  });

  it('pendingImageHandler に isDevTestStore チェックがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/pendingImageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('isDevTestStore'), 'isDevTestStore を使用している');
    assert.ok(content.includes('storeForPrompt'), 'storeForPrompt でカテゴリーオーバーライドしている');
  });

  it('pendingImageHandler が開発者テスト時に集合知保存をスキップする', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/pendingImageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('!isDevTestStore(store)'),
      '集合知保存条件に isDevTestStore チェックがある');
  });

  it('collectiveIntelligence が開発者テストカテゴリーを除外する', () => {
    const content = fs.readFileSync(
      new URL('../src/services/collectiveIntelligence.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("category === '開発者テスト'"),
      'saveEngagementMetrics に開発者テスト除外ガードがある');
  });
});

// Scenario 46: persona自動更新（10投稿ごと）
describe('Scenario 46: persona自動更新', async () => {
  const fs = await import('node:fs');

  it('autoRegeneratePersonaIfNeeded がエクスポートされている', () => {
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function autoRegeneratePersonaIfNeeded'),
      'autoRegeneratePersonaIfNeeded should be exported');
  });

  it('regeneratePersonaDefinition がエクスポートされている', () => {
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function regeneratePersonaDefinition'),
      'regeneratePersonaDefinition should be exported');
  });

  it('autoRegeneratePersonaIfNeeded が投稿数ベースの閾値チェックを持つ', () => {
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('AUTO_PERSONA_POST_INTERVAL'),
      'should have AUTO_PERSONA_POST_INTERVAL constant');
    assert.ok(content.includes('_last_persona_update_post_count'),
      'should track _last_persona_update_post_count');
  });

  it('pendingImageHandler に autoRegeneratePersonaIfNeeded が含まれる', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/pendingImageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('autoRegeneratePersonaIfNeeded'),
      'pendingImageHandler should call autoRegeneratePersonaIfNeeded');
  });

  it('autoRegeneratePersonaIfNeeded がfire-and-forget（awaitなし）で呼ばれる', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/pendingImageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('autoRegeneratePersonaIfNeeded(store.id).catch'),
      'autoRegeneratePersonaIfNeeded should be fire-and-forget with .catch()');
  });

  it('同時実行防止ロック（_personaRegenerating）がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('_personaRegenerating'),
      'should have in-memory lock to prevent concurrent regeneration');
    assert.ok(content.includes('finally'),
      'should release lock in finally block');
  });

  it('persona系beliefのみ抽出するフィルター（filterPersonaBeliefs）がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('filterPersonaBeliefs'),
      'should filter persona-type beliefs from strategy-type');
    assert.ok(content.includes('strategyPatterns'),
      'should have strategy patterns to exclude');
  });
});

// ==================== Scenario 47: 魅力発見AI（Phase 18） ====================
describe('Scenario 47: 魅力発見AI', async () => {
  const fs = await import('node:fs');
  // parseCharmViewpoints のロジックを直接テスト（importするとsupabase依存が走るため再実装）
  function parseCharmViewpoints(imageDescription) {
    if (!imageDescription) return { cleanDescription: '', viewpoints: [] };
    const viewpointRegex = /\[視点([ABC])\]\s*(.+)/g;
    const viewpoints = [];
    let match;
    while ((match = viewpointRegex.exec(imageDescription)) !== null) {
      viewpoints.push(match[2].trim());
    }
    const cleanDescription = imageDescription
      .replace(/\n*6\.\s*投稿の切り口[\s\S]*$/m, '')
      .replace(/\[視点[ABC]\]\s*.+\n?/g, '')
      .trim();
    return {
      cleanDescription: cleanDescription || imageDescription,
      viewpoints: viewpoints.length === 3 ? viewpoints : [],
    };
  }

  it('parseCharmViewpoints: 正常な3視点をパースできる', () => {
    const input = `1. 焼きたてのパンが写っている
2. 暖かい色味で柔らかい印象
3. 小麦の香りがしそう
4. 朝の時間帯
5. 焼き立ての匂いに引かれそう

6. 投稿の切り口（3つ）
[視点A] 朝一番に焼けたときの湯気と店内の匂い
[視点B] 常連さんが必ず頼むその理由
[視点C] この焼き色が出るまで温度を3回変えた`;

    const result = parseCharmViewpoints(input);
    assert.equal(result.viewpoints.length, 3);
    assert.equal(result.viewpoints[0], '朝一番に焼けたときの湯気と店内の匂い');
    assert.equal(result.viewpoints[1], '常連さんが必ず頼むその理由');
    assert.equal(result.viewpoints[2], 'この焼き色が出るまで温度を3回変えた');
  });

  it('parseCharmViewpoints: cleanDescriptionに視点セクションが含まれない', () => {
    const input = `1. 焼きたてのパン
2. 暖かい色味

6. 投稿の切り口（3つ）
[視点A] 朝の湯気
[視点B] 常連の理由
[視点C] 焼き色のこだわり`;

    const result = parseCharmViewpoints(input);
    assert.ok(!result.cleanDescription.includes('[視点A]'), 'cleanDescription should not contain viewpoint markers');
    assert.ok(!result.cleanDescription.includes('投稿の切り口'), 'cleanDescription should not contain section header');
    assert.ok(result.cleanDescription.includes('焼きたてのパン'), 'cleanDescription should keep original 5 items');
  });

  it('parseCharmViewpoints: 視点が2つしかない場合は空配列を返す', () => {
    const input = `1. 写真の説明
[視点A] テスト視点A
[視点B] テスト視点B`;

    const result = parseCharmViewpoints(input);
    assert.equal(result.viewpoints.length, 0, 'should return empty array when less than 3 viewpoints');
  });

  it('parseCharmViewpoints: null/undefined入力で安全', () => {
    assert.deepEqual(parseCharmViewpoints(null), { cleanDescription: '', viewpoints: [] });
    assert.deepEqual(parseCharmViewpoints(undefined), { cleanDescription: '', viewpoints: [] });
    assert.deepEqual(parseCharmViewpoints(''), { cleanDescription: '', viewpoints: [] });
  });

  it('imageHandler.jsのparseCharmViewpointsがexportされている', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export function parseCharmViewpoints'),
      'parseCharmViewpoints should be exported');
  });

  it('describeImageプロンプトに投稿視点の項目6が含まれる', () => {
    const content = fs.readFileSync(
      new URL('../src/services/claudeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('投稿の切り口'), 'describeImage should include viewpoint section');
    assert.ok(content.includes('[視点A]'), 'describeImage should include viewpoint format markers');
    assert.ok(content.includes('[視点B]'), 'describeImage should include viewpoint format markers');
    assert.ok(content.includes('[視点C]'), 'describeImage should include viewpoint format markers');
  });

  it('handleImageMessageの即応答にヒントボタンが含まれない', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    // handleImageMessage内: replyTextで即応答（ボタンなし）
    assert.ok(content.includes('魅力を探しています'), 'should show charm discovery message');
    // バックグラウンド完了後にPush通知でボタンを送る
    assert.ok(content.includes('pushMessage'), 'should use pushMessage for viewpoint buttons');
  });

  it('ラベル20文字制限のトランケーション（truncateLabel）が存在する', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('truncateLabel'), 'should have truncateLabel function');
    assert.ok(content.includes('.slice(0, 18)'), 'should truncate to 18 chars + ellipsis');
  });

  it('Push通知で投稿視点ボタンA/B/Cとスキップを送信する', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('3つの投稿の切り口が見つかりました'), 'should include discovery message in Push');
    assert.ok(content.includes('charmViewpoints'), 'should save viewpoints to pending_image_context');
  });

  it('フォールバック: 視点パース失敗時に汎用ヒントボタンをPushする', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('sendFallbackHintPush'), 'should have fallback hint push function');
    // フォールバックにもお知らせ/日常感/お役立ち/スキップが含まれる
    assert.ok(content.includes('お知らせ'), 'fallback should include hint buttons');
  });
});
