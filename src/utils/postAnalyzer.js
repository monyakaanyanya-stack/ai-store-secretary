/**
 * 投稿の骨格を解析する（APIなし・コードのみ・軽量）
 *
 * 報告が来たとき、その投稿テキストから構造的特徴を抽出する。
 * 高save_intensityの投稿のパターンを学習し、次の生成に活かす。
 */

// 感情先行ワード（1行目にこれがあれば emotion）
const EMOTION_WORDS = [
  'まじ', 'やば', 'うれし', '嬉し', '好き', '最高', '感動', 'ありがとう',
  'すごい', 'すごく', '大好き', 'たのし', '楽し', 'わくわく', 'ドキドキ',
  'めっちゃ', 'ほんと', '本当に', 'びっくり', 'テンション', '幸せ',
  'かわいい', '可愛い', 'きれい', '綺麗', 'おいし', '美味し', '最近ハマ',
  'なんかこれ', 'これ好き', '好きすぎ', 'やめられ', 'また来た', 'また頼',
];

// 質問パターン
const QUESTION_PATTERN = /[？?]|知ってる|でしょう?か|ですか/;

// CTAワード（Call to Action）
const CTA_WORDS = [
  'ぜひ', 'チェック', '見てみて', '来てね', 'お待ち', 'フォロー',
  'してみて', 'してみてね', 'ください', 'どうぞ', 'プロフィール',
  'リンク', 'DM', 'お問い合わせ', '試して', '気になった', '保存して',
  '参考に', 'まずは', 'お気軽に',
];

/**
 * 投稿テキストの骨格を解析
 * @param {string} text - 投稿テキスト（ハッシュタグ・Photo Advice含む）
 * @returns {Object} - 骨格データ
 */
export function analyzePostStructure(text) {
  // C21修正: typeof チェック（数値やオブジェクトが渡されてもクラッシュしない）
  if (!text || typeof text !== 'string' || text.length < 5) return getDefaultStructure();

  // 本文のみ抽出（ハッシュタグ・Photo Advice除去）
  const body = extractBody(text);
  if (!body || body.length < 5) return getDefaultStructure();

  const lines = body.split('\n').filter(l => l.trim().length > 0);
  const firstLine = lines[0] || '';

  return {
    hook_type: detectHookType(firstLine),
    has_cta: detectCTA(body),
    cta_position: detectCTAPosition(body),
    line_break_density: calcLineBreakDensity(body),
    opening_word: extractOpeningWord(firstLine),
    line_count: lines.length,
    avg_line_length: lines.length > 0
      ? Math.round(lines.reduce((sum, l) => sum + l.length, 0) / lines.length)
      : 0,
    body_length: body.length,
  };
}

/**
 * 本文を抽出（ハッシュタグ行・Photo Advice区切り以降を除去）
 */
function extractBody(text) {
  // Photo Advice区切り（━）以降を除去
  let body = text.split(/━{3,}/)[0];

  // ハッシュタグ行を除去（#で始まる行、または行末にハッシュタグがまとまっている部分）
  body = body.replace(/\n#[^\n]+$/gm, '');
  body = body.replace(/#[^\s#]+/g, '').trim();

  return body.trim();
}

/**
 * 1行目の書き出しタイプを判定
 *   emotion    : 感情先行（やばい、好きすぎ、めっちゃ、etc.）
 *   question   : 質問（〜ですか？、知ってる？）
 *   taigen_dome: 体言止め（短い名詞で終わる）
 *   fact       : 事実先行（新商品、今日、数字など）
 *   unknown    : 判定不能
 */
function detectHookType(firstLine) {
  if (!firstLine) return 'unknown';
  const trimmed = firstLine.trim();

  // 質問
  if (QUESTION_PATTERN.test(trimmed)) return 'question';

  // 感情先行
  if (EMOTION_WORDS.some(w => trimmed.includes(w))) return 'emotion';

  // 体言止め（末尾が動詞・形容詞・です/ますで終わらない短い行）
  const endsWithVerb = /(?:する|した|して|している|します|しました|ます|ました|です|だ|な|に|を|は|が|の)$/.test(
    trimmed.replace(/[。、！？!?🎉✨💫🌸🍀]/g, '')
  );
  if (!endsWithVerb && trimmed.length <= 25) return 'taigen_dome';

  // 事実先行
  if (/^[\d０-９]|新(しい|作|商品|メニュー)|今日|本日|限定|入荷|お知らせ|告知/.test(trimmed)) return 'fact';

  return 'unknown';
}

/**
 * CTA（行動喚起）の有無を判定
 */
function detectCTA(body) {
  return CTA_WORDS.some(w => body.includes(w));
}

/**
 * CTAの位置を判定
 *   none   : CTAなし
 *   early  : 前半（40%未満）
 *   middle : 中盤（40〜75%）
 *   end    : 後半（75%以上）
 */
function detectCTAPosition(body) {
  const hasCTA = CTA_WORDS.some(w => body.includes(w));
  if (!hasCTA) return 'none';

  let firstCTAPos = body.length;
  for (const word of CTA_WORDS) {
    const pos = body.indexOf(word);
    if (pos !== -1 && pos < firstCTAPos) firstCTAPos = pos;
  }

  const ratio = firstCTAPos / body.length;
  if (ratio < 0.4) return 'early';
  if (ratio < 0.75) return 'middle';
  return 'end';
}

/**
 * 改行密度を計算（改行数 ÷ 文字数）
 * 高いほど縦に読みやすい構造
 */
function calcLineBreakDensity(body) {
  if (!body || body.length === 0) return 0;
  const lineBreaks = (body.match(/\n/g) || []).length;
  return parseFloat((lineBreaks / body.length).toFixed(4));
}

/**
 * 書き出しワード（最初の8文字）を抽出
 */
function extractOpeningWord(firstLine) {
  if (!firstLine) return '';
  return firstLine.trim().slice(0, 8);
}

/**
 * デフォルト構造（解析不能時）
 */
function getDefaultStructure() {
  return {
    hook_type: 'unknown',
    has_cta: false,
    cta_position: 'none',
    line_break_density: 0,
    opening_word: '',
    line_count: 0,
    avg_line_length: 0,
    body_length: 0,
  };
}

/**
 * 複数投稿の構造パターンを集計して「勝ちパターン」を抽出
 *
 * 設計思想：
 * - 勝ちの定義を固定: score = 保存×3 + いいね
 * - 最低10件以上ないと仮説も立てない
 * - 上位30%のみをパターン抽出の対象にする
 * - 信頼レベルを明示（10件=仮説, 20件=参考, 30件+=高信頼）
 *
 * @param {Array} posts - engagement_metricsの配列（全件渡す）
 * @param {number} minCount - 最低件数（これ未満はnullを返す）
 * @returns {Object|null} - 勝ちパターン、データ不足の場合はnull
 */
export function extractWinningPattern(posts, minCount = 10) {
  // post_structureがあり、hook_typeが判定できている投稿のみ対象
  const withStructure = posts.filter(p => p.post_structure && p.post_structure.hook_type !== 'unknown');

  if (withStructure.length < minCount) return null;

  // ① 勝ちの定義を固定: score = 保存×3 + いいね
  const scored = withStructure.map(p => ({
    ...p,
    _score: (p.saves_count || 0) * 3 + (p.likes_count || 0),
  })).sort((a, b) => b._score - a._score);

  // ② 上位30%のみ抽出（最低3件は確保）
  const topCount = Math.max(3, Math.round(scored.length * 0.3));
  const topPosts = scored.slice(0, topCount);

  // ③ 信頼レベルの判定
  const confidenceLevel = withStructure.length >= 30 ? 'high'
    : withStructure.length >= 20 ? 'medium'
    : 'low'; // 10件 = 仮説段階

  // hook_typeの集計（上位30%から）
  const hookTypeCounts = {};
  topPosts.forEach(p => {
    const ht = p.post_structure.hook_type;
    hookTypeCounts[ht] = (hookTypeCounts[ht] || 0) + 1;
  });
  // M13修正: hookTypeCounts が空の場合のガード
  const hookEntries = Object.entries(hookTypeCounts);
  const dominantHookType = hookEntries.length > 0
    ? hookEntries.sort((a, b) => b[1] - a[1])[0][0]
    : 'unknown';
  const dominantHookRatio = topPosts.length > 0
    ? Math.round((hookTypeCounts[dominantHookType] || 0) / topPosts.length * 100)
    : 0;

  // CTA位置の集計（上位30%から）
  const ctaPositionCounts = {};
  topPosts.forEach(p => {
    const pos = p.post_structure.cta_position || 'none';
    ctaPositionCounts[pos] = (ctaPositionCounts[pos] || 0) + 1;
  });
  const dominantCTAPosition = Object.entries(ctaPositionCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  // 文字数帯の集計（上位30%から）
  const charBucketCounts = {};
  topPosts.forEach(p => {
    const len = p.post_structure.body_length || 0;
    const bucket = len < 100 ? 'short' : len < 200 ? 'medium' : 'long';
    charBucketCounts[bucket] = (charBucketCounts[bucket] || 0) + 1;
  });
  const dominantCharBucket = Object.entries(charBucketCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  // 改行密度の平均（上位30%から）
  const avgLineBreakDensity = topPosts.reduce(
    (sum, p) => sum + (p.post_structure.line_break_density || 0), 0
  ) / topPosts.length;

  // save_intensityの平均（上位30%から）
  const avgSaveIntensity = topPosts.reduce(
    (sum, p) => sum + (p.save_intensity || 0), 0
  ) / topPosts.length;

  return {
    dominantHookType,
    dominantHookRatio,
    dominantCTAPosition,
    dominantCharBucket,          // 'short' | 'medium' | 'long'
    avgLineBreakDensity: parseFloat(avgLineBreakDensity.toFixed(4)),
    avgSaveIntensity: parseFloat(avgSaveIntensity.toFixed(3)),
    sampleSize: withStructure.length, // 全体サンプル数
    topCount,                    // 上位30%の件数
    confidenceLevel,             // 'low' | 'medium' | 'high'
  };
}

/**
 * hook_typeを日本語に変換
 */
export function hookTypeToJapanese(hookType) {
  const map = {
    emotion: '感情・本音先行（「やばい」「好き」など）',
    question: '問いかけ（「〜知ってる？」など）',
    taigen_dome: '体言止め（短い名詞で余白）',
    fact: '事実・お知らせ先行',
    unknown: '様々',
  };
  return map[hookType] || hookType;
}

/**
 * CTA位置を日本語に変換
 */
export function ctaPositionToJapanese(pos) {
  const map = {
    none: 'CTAなし',
    early: '冒頭',
    middle: '中盤',
    end: '末尾',
  };
  return map[pos] || pos;
}
