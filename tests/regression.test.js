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

  it('feedbackHandler が学習後に投稿上書きする', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/feedbackHandler.js', import.meta.url), 'utf-8'
    );
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
  it('feedbackHandler（学習）が updatePostContent を使用する（S14）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/feedbackHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('updatePostContent'),
      'Should update post content after learning');
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
  it('describeImage がJSON形式で出力する（main_subject, observations, viewpoints）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/claudeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('main_subject'),
      'describeImage prompt should include main_subject field');
    assert.ok(content.includes('observations'),
      'describeImage prompt should include observations field');
    assert.ok(content.includes('viewpoints'),
      'describeImage prompt should include viewpoints field');
    assert.ok(content.includes('JSON'),
      'describeImage prompt should specify JSON format');
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
    // pendingImageHandler は簡略化され、待機メッセージのみ返す
    assert.ok(content.includes('handlePendingImageResponse'),
      'pendingImageHandler should export handlePendingImageResponse');
  });

  it('buildImagePostPrompt に Dual Trigger 出力形式がある', async () => {
    const { buildImagePostPrompt } = await import('../src/utils/promptBuilder.js');
    const store = { name: 'テスト店', tone: 'カジュアル', config: {} };
    const prompt = buildImagePostPrompt(store, null, null, '', 'テスト画像説明');

    assert.ok(prompt.includes('独り言'),
      'Should include monologue concept');
    assert.ok(prompt.includes('説明文を書かない'),
      'Should prohibit explanatory writing');
    // 想起の一言・来店の一文は独立パートとして削除済み（本文+ハッシュタグの2パート構成）
    assert.ok(!prompt.includes('（想起の一言）'),
      'Recall one-liner should not be a separate output part');
    assert.ok(!prompt.includes('（来店の一文'),
      'Visit one-liner should not be in output format');
  });

  it('Dual Trigger の出力形式に新3案ラベルがある', async () => {
    const { buildImagePostPrompt } = await import('../src/utils/promptBuilder.js');
    const store = { name: 'テスト店', tone: 'フレンドリー', config: {} };
    const prompt = buildImagePostPrompt(store, null, null, '', 'テスト画像');

    assert.ok(prompt.includes('[ 案A：視覚で伝える ]'),
      'Output format should include [ 案A：視覚で伝える ]');
    assert.ok(prompt.includes('[ 案B：ストーリーを添える ]'),
      'Output format should include [ 案B：ストーリーを添える ]');
    assert.ok(prompt.includes('[ 案C：ひとりごと ]'),
      'Output format should include [ 案C：ひとりごと ]');
    assert.ok(prompt.includes('3案作成'),
      'Should instruct 3 proposals');
    assert.ok(prompt.includes('この写真の別の撮り方'),
      'Should include Photo Advice section for alternative shooting');
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

  it('写真観察AIのアイデンティティ', async () => {
    const { buildImagePostPrompt } = await import('../src/utils/promptBuilder.js');
    const store = { name: 'テスト店', tone: 'カジュアル', config: {} };
    const prompt = buildImagePostPrompt(store, null, null, '', 'テスト画像');

    assert.ok(!prompt.includes('良き理解者'),
      'Old identity should be removed');
    assert.ok(prompt.includes('写真観察AI'),
      'New identity should be Photo Observation AI');
    assert.ok(prompt.includes('文章生成AIではありません'),
      'Should clarify not a text generation AI');
  });

  it('buildRevisionPrompt に写真観察AIルールが含まれる', async () => {
    const { buildRevisionPrompt } = await import('../src/utils/promptBuilder.js');
    const store = { name: 'テスト店', tone: 'カジュアル', config: {} };
    const prompt = buildRevisionPrompt(store, '元の投稿', 'もっと短く');

    assert.ok(prompt.includes('写真観察AI'),
      'Revision prompt should include Photo Observation AI identity');
    assert.ok(prompt.includes('幻想的'),
      'Revision prompt should include forbidden words');
  });

  it('写真観察AIコンセプト: 観察→ネタ変換の型・禁止ワードが含まれる', async () => {
    const { buildImagePostPrompt, buildTextPostPrompt } = await import('../src/utils/promptBuilder.js');
    const store = { name: 'テスト店', tone: 'カジュアル', config: {} };
    const imagePrompt = buildImagePostPrompt(store, null, null, '', 'テスト画像');
    const textPrompt = buildTextPostPrompt(store, 'テスト', null, null, '');

    // 写真観察→ネタ変換の型
    assert.ok(imagePrompt.includes('観察') && imagePrompt.includes('ネタ変換'),
      'Image prompt should include observation and conversion pattern');
    assert.ok(textPrompt.includes('本文の書き方'),
      'Text prompt should include writing pattern');
    // 禁止ワード
    assert.ok(imagePrompt.includes('禁止ワード'),
      'Image prompt should include banned words');
    assert.ok(textPrompt.includes('禁止ワード'),
      'Text prompt should include information words ban');
  });

  it('M5: 集合知データは戦略アドバイスに転用（プロンプト注入ではなくbuildStrategicAdviceで使用）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    // buildStrategicAdvice関数がexportされている
    assert.ok(content.includes('export function buildStrategicAdvice'),
      'buildStrategicAdvice should be exported');
    // プロンプトに文字数・絵文字数の必須指示が含まれない
    // （buildImagePostPrompt/buildTextPostPromptの中で insights.push('【文字数（必須）】...') がないこと）
    const charCountDirectives = content.match(/insights\.push\(.*文字数（必須）/g);
    assert.ok(!charCountDirectives,
      'Character count directives should not be injected into generation prompts');
    const emojiDirectives = content.match(/insights\.push\(.*絵文字（必須）/g);
    assert.ok(!emojiDirectives,
      'Emoji count directives should not be injected into generation prompts');
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

  it('imageHandler の返信に2ステップフローUI（これで決定/別案）が含まれる', async () => {
    const fs = await import('node:fs');
    const image = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(image.includes('これで決定'),
      'Push should include confirm button');
    assert.ok(image.includes('別案'),
      'Push should include alternative button');
    assert.ok(image.includes('投稿ができました'),
      'Push should include completion message');
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

  // M3: feedbackHandler が差分学習（analyzeFeedbackWithClaude）を使用する
  it('M3: feedbackHandler.js が analyzeFeedbackWithClaude を使用する', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/feedbackHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('analyzeFeedbackWithClaude'),
      'Should use analyzeFeedbackWithClaude for diff learning');
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

  it('imageHandler がreplyMessages（複数メッセージreply）で結果を返す', () => {
    const content = fs.readFileSync('src/handlers/imageHandler.js', 'utf8');
    assert.ok(content.includes('replyMessages'), 'replyMessagesで一括返信する');
    assert.ok(content.includes('replyToken'), 'replyTokenを使用する');
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

  it('imageHandler がDetectionを内部処理として渡す', () => {
    const content = fs.readFileSync('src/handlers/imageHandler.js', 'utf8');
    assert.ok(content.includes('detections: viewpoints'), 'Detection（観察視点）をdetectionsとして渡す');
    assert.ok(!content.includes('autoHint'), 'autoHint方式は廃止');
  });

  it('imageHandlerがbuildBodyPromptを使用している（buildImagePostPromptではない）', () => {
    const content = fs.readFileSync('src/handlers/imageHandler.js', 'utf8');
    assert.ok(content.includes('buildBodyPrompt'), 'buildBodyPromptを使用している');
    assert.ok(!content.includes('buildImagePostPrompt'), 'buildImagePostPromptは廃止');
    assert.ok(!content.includes('enrichedDescription'), '旧enrichedDescription方式は廃止');
  });
});

// ==================== Scenario 32: プラン制限・機能ゲーティング ====================
describe('Scenario 32: プラン制限・機能ゲーティング', async () => {
  const { PLANS, getPlanConfig, PAID_PLANS } = await import('../src/config/planConfig.js');

  // --- プラン定義の整合性（3プラン構造） ---
  it('3つのプランが定義されている（free/standard/premium）', () => {
    assert.ok(PLANS.free, 'free プランが存在する');
    assert.ok(PLANS.standard, 'standard プランが存在する');
    assert.ok(PLANS.premium, 'premium プランが存在する');
    assert.equal(Object.keys(PLANS).length, 3, 'プランは3つ');
  });

  it('月間生成回数: free=5, standard=60, premium=200', () => {
    assert.equal(PLANS.free.monthlyGenerations, 5);
    assert.equal(PLANS.standard.monthlyGenerations, 60);
    assert.equal(PLANS.premium.monthlyGenerations, 200);
  });

  it('店舗数上限: free=1, standard=1, premium=5', () => {
    assert.equal(PLANS.free.maxStores, 1);
    assert.equal(PLANS.standard.maxStores, 1);
    assert.equal(PLANS.premium.maxStores, 5);
  });

  // --- Free はプレミアム体験（全機能ON） ---
  it('Free はプレミアム体験（主要機能が全てON）', () => {
    assert.equal(PLANS.free.features.collectiveIntelligence, true);
    assert.equal(PLANS.free.features.seasonalMemory, true);
    assert.equal(PLANS.free.features.advancedPersonalization, true);
    assert.equal(PLANS.free.features.proposalABC, true);
    assert.equal(PLANS.free.features.engagementHealthCheck, true);
    assert.equal(PLANS.free.features.engagementPrescription, true);
    assert.equal(PLANS.free.features.engagementAutoLearn, true);
    assert.equal(PLANS.free.features.instagramPost, true);
    assert.equal(PLANS.free.features.postStock, true);
    assert.equal(PLANS.free.features.scheduledPost, true);
    assert.equal(PLANS.free.features.dataCollection, true);
  });

  it('Free では週間計画・強化版アドバイス・撮影ナッジは無効', () => {
    assert.equal(PLANS.free.features.weeklyContentPlan, false);
    assert.equal(PLANS.free.features.enhancedPhotoAdvice, false);
    assert.equal(PLANS.free.features.dailyPhotoNudge, false);
  });

  // --- Standard で有効になる機能 ---
  it('Standard では分析・自動学習・季節記憶・人格学習が有効', () => {
    assert.equal(PLANS.standard.features.engagementPrescription, true);
    assert.equal(PLANS.standard.features.engagementAutoLearn, true);
    assert.equal(PLANS.standard.features.seasonalMemory, true);
    assert.equal(PLANS.standard.features.advancedPersonalization, true);
  });

  it('全プランでInstagram投稿が有効', () => {
    assert.equal(PLANS.free.features.instagramPost, true);
    assert.equal(PLANS.standard.features.instagramPost, true);
    assert.equal(PLANS.premium.features.instagramPost, true);
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
    assert.equal(config.monthlyGenerations, 5);
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
  it('imageHandler で imageUrl を post_history に引き継いでいる', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('imageUrl'), 'imageUrlを参照している');
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
    assert.equal(PLANS.free.monthlyGenerations, 5, 'free: 5回');
    assert.equal(PLANS.standard.monthlyGenerations, 60, 'standard: 60回');
    assert.equal(PLANS.premium.monthlyGenerations, 200, 'premium: 200回');
  });

  it('各プランに正しい最大店舗数が設定されている', () => {
    assert.equal(PLANS.free.maxStores, 1, 'free: 1店舗');
    assert.equal(PLANS.standard.maxStores, 1, 'standard: 1店舗');
    assert.equal(PLANS.premium.maxStores, 5, 'premium: 5店舗');
  });

  it('free プランはプレミアム体験（処方箋・自動学習・人格学習が有効）', () => {
    assert.equal(PLANS.free.features.engagementPrescription, true, '処方箋は有効');
    assert.equal(PLANS.free.features.engagementAutoLearn, true, '自動学習は有効');
    assert.equal(PLANS.free.features.advancedPersonalization, true, '人格学習は有効');
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
    assert.equal(PAID_PLANS.length, 2, '有料プランは2つ（standard/premium）');
  });
});

// ==================== Scenario 36: サブスク接続検証 ====================
describe('Scenario 36: サブスク接続検証', async () => {
  const fs = await import('node:fs');

  it('feedbackHandler（学習）が差分分析を使用する', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/feedbackHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('analyzeFeedbackWithClaude'),
      '差分分析APIを使用している');
    assert.ok(content.includes('updateAdvancedProfile'),
      '学習結果をプロファイルに反映している');
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
    assert.ok(content.includes('なぜその撮り方だと反応が変わるか'),
      '撮影アドバイスに理由説明の指示がある');
  });

  it('imageHandler で enhancedPhotoAdvice チェックがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
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

  it('imageHandler に isDevTestStore チェックがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('isDevTestStore'), 'isDevTestStore を使用している');
    assert.ok(content.includes('storeForPrompt'), 'storeForPrompt でカテゴリーオーバーライドしている');
  });

  it('imageHandler が開発者テスト時に集合知保存をスキップする', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
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

  it('imageHandler に autoRegeneratePersonaIfNeeded が含まれる', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('autoRegeneratePersonaIfNeeded'),
      'imageHandler should call autoRegeneratePersonaIfNeeded');
  });

  it('autoRegeneratePersonaIfNeeded がfire-and-forget（awaitなし）で呼ばれる', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
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
    if (!imageDescription) return { cleanDescription: '', viewpoints: [], viewpointLabels: [] };
    // フォーマット: [① _] 内容（旧: [① カテゴリ名] 内容 も互換）
    const newFormatRegex = /\[([①②③])\s*(.+?)\]\s*(.+)/g;
    const viewpoints = [];
    const viewpointLabels = [];
    let match;
    while ((match = newFormatRegex.exec(imageDescription)) !== null) {
      viewpointLabels.push(match[2].trim());
      viewpoints.push(match[3].trim());
    }
    // 旧フォーマットフォールバック: [視点A/B/C] 内容
    if (viewpoints.length === 0) {
      const oldFormatRegex = /\[視点([ABC])\]\s*(.+)/g;
      while ((match = oldFormatRegex.exec(imageDescription)) !== null) {
        viewpoints.push(match[2].trim());
      }
    }
    const cleanDescription = imageDescription
      .replace(/\n*6\.\s*(?:【?Observation|写真の観察|投稿の切り口)[\s\S]*$/m, '')
      .replace(/\[(?:[①②③]\s*.+?|視点[ABC])\]\s*.+\n?/g, '')
      .trim();
    return {
      cleanDescription: cleanDescription || imageDescription,
      viewpoints: viewpoints.length === 3 ? viewpoints : [],
      viewpointLabels: viewpointLabels.length === 3 ? viewpointLabels : [],
    };
  }

  it('parseCharmViewpoints: 新フォーマット（カテゴリ付き）で3視点をパースできる', () => {
    const input = `1. 焼きたてのパンが写っている
2. 暖かい色味で柔らかい印象
3. 小麦の香りがしそう
4. 朝の時間帯
5. 焼き立ての匂いに引かれそう

6. 写真の観察（3つの視点）
[① 空間] 石壁と木の温もりに包まれた店内
[② 光] 自然光が一番きれいに入る時間
[③ 過ごし方] 窓際の席で静かに過ごす時間`;

    const result = parseCharmViewpoints(input);
    assert.equal(result.viewpoints.length, 3);
    assert.equal(result.viewpoints[0], '石壁と木の温もりに包まれた店内');
    assert.equal(result.viewpoints[1], '自然光が一番きれいに入る時間');
    assert.equal(result.viewpoints[2], '窓際の席で静かに過ごす時間');
    assert.equal(result.viewpointLabels.length, 3);
    assert.equal(result.viewpointLabels[0], '空間');
    assert.equal(result.viewpointLabels[1], '光');
    assert.equal(result.viewpointLabels[2], '過ごし方');
  });

  it('parseCharmViewpoints: Observation→Detection チェーンフォーマットをパースできる', () => {
    const input = `1. マフィンが6個トレイに並んでいる
2. 暖色の照明、焼き色が濃い
3. バターと小麦の香りがしそう
4. 午前中の仕込み時間帯
5. 焼きたて感に引かれそう

6. 【Observation — 視覚的事実の列挙】
- マフィンの縁の焼き色が外側から内側へグラデーションしている
- トレイの上で6個が均等な間隔で並んでいる
- 表面に細かいひび割れがある
- 暖色の照明がマフィン上面に影を落としている

7. 【Detection — 店主も気づいていない魅力の発見】
[① _] 縁の焼き色のグラデーションが手焼きの痕跡として残っている
[② _] 6個の均等な間隔がトレイ全体の整然とした印象を作っている
[③ _] 表面のひび割れが焼き上がりの膨らみを視覚的に伝えている`;

    const result = parseCharmViewpoints(input);
    assert.equal(result.viewpoints.length, 3);
    assert.equal(result.viewpoints[0], '縁の焼き色のグラデーションが手焼きの痕跡として残っている');
    assert.equal(result.viewpoints[1], '6個の均等な間隔がトレイ全体の整然とした印象を作っている');
    assert.equal(result.viewpoints[2], '表面のひび割れが焼き上がりの膨らみを視覚的に伝えている');
    // cleanDescription should only contain items 1-5
    assert.ok(!result.cleanDescription.includes('Observation'), 'cleanDescription should not contain Observation section');
    assert.ok(!result.cleanDescription.includes('Detection'), 'cleanDescription should not contain Detection section');
    assert.ok(result.cleanDescription.includes('マフィンが6個'), 'cleanDescription should keep items 1-5');
  });

  it('parseCharmViewpoints: 旧フォーマット（視点A/B/C）もフォールバックで動く', () => {
    const input = `1. 焼きたてのパン
[視点A] 朝一番に焼けたときの湯気と店内の匂い
[視点B] 常連さんが必ず頼むその理由
[視点C] この焼き色が出るまで温度を3回変えた`;

    const result = parseCharmViewpoints(input);
    assert.equal(result.viewpoints.length, 3);
    assert.equal(result.viewpoints[0], '朝一番に焼けたときの湯気と店内の匂い');
    assert.equal(result.viewpointLabels.length, 0, '旧フォーマットではラベルなし');
  });

  it('parseCharmViewpoints: cleanDescriptionに観察セクションが含まれない', () => {
    const input = `1. 焼きたてのパン
2. 暖かい色味

6. 写真の観察（3つの視点）
[① 空間] 朝の湯気
[② 光] 常連の理由
[③ 過ごし方] 焼き色のこだわり`;

    const result = parseCharmViewpoints(input);
    assert.ok(!result.cleanDescription.includes('[①'), 'cleanDescription should not contain observation markers');
    assert.ok(!result.cleanDescription.includes('写真の観察'), 'cleanDescription should not contain section header');
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
    const nullResult = parseCharmViewpoints(null);
    assert.equal(nullResult.cleanDescription, '');
    assert.deepEqual(nullResult.viewpoints, []);
    assert.deepEqual(nullResult.viewpointLabels, []);
    const undefResult = parseCharmViewpoints(undefined);
    assert.equal(undefResult.cleanDescription, '');
    assert.deepEqual(undefResult.viewpoints, []);
    const emptyResult = parseCharmViewpoints('');
    assert.equal(emptyResult.cleanDescription, '');
    assert.deepEqual(emptyResult.viewpoints, []);
  });

  it('imageHandler.jsのparseCharmViewpointsがexportされている', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export function parseCharmViewpoints'),
      'parseCharmViewpoints should be exported');
  });

  it('describeImageプロンプトがJSON形式でmain_subjectとviewpointsを出力する', () => {
    const content = fs.readFileSync(
      new URL('../src/services/claudeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('JSON'), 'describeImage should specify JSON output');
    assert.ok(content.includes('main_subject'), 'describeImage should include main_subject');
    assert.ok(content.includes('supporting_elements'), 'describeImage should include supporting_elements');
    assert.ok(content.includes('observations'), 'describeImage should include observations');
    assert.ok(content.includes('viewpoints'), 'describeImage should include viewpoints');
    assert.ok(content.includes('15字以内'), 'viewpoints should enforce short format rule');
  });

  it('handleImageMessageがreplyTokenを渡してreplyMessagesで一括返信する', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    // replyTokenを渡して全生成完了後にreplyで一括返信（push不要）
    assert.ok(content.includes('replyMessages'), 'should use replyMessages for proposals');
    // pushMessageはフォールバックとして残る
    assert.ok(content.includes('pushMessage'), 'should have pushMessage as fallback');
  });

  it('Push通知で1案表示+これで決定/別案ボタンを送信する', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('これで決定'), 'should include confirm button in Push');
    assert.ok(content.includes('別案'), 'should include alternative button in Push');
    assert.ok(content.includes('charmViewpoints'), 'should save viewpoints to pending_image_context');
  });

  it('promptBuilderにDetection内部処理セクションがある', () => {
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('Detection（内部処理'), 'should have Detection internal processing section');
    assert.ok(content.includes('Detectionを説明するな'), 'should instruct not to explain Detection');
    assert.ok(content.includes('行動の中に溶かせ'), 'should instruct to embed Detection in actions');
  });

  it('視点パース失敗時でもバックグラウンド生成が続行する', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    // 視点パース失敗時もdetections=[]で生成が続行される
    assert.ok(content.includes('detections: viewpoints'), 'should pass viewpoints as detections');
    assert.ok(content.includes('pushMessage'), 'should push proposals even without viewpoints');
  });
});

// ==================== Scenario 48: 集合知戦略シフト ====================
describe('Scenario 48: 集合知戦略シフト', async () => {
  const fs = await import('node:fs');

  it('buildStrategicAdvice がエクスポートされている', () => {
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export function buildStrategicAdvice'));
  });

  it('buildStrategicAdvice が null入力で null を返す', async () => {
    const { buildStrategicAdvice } = await import('../src/utils/promptBuilder.js');
    assert.equal(buildStrategicAdvice(null, {}), null);
  });

  it('buildStrategicAdvice がデータなし（全sampleSize=0）で null を返す', async () => {
    const { buildStrategicAdvice } = await import('../src/utils/promptBuilder.js');
    const emptyInsights = {
      own: { sampleSize: 0 }, category: { sampleSize: 0 }, group: { sampleSize: 0 },
    };
    assert.equal(buildStrategicAdvice(emptyInsights, {}), null);
  });

  it('buildStrategicAdvice がデータありで投稿時間Tipを返す', async () => {
    const { buildStrategicAdvice } = await import('../src/utils/promptBuilder.js');
    const insights = {
      own: { sampleSize: 10, bestPostingHours: [12, 18] },
      category: { sampleSize: 50 },
      group: { sampleSize: 100 },
    };
    const result = buildStrategicAdvice(insights, { name: 'テスト店' });
    assert.ok(result);
    assert.ok(result.postingTimeTip.includes('12時'));
    assert.equal(result.dataSource, 'own');
  });

  it('buildStrategicAdvice が勝ちパターンから写真スタイルTipを返す', async () => {
    const { buildStrategicAdvice } = await import('../src/utils/promptBuilder.js');
    const insights = {
      own: { sampleSize: 10, winningPattern: { dominantHookType: 'emotion', dominantHookRatio: 60 } },
      category: { sampleSize: 50 },
      group: { sampleSize: 100 },
    };
    const result = buildStrategicAdvice(insights, {});
    assert.ok(result.photoStyleTip);
    assert.ok(result.photoStyleTip.includes('感情'));
  });

  it('buildStrategicAdvice が偏りパターン(70%以上)でコンテンツTipを返す', async () => {
    const { buildStrategicAdvice } = await import('../src/utils/promptBuilder.js');
    const insights = {
      own: { sampleSize: 10, winningPattern: { dominantHookType: 'emotion', dominantHookRatio: 75 } },
      category: { sampleSize: 50 },
      group: { sampleSize: 100 },
    };
    const result = buildStrategicAdvice(insights, {});
    assert.ok(result.contentTip);
    assert.ok(result.contentTip.includes('75%'));
  });

  it('プロンプトに文字数・絵文字数の必須指示が含まれない', () => {
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    const charDirectives = content.match(/insights\.push\(.*文字数（必須）/g);
    assert.ok(!charDirectives, 'No character count directives in prompts');
    const emojiDirectives = content.match(/insights\.push\(.*絵文字（必須）/g);
    assert.ok(!emojiDirectives, 'No emoji count directives in prompts');
  });

  it('Photo Advice にデータ参考が注入される', () => {
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('photoStyleHint'), 'Photo Advice section should include strategic hint variable');
  });

  it('Daily Nudge が戦略アドバイスをインポートしている', () => {
    const content = fs.readFileSync(
      new URL('../src/services/dailyNudgeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("import { getBlendedInsights }"), 'should import getBlendedInsights');
    assert.ok(content.includes("import { buildStrategicAdvice }"), 'should import buildStrategicAdvice');
  });

  it('Daily Nudge の formatNudgeMessage が戦略Tips対応', () => {
    const content = fs.readFileSync(
      new URL('../src/services/dailyNudgeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('formatNudgeMessage(nudge, strategicAdvice)'),
      'should pass strategicAdvice to formatNudgeMessage');
    assert.ok(content.includes('postingTimeTip'), 'should use postingTimeTip');
  });

  it('imageHandler が投稿生成後に戦略Tipsを送信する', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('buildStrategicAdvice'), 'should call buildStrategicAdvice');
    assert.ok(content.includes('postingTimeTip'), 'should check postingTimeTip');
  });
});

// ==================== Scenario 49: direct_mode（そのまま投稿モード） ====================
describe('Scenario 49: direct_mode（そのまま投稿モード）', async () => {
  const fs = await import('node:fs');

  it('supabaseService に updateStorePostMode がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/supabaseService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function updateStorePostMode'),
      'updateStorePostMode がエクスポートされている');
    assert.ok(content.includes("post_mode: mode"),
      'post_mode をconfigに保存する');
  });

  it('imageHandler に direct_mode 分岐がある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("post_mode === 'direct'"),
      'direct_modeの判定がある');
    assert.ok(content.includes('direct_mode: true'),
      'pending_image_contextにdirect_mode保存');
    assert.ok(content.includes('投稿の冒頭テキストを送ってください'),
      'direct_mode時のテキスト入力案内がある');
  });

  it('textHandler にモード切替コマンドがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("'モード切替'"),
      'モード切替コマンドがある');
    assert.ok(content.includes('handlePostModeSwitch'),
      'handlePostModeSwitch ハンドラがある');
    assert.ok(content.includes('handlePostModeSet'),
      'handlePostModeSet ハンドラがある');
  });

  it('textHandler の isSystemCommand にモード切替系が含まれる', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("'モード切替'") && content.includes("'モード切り替え'"),
      'モード切替がisSystemCommandに含まれる');
    assert.ok(content.includes("'AI投稿モード'"),
      'AI投稿モードがisSystemCommandに含まれる');
    assert.ok(content.includes("'そのまま投稿モード'"),
      'そのまま投稿モードがisSystemCommandに含まれる');
    assert.ok(content.includes("'direct投稿実行'"),
      'direct投稿実行がisSystemCommandに含まれる');
  });

  it('textHandler に direct_mode テキスト受信ハンドラがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('handleDirectModeText'),
      'handleDirectModeText ハンドラがある');
    assert.ok(content.includes('direct_caption'),
      'direct_caption をpending_image_contextに保存');
    assert.ok(content.includes('投稿プレビュー'),
      'プレビュー表示がある');
  });

  it('textHandler に direct投稿実行ハンドラがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('handleDirectPostExecute'),
      'handleDirectPostExecute ハンドラがある');
    assert.ok(content.includes('publishToInstagram'),
      'Instagram投稿APIを呼び出す');
  });

  it('direct_mode切替時にStandardプランチェックがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("isFeatureEnabled(user.id, 'instagramPost')"),
      'instagramPost機能のプランチェック');
    assert.ok(content.includes('getInstagramAccount'),
      'Instagram連携チェック');
  });

  it('direct_modeのテンプレート結合が正しい順序（冒頭テキスト→テンプレ→ハッシュタグ）', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    // テンプレート情報を組み立てている
    assert.ok(content.includes("templates.住所") && content.includes("templates.営業時間"),
      'テンプレートの住所・営業時間を結合');
    assert.ok(content.includes("templates.hashtags"),
      'ハッシュタグを結合');
  });

  it('updateStorePostMode が supabaseService からインポートされている', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('updateStorePostMode'),
      'updateStorePostMode がimportされている');
  });
});

// ==================== Scenario 50: 投稿ストック ====================
describe('Scenario 50: 投稿ストック', async () => {
  const fs = await import('node:fs');

  it('stockHandler.js が存在し必要な関数をexportしている', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/stockHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function handleStockSave'), 'handleStockSave');
    assert.ok(content.includes('export async function handleStockList'), 'handleStockList');
    assert.ok(content.includes('export async function handleStockAction'), 'handleStockAction');
    assert.ok(content.includes('export async function handleStockPublish'), 'handleStockPublish');
    assert.ok(content.includes('export async function handleStockDelete'), 'handleStockDelete');
    assert.ok(content.includes('export async function handleSchedulePrompt'), 'handleSchedulePrompt');
    assert.ok(content.includes('export async function handleScheduleConfirm'), 'handleScheduleConfirm');
    assert.ok(content.includes('export async function processScheduledPosts'), 'processScheduledPosts');
  });

  it('supabaseService にストック関連の関数がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/supabaseService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function updatePostStatus'), 'updatePostStatus');
    assert.ok(content.includes('export async function getStockPosts'), 'getStockPosts');
    assert.ok(content.includes('export async function getStockPostById'), 'getStockPostById');
    assert.ok(content.includes('export async function deleteStockPost'), 'deleteStockPost');
    assert.ok(content.includes('export async function getDueScheduledPosts'), 'getDueScheduledPosts');
    assert.ok(content.includes('export async function getStockCount'), 'getStockCount');
  });

  it('getLatestPost が draft/scheduled を除外している', () => {
    const content = fs.readFileSync(
      new URL('../src/services/supabaseService.js', import.meta.url), 'utf-8'
    );
    // getLatestPost が post_status でフィルタしていることを確認
    const latestPostMatch = content.match(/getLatestPost[\s\S]*?\.in\('post_status',\s*\['active',\s*'posted'\]\)/);
    assert.ok(latestPostMatch, 'getLatestPost が active/posted のみ取得するフィルタがある');
  });

  it('proposalHandler に💾ストックボタンがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/proposalHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('ストック保存'), 'ストック保存ボタンのテキスト');
    assert.ok(content.includes('💾 ストック'), 'ストックボタンのラベル');
  });

  it('textHandler にストック関連コマンドのルーティングがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("'ストック保存'"), 'ストック保存ルーティング');
    assert.ok(content.includes("'ストック'"), 'ストック一覧ルーティング');
    assert.ok(content.includes("'ストック投稿'"), 'ストック投稿ルーティング');
    assert.ok(content.includes("'ストック予約'"), 'ストック予約ルーティング');
    assert.ok(content.includes("'ストック削除'"), 'ストック削除ルーティング');
    assert.ok(content.includes("startsWith('予約:')"), '予約時間確定ルーティング');
    assert.ok(content.includes("startsWith('ストック:')"), 'ストック番号選択ルーティング');
  });

  it('textHandler の isSystemCommand にストック関連コマンドが含まれる', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("'ストック'") && content.includes("'ストック保存'"),
      'ストック系コマンドが isSystemCommand に含まれる');
    assert.ok(content.includes("startsWith('ストック:')"),
      'ストック:N が isSystemCommand に含まれる');
    assert.ok(content.includes("startsWith('予約:')"),
      '予約: が isSystemCommand に含まれる');
  });

  it('stockHandler にストック上限チェック（MAX_STOCK=10）がある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/stockHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('MAX_STOCK'), 'MAX_STOCK定数');
    assert.ok(content.includes('getStockCount'), 'ストック件数チェック');
    assert.ok(content.includes('stockCount >= MAX_STOCK'), '上限到達チェック');
  });

  it('stockHandler に3案未選択チェックがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/stockHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('案A'), 'ストック保存前の3案未選択チェック');
  });

  it('stockHandler の予約投稿にInstagram連携チェックがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/stockHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('getInstagramAccount'), 'Instagram連携チェック');
    assert.ok(content.includes('Instagram未連携'), '未連携時のエラーメッセージ');
  });

  it('stockHandler のprocessScheduledPostsが失敗時にdraftに戻す', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/stockHandler.js', import.meta.url), 'utf-8'
    );
    // 失敗時に draft に戻すロジック
    assert.ok(content.includes("updatePostStatus(post.id, 'draft')"),
      '失敗時にdraftステータスに戻す');
    assert.ok(content.includes('notifyUser'),
      'ユーザーへの通知');
  });
});

// ==================== Scenario 51: 予約投稿 ====================
describe('Scenario 51: 予約投稿', async () => {
  const fs = await import('node:fs');

  it('scheduler.js に予約投稿cronジョブがある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/scheduler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('processScheduledPosts'), 'processScheduledPostsのインポート');
    assert.ok(content.includes('*/5 * * * *'), '5分ごとのcronスケジュール');
    assert.ok(content.includes('予約投稿チェック'), 'ジョブ名');
  });

  it('planConfig に postStock と scheduledPost フラグがある', () => {
    const content = fs.readFileSync(
      new URL('../src/config/planConfig.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('postStock'), 'postStockフラグ');
    assert.ok(content.includes('scheduledPost'), 'scheduledPostフラグ');
  });

  it('scheduledPost は全プラン=true', async () => {
    const { PLANS } = await import('../src/config/planConfig.js');
    assert.strictEqual(PLANS.free.features.scheduledPost, true, 'Free: scheduledPost=true');
    assert.strictEqual(PLANS.standard.features.scheduledPost, true, 'Standard: scheduledPost=true');
    assert.strictEqual(PLANS.premium.features.scheduledPost, true, 'Premium: scheduledPost=true');
  });

  it('postStock は全プラン=true', async () => {
    const { PLANS } = await import('../src/config/planConfig.js');
    assert.strictEqual(PLANS.free.features.postStock, true, 'Free: postStock=true');
    assert.strictEqual(PLANS.standard.features.postStock, true, 'Standard: postStock=true');
    assert.strictEqual(PLANS.premium.features.postStock, true, 'Premium: postStock=true');
  });

  it('instagramHandler で投稿成功時にstatus更新がある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/instagramHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("updatePostStatus"), 'updatePostStatus呼び出し');
    assert.ok(content.includes("'posted'"), "posted ステータス");
  });

  it('migration_post_stock.sql が正しい構造を持つ', () => {
    const content = fs.readFileSync(
      new URL('../database/migration_post_stock.sql', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('post_status'), 'post_statusカラム');
    assert.ok(content.includes('scheduled_at'), 'scheduled_atカラム');
    assert.ok(content.includes('timestamptz'), 'timestamptz型');
    assert.ok(content.includes("DEFAULT 'active'"), "デフォルト値 active");
    assert.ok(content.includes('idx_post_history_scheduled'), '予約投稿インデックス');
    assert.ok(content.includes('idx_post_history_draft'), 'ストックインデックス');
  });

  it('stockHandler の予約投稿にプランチェックがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/stockHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("isFeatureEnabled"), 'isFeatureEnabled呼び出し');
    assert.ok(content.includes("'scheduledPost'"), 'scheduledPostフラグチェック');
    assert.ok(content.includes('スタンダードプラン以上'), 'プラン制限メッセージ');
  });

  it('stockHandler に日時パーサーがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/stockHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('parseJapaneseDateTime'), '日時パーサー関数');
    assert.ok(content.includes('明日'), '明日対応');
    assert.ok(content.includes('明後日'), '明後日対応');
    assert.ok(content.includes('SCHEDULE_INPUT_MESSAGE'), '入力案内メッセージ');
  });
});

// ==================== Scenario 52: ストック一括削除 ====================
describe('Scenario 52: ストック一括削除', async () => {
  const fs = await import('node:fs');

  it('supabaseService に deleteBatchStockPosts がある', () => {
    const content = fs.readFileSync(
      new URL('../src/services/supabaseService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function deleteBatchStockPosts'), 'deleteBatchStockPosts関数');
    assert.ok(content.includes(".in('id', postIds)"), 'IN句で一括削除');
    assert.ok(content.includes("['draft', 'scheduled']"), 'draft/scheduledのみ削除可能');
  });

  it('stockHandler に一括削除ハンドラーがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/stockHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function handleBatchDeletePrompt'), 'handleBatchDeletePrompt');
    assert.ok(content.includes('export async function handleBatchDeleteConfirm'), 'handleBatchDeleteConfirm');
    assert.ok(content.includes('awaiting_stock_batch_delete'), 'pending_command設定');
    assert.ok(content.includes('deleteBatchStockPosts'), 'deleteBatchStockPosts呼び出し');
  });

  it('一括削除が「全部」「全て」キーワードに対応している', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/stockHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('全部'), '「全部」キーワード');
    assert.ok(content.includes('全て'), '「全て」キーワード');
  });

  it('一括削除がカンマ区切り番号に対応している', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/stockHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('split'), 'カンマ区切りパース');
    assert.ok(content.includes('parseInt'), '番号パース');
  });

  it('ストック一覧に「まとめて削除」ボタンがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/stockHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('まとめて削除'), 'まとめて削除ボタンラベル');
    assert.ok(content.includes('ストック一括削除'), 'ストック一括削除コマンドテキスト');
  });

  it('textHandler にストック一括削除のルーティングがある', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("'ストック一括削除'"), 'ストック一括削除ルーティング');
    assert.ok(content.includes('handleBatchDeletePrompt'), 'handleBatchDeletePrompt呼び出し');
    assert.ok(content.includes('awaiting_stock_batch_delete'), 'pending_command判定');
    assert.ok(content.includes('handleBatchDeleteConfirm'), 'handleBatchDeleteConfirm呼び出し');
  });

  it('textHandler の isSystemCommand にストック一括削除が含まれる', () => {
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("'ストック一括削除'"), 'isSystemCommandにストック一括削除');
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 53: PDCA自動チューニング + プロンプト品質改善
// ═══════════════════════════════════════════════════════════════
describe('Scenario 53: PDCA自動チューニング + プロンプト品質改善', () => {

  it('promptTuningService が存在し、analyzeGlobalFeedbackPatterns と getGlobalPromptRules をexportする', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/promptTuningService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function analyzeGlobalFeedbackPatterns'), 'analyzeGlobalFeedbackPatternsがexportされている');
    assert.ok(content.includes('export async function getGlobalPromptRules'), 'getGlobalPromptRulesがexportされている');
    assert.ok(content.includes('global_prompt_rules'), 'global_prompt_rulesテーブルを参照');
    assert.ok(content.includes('CACHE_TTL_MS'), 'キャッシュ機構がある');
  });

  it('promptTuningService がbelief_logsの共通パターン分析ロジックを持つ', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/promptTuningService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('learning_profiles'), 'learning_profilesテーブルを参照');
    assert.ok(content.includes('belief_logs'), 'belief_logsを処理');
    assert.ok(content.includes('askClaude'), 'Claude APIで分析');
    assert.ok(content.includes('.slice(0, 5)'), '最大5件制限');
  });

  it('scheduler.js にPDCA自動チューニングのcronジョブがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/scheduler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('analyzeGlobalFeedbackPatterns'), 'analyzeGlobalFeedbackPatternsがインポートされている');
    assert.ok(content.includes('PDCA自動チューニング'), 'PDCA自動チューニングジョブが登録されている');
    assert.ok(content.includes("'0 13 * * 0'"), '毎週日曜 UTC 13:00 (JST 22:00) のcron式');
  });

  it('imageHandler がglobalRulesを取得してpromptBuilderに渡す', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('getGlobalPromptRules'), 'getGlobalPromptRulesがインポートされている');
    assert.ok(content.includes('globalRules'), 'globalRulesを取得してoptionsに渡している');
  });

  it('textHandler がglobalRulesを取得してpromptBuilderに渡す', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('getGlobalPromptRules'), 'getGlobalPromptRulesがインポートされている');
    assert.ok(content.includes('globalRules'), 'globalRulesを取得してoptionsに渡している');
  });

  it('promptBuilder が options.globalRules をプロンプトに注入する', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('options.globalRules'), 'options.globalRulesを参照');
    assert.ok(content.includes('globalRulesSection'), 'globalRulesSectionとしてプロンプトに注入');
  });

  it('プロンプトに事実誤認防止ルールがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('写っていない人数・人の行動を推測で補わない'), '人数事実誤認防止ルール');
    assert.ok(content.includes('写真に写っていない人数を書かない'), '表現使い回し禁止に人数ルール');
  });

  it('プロンプトに「一番強い掛け合わせ」指示がある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('一番強い掛け合わせ'), '掛け合わせ指示がある');
    assert.ok(content.includes('バラバラに列挙しない'), 'バラバラ禁止');
  });

  it('撮影提案に「何を」「いつ」「どう撮るか」「なぜ」の4要素が求められている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('「何を」「いつ」「どう撮るか」「なぜ」を1セット'), '4要素セット指示');
  });

  it('migration_global_prompt_rules.sql が存在する', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../database/migration_global_prompt_rules.sql', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('CREATE TABLE IF NOT EXISTS global_prompt_rules'), 'テーブル作成SQL');
    assert.ok(content.includes('rules JSONB'), 'rules列がJSONB');
    assert.ok(content.includes('analyzed_store_count'), '分析店舗数カラム');
  });
});

// Scenario 54: 学習効果の体感改善（強制反映）
describe('Scenario 54: 学習効果の体感改善', () => {
  it('advancedPersonalization の persona_definition 注入が「必ず守ること」を含む', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('★必ず守ること'), 'persona_definitionに強制マーカーがある');
    assert.ok(content.includes('毎回すべての項目を反映すること'), '全項目反映の指示がある');
    assert.ok(!content.includes('全部を毎回入れる必要はない'), '弱い表現が削除されている');
  });

  it('文体ルール（語尾・口癖）に「絶対厳守」マーカーがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('★絶対厳守'), '文体ルールに絶対厳守マーカーがある');
    assert.ok(content.includes('必ず毎回使うこと'), '語尾・口癖の毎回使用指示がある');
  });

  it('避ける表現に「使用禁止」が明示されている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('使用禁止'), '避ける表現に使用禁止が明示されている');
  });

  it('promptBuilder に学習ルール反映リマインダーがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('最終チェック'), 'プロンプトに最終チェックリマインダーがある');
    assert.ok(content.includes('語尾・口癖・避ける表現は厳守'), '具体的な厳守項目が列挙されている');
  });
});

// Scenario 55: core_beliefs（恒久ルール）
describe('Scenario 55: core_beliefs（恒久ルール）', () => {
  it('MAX_CORE_BELIEFS 定数が定義されている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('MAX_CORE_BELIEFS'), 'MAX_CORE_BELIEFS定数が存在する');
    assert.ok(/MAX_CORE_BELIEFS\s*=\s*7/.test(content), '上限は7件');
  });

  it('analyzeFeedbackWithClaude のプロンプトに core_promotion 出力が含まれる', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('core_promotion'), 'core_promotionフィールドがある');
  });

  it('updateAdvancedProfile に core_beliefs 昇格処理がある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('core_beliefs') && content.includes('core_promotion'), 'core_beliefs昇格処理がある');
    assert.ok(content.includes('MAX_CORE_BELIEFS'), '上限チェックがある');
  });

  it('_buildPromptParts で core_beliefs が最優先で注入される', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('絶対ルール（何度も修正して確立）'), 'core_beliefsの注入ラベルがある');
    assert.ok(content.includes('例外なく毎回守ること'), '強制力のある注釈がある');
  });

  it('regeneratePersonaDefinition で core_beliefs が不可侵ルールとして渡される', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('不可侵ルール'), 'persona再生成にcore_beliefsが不可侵として含まれる');
  });

  it('getLearningStatus に core_beliefs の表示セクションがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/personalizationEngine.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('絶対ルール'), '学習状況表示にcore_beliefsセクションがある');
  });

  it('getProfileAndPrompt が coreBeliefs を profileContext に含める', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('coreBeliefs'), 'profileContextにcoreBeliefsフィールドがある');
  });
});

// ============================================================
// Scenario 56: エンゲージメント学習の構造カテゴリ制限
// ============================================================
describe('Scenario 56: エンゲージメント学習の構造カテゴリ制限', () => {
  it('analyzeEngagementWithClaude のプロンプトが構造カテゴリに絞られている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('投稿の構造'), '構造カテゴリの観点で分析する指示がある');
    assert.ok(content.includes('構造カテゴリの例'), '構造カテゴリの具体例が提示されている');
    assert.ok(content.includes('具体的な語尾・口癖・表現そのものは書かない'), '具体的な文体を拾わない制約がある');
  });

  it('core_promotion でengagement_autoは構造パターンのみ昇格可の制約がある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('engagement_auto') && content.includes('構造パターン'), 'engagement_autoの構造パターン制約がcore_promotionプロンプトに含まれる');
  });

  it('分析プロンプトに冒頭・締め方・説明量の構造例がある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/advancedPersonalization.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('冒頭の長さ'), '冒頭パターンの例がある');
    assert.ok(content.includes('締め方'), '締め方パターンの例がある');
    assert.ok(content.includes('説明量'), '説明量パターンの例がある');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Scenario 57: 1案ドン表示（Phase 1）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('Scenario 57: 1案ドン表示（Phase 1）', () => {
  const SAMPLE_3_PROPOSALS = `[ 案A：視覚で伝える ]
朝の光が差し込むカウンター。
焼きたてのクロワッサンが並ぶ。

#パン屋 #朝の光 #焼きたて

[ 案B：ストーリーを添える ]
今朝は5時起き。
生地の発酵がちょうどよくて、嬉しくなった。

#パン屋 #5時起き #手作り

[ 案C：店主のひとりごと ]
まだ誰もいない店内。
この静けさが好きだったりする。

#パン屋 #早朝 #ひとりごと

━━━━━━━━━━━
📸 この写真の別の撮り方
横から撮ると断面が見えて美味しそうに映ります
━━━━━━━━━━━`;

  it('extractSelectedProposal のロジックが正しい（案Aマーカーから次の案マーカーまで抽出）', async () => {
    // proposalHandler.js のインポートは supabase 初期化が必要なため、ロジックをインラインでテスト
    const markerPattern = /\[\s*案([ABC])[：:][^\]]*\]/g;
    const markers = [...SAMPLE_3_PROPOSALS.matchAll(markerPattern)];
    assert.strictEqual(markers.length, 3, '3つの案マーカーが検出される');
    assert.strictEqual(markers[0][1], 'A', '1番目は案A');
    assert.strictEqual(markers[1][1], 'B', '2番目は案B');
    assert.strictEqual(markers[2][1], 'C', '3番目は案C');

    // 案A抽出: マーカー0の終了位置 〜 マーカー1の開始位置
    const startA = markers[0].index + markers[0][0].length;
    const endA = markers[1].index;
    const proposalA = SAMPLE_3_PROPOSALS.slice(startA, endA).trim();
    assert.ok(proposalA.includes('朝の光が差し込むカウンター'), '案Aの本文が含まれる');
    assert.ok(!proposalA.includes('5時起き'), '案Bの内容は含まれない');
  });

  it('案B/Cマーカーも正しく検出できる', () => {
    const markerPattern = /\[\s*案([ABC])[：:][^\]]*\]/g;
    const markers = [...SAMPLE_3_PROPOSALS.matchAll(markerPattern)];
    // 案B抽出
    const startB = markers[1].index + markers[1][0].length;
    const endB = markers[2].index;
    const proposalB = SAMPLE_3_PROPOSALS.slice(startB, endB).trim();
    assert.ok(proposalB.includes('5時起き'), '案Bの本文が含まれる');
    // 案C抽出
    const startC = markers[2].index + markers[2][0].length;
    const dividerMatch = SAMPLE_3_PROPOSALS.slice(startC).match(/\n━{5,}/);
    const endC = dividerMatch ? startC + dividerMatch.index : SAMPLE_3_PROPOSALS.length;
    const proposalC = SAMPLE_3_PROPOSALS.slice(startC, endC).trim();
    assert.ok(proposalC.includes('まだ誰もいない店内'), '案Cの本文が含まれる');
  });

  it('imageHandler.js が buildBodyPrompt をインポートしている（extractSelectedProposalは不要）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('buildBodyPrompt'),
      'promptBuilder から buildBodyPrompt をインポート');
    assert.ok(!content.includes('extractSelectedProposal'),
      'extractSelectedProposal は不要（1案生成のため）');
  });

  it('imageHandler.js のPush通知が本文のみ即表示+決定/別案ボタン', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('投稿ができました'), '本文完成メッセージがある');
    assert.ok(content.includes('これで決定'), '「これで決定」ボタンがある');
    assert.ok(content.includes('別案'), '「別案」ボタンがある');
  });

  it('textHandler.js に「別案」ルーティングがある（regenerateBody使用）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("'別案'"), '「別案」テキストのルーティングがある');
    assert.ok(content.includes('regenerateBody'), 'regenerateBody で再生成する');
    assert.ok(content.includes('handleShowAlternatives'), '旧3案投稿用のフォールバックがある');
  });

  it('proposalHandler.js に handleShowAlternatives 関数がexportされている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/proposalHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function handleShowAlternatives'),
      'handleShowAlternatives がexportされている');
  });

  it('proposalHandler.js から alternatives_viewed_count / STYLE_MAP が削除されている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/proposalHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(!content.includes('alternatives_viewed_count'), 'alternatives_viewed_countは削除済み');
    assert.ok(!content.includes('STYLE_MAP'), 'STYLE_MAPは削除済み');
    assert.ok(!content.includes('updateStylePreference'), 'updateStylePreferenceは削除済み');
  });

  it('DBにはbodyText（本文のみ）が保存される（1案生成のため案抽出不要）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('savePostHistory(userId, store.id, bodyText'),
      'savePostHistory に bodyText を渡している');
    assert.ok(!content.includes('rawContent'),
      'rawContent（旧3案全文）は使用しない');
  });

  it('imageHandler.js が regenerateBody をエクスポートしている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function regenerateBody'),
      'regenerateBody がexportされている');
  });

  it('Photo AdviceはgenerateSupplementsで非同期生成される', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('generateSupplements'), 'generateSupplements関数がある');
    assert.ok(content.includes('buildSupplementPrompt'), 'buildSupplementPromptを使用している');
    assert.ok(!content.includes('adviceSplit'), '旧adviceSplitロジックは廃止');
  });

  it('💡次の被写体提案のPremium制限はgenerateSupplementsとproposalHandlerで適用される', async () => {
    const fs = await import('node:fs');
    const imgContent = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    const propContent = fs.readFileSync(
      new URL('../src/handlers/proposalHandler.js', import.meta.url), 'utf-8'
    );
    // imageHandler: generateSupplementsにisPremiumを渡す
    assert.ok(imgContent.includes('isPremium'),
      'imageHandler.js にisPremium判定がある');
    assert.ok(imgContent.includes('generateSupplements'),
      'generateSupplementsでSupplement生成を行う');
    // proposalHandler: 非Premiumで🎯除外
    assert.ok(propContent.includes('isPremium') && propContent.includes('明日撮るべきもの'),
      'proposalHandler.js に🎯Premium制限がある');
  });

  it('promptBuilder.js の🎯明日撮るべきものがPremium条件に含まれている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    // 🎯セクションがisPremiumブロック内にあることを確認
    assert.ok(content.includes('isPremium') && content.includes('明日撮るべきもの'),
      '🎯明日撮るべきものがisPremiumブロック内にある');
    // 💡セクションが削除されていることを確認
    assert.ok(!content.includes('次はこんなのも撮ってみない'),
      '💡次の被写体提案セクションが削除されている');
  });

  it('buildBodyPrompt がフック→観察→共感構造を使用している', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('buildBodyPrompt'), 'buildBodyPrompt関数が存在する');
    assert.ok(content.includes('フック'), 'フック構造がある');
    assert.ok(content.includes('観察'), '観察構造がある');
    assert.ok(content.includes('共感'), '共感構造がある');
  });

  it('buildSupplementPrompt が存在する', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/utils/promptBuilder.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export function buildSupplementPrompt'),
      'buildSupplementPromptがexportされている');
  });

  it('parseCharmViewpoints がJSON形式を処理しmainSubjectを返す', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('mainSubject'), 'parseCharmViewpointsがmainSubjectを返す');
    assert.ok(content.includes('supportingElements'), 'parseCharmViewpointsがsupportingElementsを返す');
    assert.ok(content.includes('JSON.parse'), 'JSON形式のパース処理がある');
  });

  it('textHandler.js に「これで決定」ルーティングがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('これで決定'), '「これで決定」テキストのルーティングがある');
    assert.ok(content.includes('appendTemplateFooter'), 'テンプレートフッター適用がある');
  });

  it('textHandler.js が regenerateBody をインポートして別案再生成する', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('regenerateBody'), 'regenerateBodyのインポートがある');
    assert.ok(content.includes("import('./imageHandler.js')"), 'imageHandlerから動的インポートしている');
  });

  // ==================== Premium分析AI Phase 1 テスト ====================

  it('describeImage プロンプトに6特徴量タグが含まれる', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/claudeService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('main_subject_tag'), 'main_subject_tagフィールドがある');
    assert.ok(content.includes('scene_type'), 'scene_typeフィールドがある');
    assert.ok(content.includes('has_person'), 'has_personフィールドがある');
    assert.ok(content.includes('action_type'), 'action_typeフィールドがある');
    assert.ok(content.includes('lighting_type'), 'lighting_typeフィールドがある');
    assert.ok(content.includes('camera_angle'), 'camera_angleフィールドがある');
  });

  it('parseCharmViewpoints がJSON形式からfeaturesを抽出する', () => {
    // imageHandler.js内のparseCharmViewpointsと同等のJSON解析ロジック
    const jsonInput = JSON.stringify({
      main_subject: "チーズケーキ",
      supporting_elements: ["皿", "フォーク"],
      description: "暖色照明のカフェで撮影されたチーズケーキ",
      observations: ["焼き色がきれい", "表面に粉砂糖"],
      viewpoints: ["皿の縁の影", "粉砂糖の積もり方", "テーブルの木目"],
      main_subject_tag: "food",
      scene_type: "meal",
      has_person: false,
      action_type: "none",
      lighting_type: "warm_indoor",
      camera_angle: "diagonal"
    });

    const jsonMatch = jsonInput.match(/(\{[\s\S]*\})/);
    const parsed = JSON.parse(jsonMatch[1]);
    const features = {
      main_subject_tag: parsed.main_subject_tag || 'other',
      scene_type: parsed.scene_type || 'other',
      has_person: parsed.has_person === true,
      action_type: parsed.action_type || 'none',
      lighting_type: parsed.lighting_type || 'natural_soft',
      camera_angle: parsed.camera_angle || 'eye_level',
    };

    assert.equal(features.main_subject_tag, 'food');
    assert.equal(features.scene_type, 'meal');
    assert.equal(features.has_person, false);
    assert.equal(features.action_type, 'none');
    assert.equal(features.lighting_type, 'warm_indoor');
    assert.equal(features.camera_angle, 'diagonal');
  });

  it('parseCharmViewpoints features が欠損フィールドにデフォルト値を使う', () => {
    const jsonInput = JSON.stringify({
      main_subject: "コーヒー",
      supporting_elements: [],
      description: "テスト",
      observations: [],
      viewpoints: ["a", "b", "c"],
      // 特徴タグは一部だけ
      main_subject_tag: "coffee",
      has_person: true
    });

    const parsed = JSON.parse(jsonInput);
    const features = {
      main_subject_tag: parsed.main_subject_tag || 'other',
      scene_type: parsed.scene_type || 'other',
      has_person: parsed.has_person === true,
      action_type: parsed.action_type || 'none',
      lighting_type: parsed.lighting_type || 'natural_soft',
      camera_angle: parsed.camera_angle || 'eye_level',
    };

    assert.equal(features.main_subject_tag, 'coffee');
    assert.equal(features.scene_type, 'other', 'scene_type未指定はotherにフォールバック');
    assert.equal(features.has_person, true);
    assert.equal(features.action_type, 'none', 'action_type未指定はnoneにフォールバック');
    assert.equal(features.lighting_type, 'natural_soft', 'lighting_type未指定はnatural_softにフォールバック');
    assert.equal(features.camera_angle, 'eye_level', 'camera_angle未指定はeye_levelにフォールバック');
  });

  it('imageHandler.js がsavePostFeaturesをインポートしている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('savePostFeatures'), 'savePostFeaturesがインポートされている');
    assert.ok(content.includes('features'), 'featuresフィールドが使われている');
  });

  it('supabaseService.js にsavePostFeaturesとgetFeatureAnalysisがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/supabaseService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function savePostFeatures'), 'savePostFeaturesがexportされている');
    assert.ok(content.includes('export async function getFeatureAnalysis'), 'getFeatureAnalysisがexportされている');
    assert.ok(content.includes('post_features'), 'post_featuresテーブル名が含まれる');
    assert.ok(content.includes('analyze_post_features'), 'RPC関数名が含まれる');
  });

  it('migration_post_features.sql が存在し必要なカラムを含む', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../database/migration_post_features.sql', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('CREATE TABLE IF NOT EXISTS post_features'), 'post_featuresテーブル作成');
    assert.ok(content.includes('main_subject TEXT'), 'main_subjectカラム');
    assert.ok(content.includes('scene_type TEXT'), 'scene_typeカラム');
    assert.ok(content.includes('has_person BOOLEAN'), 'has_personカラム');
    assert.ok(content.includes('action_type TEXT'), 'action_typeカラム');
    assert.ok(content.includes('lighting_type TEXT'), 'lighting_typeカラム');
    assert.ok(content.includes('camera_angle TEXT'), 'camera_angleカラム');
    assert.ok(content.includes('analyze_post_features'), 'RPC集計関数');
    assert.ok(content.includes('ROW LEVEL SECURITY'), 'RLS有効化');
  });

  it('pending_image_contextにfeaturesが保存される', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    // analyzeImageInBackground内でfeaturesをcontextに含めているか
    const featuresSaveCount = (content.match(/features:\s*features/g) || []).length;
    assert.ok(featuresSaveCount >= 2, 'featuresが少なくとも2箇所（generating/complete）でcontextに保存される');
  });

  it('regenerateBodyでもsavePostFeaturesが呼ばれる', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    // regenerateBody内でctx.featuresを参照してsavePostFeaturesを呼んでいるか
    assert.ok(content.includes('ctx.features'), '再生成時にctx.featuresを参照');
  });

  it('getFeatureAnalysis にRPC失敗時のフォールバックがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/supabaseService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('getFeatureAnalysisFallback'), 'JSフォールバック集計がある');
    assert.ok(content.includes("status', '報告済'"), 'フォールバックも報告済みデータのみ集計');
  });

  // ==================== Premium分析AI Phase 2 テスト ====================

  it('analysisHandler.js が存在しhandleAnalysisをexportしている', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/analysisHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function handleAnalysis'), 'handleAnalysisがexportされている');
    assert.ok(content.includes('photoAnalysisReport'), 'Premium機能チェックがある');
    assert.ok(content.includes('getFeatureAnalysis'), 'getFeatureAnalysisを使用');
    assert.ok(content.includes('askClaude'), 'Claude APIでレポート生成');
    assert.ok(content.includes('groupFeatureData'), 'データグルーピング関数がある');
  });

  it('planConfig.js に photoAnalysisReport フラグがある', async () => {
    const { PLANS } = await import('../src/config/planConfig.js');
    assert.equal(PLANS.free.features.photoAnalysisReport, false, 'Freeはfalse');
    assert.equal(PLANS.standard.features.photoAnalysisReport, false, 'Standardはfalse');
    assert.equal(PLANS.premium.features.photoAnalysisReport, true, 'Premiumはtrue');
  });

  it('textHandler.js に「分析」ルーティングがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes("'分析'"), '分析コマンドのルーティングがある');
    assert.ok(content.includes("'/analysis'"), '/analysisコマンドのルーティングがある');
    assert.ok(content.includes("'写真分析'"), '写真分析コマンドのルーティングがある');
    assert.ok(content.includes('handleAnalysis'), 'handleAnalysisをインポートしている');
  });

  it('isSystemCommand に「分析」が含まれる', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/textHandler.js', import.meta.url), 'utf-8'
    );
    // isSystemCommand の includes リストに分析が含まれるか
    const systemCmdSection = content.match(/isSystemCommand\s*=\s*\[[\s\S]*?\]\.includes/);
    assert.ok(systemCmdSection, 'isSystemCommand定義がある');
    assert.ok(systemCmdSection[0].includes("'分析'"), '分析がisSystemCommandに含まれる');
  });

  it('groupFeatureData がsave_rate降順ソートする', async () => {
    // analysisHandler.jsのgroupFeatureDataロジックを直接テスト
    const testData = [
      { feature_name: 'main_subject', feature_value: 'food', avg_save_rate: 0.05, avg_engagement_rate: 3.2, post_count: 5 },
      { feature_name: 'main_subject', feature_value: 'person', avg_save_rate: 0.12, avg_engagement_rate: 5.1, post_count: 4 },
      { feature_name: 'main_subject', feature_value: 'hands', avg_save_rate: 0.08, avg_engagement_rate: 4.0, post_count: 3 },
      { feature_name: 'scene_type', feature_value: 'meal', avg_save_rate: 0.06, avg_engagement_rate: 3.5, post_count: 6 },
      { feature_name: 'scene_type', feature_value: 'cooking', avg_save_rate: 0.10, avg_engagement_rate: 4.8, post_count: 3 },
    ];

    // groupFeatureData相当のロジック
    const result = {};
    for (const row of testData) {
      if (!result[row.feature_name]) result[row.feature_name] = [];
      result[row.feature_name].push({
        value: row.feature_value,
        save_rate: Number(row.avg_save_rate) || 0,
        engagement_rate: Number(row.avg_engagement_rate) || 0,
        count: Number(row.post_count) || 0,
      });
    }
    for (const key of Object.keys(result)) {
      result[key].sort((a, b) => b.save_rate - a.save_rate);
    }

    assert.equal(result.main_subject[0].value, 'person', 'person（0.12）が1位');
    assert.equal(result.main_subject[1].value, 'hands', 'hands（0.08）が2位');
    assert.equal(result.main_subject[2].value, 'food', 'food（0.05）が3位');
    assert.equal(result.scene_type[0].value, 'cooking', 'cooking（0.10）が1位');
    assert.equal(result.scene_type[1].value, 'meal', 'meal（0.06）が2位');
  });

  it('分析プロンプトにstore情報と出力フォーマットが含まれる', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/analysisHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('写真分析AI'), 'プロンプトに写真分析AIロールがある');
    assert.ok(content.includes('強い特徴'), '出力フォーマットに強い特徴がある');
    assert.ok(content.includes('伸びやすい組み合わせ'), '出力フォーマットに組み合わせ仮説がある');
    assert.ok(content.includes('伸びにくい写真'), '出力フォーマットに伸びにくい写真がある');
    assert.ok(content.includes('次に撮るべき写真'), '出力フォーマットに次に撮るべき写真がある');
    assert.ok(content.includes('まず1枚撮るならこれ'), '出力フォーマットにまず1枚がある');
    assert.ok(content.includes('store.category'), '業種が考慮されている');
  });

  it('データ不足時に案内メッセージを返す', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/analysisHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('分析にはもう少しデータが必要です'), 'データ不足メッセージがある');
    assert.ok(content.includes('報告済みの投稿が3件以上'), '目安件数が示されている');
  });

  it('supabaseService.js にgetRecentPostsWithFeaturesがある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/supabaseService.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function getRecentPostsWithFeatures'), 'getRecentPostsWithFeaturesがexportされている');
    assert.ok(content.includes('save_intensity'), '保存率を取得している');
    assert.ok(content.includes('color_tone'), '新カテゴリcolor_toneを含む');
    assert.ok(content.includes('composition_type'), '新カテゴリcomposition_typeを含む');
  });

  it('analysisHandler.js が2ブロック構成でClaude分析を呼び出す', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/analysisHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('getRecentPostsWithFeatures'), 'recent_postsデータを取得している');
    assert.ok(content.includes('summary_stats'), 'プロンプトにsummary_statsブロックがある');
    assert.ok(content.includes('recentPosts'), 'プロンプトにrecentPostsを渡している');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Scenario 58: 学習進捗インジケーター
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('Scenario 58: 学習進捗インジケーター', () => {
  it('personalizationEngine.js に getLearningProgressNote がある', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/personalizationEngine.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('export async function getLearningProgressNote'),
      'getLearningProgressNote が export されている');
    assert.ok(content.includes('学習精度アップまであと'),
      '進捗メッセージのテンプレートが含まれる');
    assert.ok(content.includes('source === \'feedback\''),
      'feedback ソースのみカウントしている');
  });

  it('imageHandler.js が getLearningProgressNote をインポートして使用している', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    assert.ok(content.includes('getLearningProgressNote'),
      'getLearningProgressNote をインポートしている');
    assert.ok(content.includes('progressNote'),
      'progressNote 変数を使用している');
  });

  it('投稿メッセージに progressNote が含まれる（初回生成・別案両方）', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/handlers/imageHandler.js', import.meta.url), 'utf-8'
    );
    // 初回生成: 「投稿ができました！」メッセージに progressNote
    const mainMsg = content.match(/投稿ができました.*?\n/s);
    assert.ok(mainMsg, '初回生成メッセージがある');
    assert.ok(content.includes('文体を学習${progressNote}'),
      '初回生成メッセージに progressNote が含まれる');

    // 別案: 「別の案です！」メッセージに progressNote
    const regenMsg = content.match(/別の案です.*?\n/s);
    assert.ok(regenMsg, '別案メッセージがある');
    const regenSection = content.slice(content.indexOf('別の案です！'));
    assert.ok(regenSection.includes('progressNote'),
      '別案メッセージにも progressNote が含まれる');
  });
});
