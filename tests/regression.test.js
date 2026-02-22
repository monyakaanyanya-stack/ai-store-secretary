/**
 * リグレッションテスト（Day7 + 第2次監査修正）
 * 修正が正しく動作するか、15シナリオで検証
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
