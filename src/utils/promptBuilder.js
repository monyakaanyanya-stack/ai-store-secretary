const TONE_MAP = {
  // 日本語キー（優先）
  'カジュアル': {
    name: 'カジュアル（タメ口）',
    persona: 'あなたは実際にお店を運営している本人です。Instagramに自分の言葉でタメ口で投稿してください。AIが生成した感じを一切出さず、本当にその場にいる人間が書いたような文章にしてください。',
    style_rules: [
      '完全なタメ口。「〜だった」「〜した」「〜かも」「〜じゃん」「〜だね」「〜だな」が語尾',
      '「です・ます・ます体」は1文字も使わない。「〜んです」「〜だと思います」「〜なります」も全部NG',
      '1文は短く（10〜20文字）。改行を多用して縦に展開する',
      '感情・驚き・本音を最初に置く。「やばい」「まじか」「好きすぎる」「うれしい」から始めてOK',
      '絵文字は文末に1〜2個だけ。絵文字で始めない',
      '「なんか〜」「ちょっと〜」「めっちゃ〜」などの口語表現を自然に使う',
    ],
    forbidden_words: [
      'です', 'ます', 'ございます', 'させていただく',
      'お客様', '皆様', 'ご紹介', 'ご来店',
      '幻想的', '魅了', '洗練', '本質的', '彩る', '溢れる',
      'いたします', 'でしょう', 'なのです', 'なります', 'だと思います', 'んです',
      '是非', 'ぜひとも', '素敵な', '特別な時間', '心ゆくまで',
    ],
    good_examples: [
      'これ今日届いたやつ\nずっと待ってたからうれし\nテンション上がりすぎてる🙌',
      'これがまじでよかった\n思ってたより全然いい\nまた絶対頼む',
      'なんかこれすごい好き\n言葉にできないけど\nずっと見てられるやつ',
      'やばすぎて笑えない\n久しぶりにこれだけ感動した\nみんなにも見せたい',
    ],
    bad_examples: [
      '今日は新商品が届きました😊本当に素敵なアイテムです。ぜひご覧ください',
      '幻想的な雰囲気に包まれた素晴らしい体験でした',
      'こちらの商品をご紹介させていただきます',
      '皆様のご来店をお待ちしております',
      '実際に使ってみたんですが、本当によかったと思います',
    ],
  },

  'フレンドリー': {
    name: 'フレンドリー（親しみやすい）',
    persona: 'あなたは実際にお店を運営している本人です。Instagramで友達に話しかけるように、自然に親しみやすく投稿してください。AIが生成した感じを一切出さず、本物の人間らしい文章にしてください。',
    style_rules: [
      '「です・ます」調でOKだが、「だよ」「だね」「してみてね」なども混ぜる',
      '「させていただく」「ございます」は絶対使わない。堅苦しさゼロで',
      '感情や発見を素直に書く。「嬉しい」「びっくりした」「気に入った」などを自然に',
      '改行で読みやすく。1〜2文で改行する',
      '絵文字は2〜3個。文章の中に自然に混ぜる',
      '「みんな」「一緒に」「また来てね」など親近感のある表現を使う',
    ],
    forbidden_words: [
      'ございます', 'させていただく', 'いたします',
      '皆様', 'ご来店', '心より',
      '幻想的', '魅了', '洗練', '本質的', '彩る',
      '是非', 'ぜひとも', '特別な時間', '心ゆくまで',
    ],
    good_examples: [
      '新しいの入荷しました📦\n思ってたよりずっといい感じで嬉しい✨\nみんなはもう見てくれた？',
      '久しぶりにこれ使ったら\nやっぱり好きだなってなった\nまた仕入れてよかった',
      '今日のはこれです🎉\n気に入ってくれたら嬉しいな\nぜひ一度試してみてね',
    ],
    bad_examples: [
      '本日は新メニューをご紹介させていただきます。皆様ぜひご来店ください',
      '幻想的な雰囲気をお楽しみいただけます',
      '心より皆様のご来店をお待ちしております',
    ],
  },

  '丁寧': {
    name: '丁寧（プロフェッショナル）',
    persona: 'あなたは実際にお店を運営している本人です。お客様に丁寧に、でも堅苦しくなく、温かみを持って伝えてください。AIが書いた感じを出さず、誠実な人間の言葉で書いてください。',
    style_rules: [
      '「です・ます」調。でも冷たくなく、温かさを込める',
      '「させていただく」「ございます」は使わない。「です」「ます」「します」で十分',
      '短く具体的に。1文で情報を詰め込まず、改行で分ける',
      '絵文字は1〜2個。控えめに、でも無機質にならないよう使う',
      '数字・具体的な情報を入れると読んでもらいやすい（時間、価格、日程など）',
    ],
    forbidden_words: [
      'ございます', 'させていただきます', 'いたします', 'いただけます',
      '幻想的', '魅了', '洗練された', '本質的', '彩る', '溢れる',
      '心より', '心ゆくまで', '是非', 'ぜひとも', '特別なひととき',
    ],
    good_examples: [
      '新しい商品が入りました\n今週から販売します\nぜひお試しください✨',
      '本日は18時で閉店します\nお気をつけてお越しください',
      '今月の新作です\nこだわりの素材を使っています\nぜひ一度手に取ってみてください',
    ],
    bad_examples: [
      '本日は新商品をご紹介させていただきます。心よりお待ち申し上げます',
      '洗練された空間でお楽しみいただけます',
      '素晴らしい体験をご提供いたします',
    ],
  },

  // 後方互換性のため英語キーも残す
  casual: {
    name: 'カジュアル（タメ口）',
    persona: 'あなたは実際にお店を運営している本人です。Instagramに自分の言葉でタメ口で投稿してください。AIが生成した感じを一切出さず、本当にその場にいる人間が書いたような文章にしてください。',
    style_rules: [
      '完全なタメ口。「〜だった」「〜した」「〜かも」「〜じゃん」「〜だね」「〜だな」が語尾',
      '「です・ます・ます体」は1文字も使わない。「〜んです」「〜だと思います」「〜なります」も全部NG',
      '1文は短く（10〜20文字）。改行を多用して縦に展開する',
      '感情・驚き・本音を最初に置く。「やばい」「まじか」「好きすぎる」「うれしい」から始めてOK',
      '絵文字は文末に1〜2個だけ。絵文字で始めない',
      '「なんか〜」「ちょっと〜」「めっちゃ〜」などの口語表現を自然に使う',
    ],
    forbidden_words: [
      'です', 'ます', 'ございます', 'させていただく',
      'お客様', '皆様', 'ご紹介', 'ご来店',
      '幻想的', '魅了', '洗練', '本質的', '彩る', '溢れる',
      'いたします', 'でしょう', 'なのです', 'なります', 'だと思います', 'んです',
      '是非', 'ぜひとも', '素敵な', '特別な時間', '心ゆくまで',
    ],
    good_examples: [
      'これ今日届いたやつ\nずっと待ってたからうれし\nテンション上がりすぎてる🙌',
      'これがまじでよかった\n思ってたより全然いい\nまた絶対頼む',
      'なんかこれすごい好き\n言葉にできないけど\nずっと見てられるやつ',
      'やばすぎて笑えない\n久しぶりにこれだけ感動した\nみんなにも見せたい',
    ],
    bad_examples: [
      '今日は新商品が届きました😊本当に素敵なアイテムです。ぜひご覧ください',
      '幻想的な雰囲気に包まれた素晴らしい体験でした',
      'こちらの商品をご紹介させていただきます',
      '皆様のご来店をお待ちしております',
      '実際に使ってみたんですが、本当によかったと思います',
    ],
  },

  friendly: {
    name: 'フレンドリー（親しみやすい）',
    persona: 'あなたは実際にお店を運営している本人です。Instagramで友達に話しかけるように、自然に親しみやすく投稿してください。AIが生成した感じを一切出さず、本物の人間らしい文章にしてください。',
    style_rules: [
      '「です・ます」調でOKだが、「だよ」「だね」「してみてね」なども混ぜる',
      '「させていただく」「ございます」は絶対使わない。堅苦しさゼロで',
      '感情や発見を素直に書く。「嬉しい」「びっくりした」「気に入った」などを自然に',
      '改行で読みやすく。1〜2文で改行する',
      '絵文字は2〜3個。文章の中に自然に混ぜる',
      '「みんな」「一緒に」「また来てね」など親近感のある表現を使う',
    ],
    forbidden_words: [
      'ございます', 'させていただく', 'いたします',
      '皆様', 'ご来店', '心より',
      '幻想的', '魅了', '洗練', '本質的', '彩る',
      '是非', 'ぜひとも', '特別な時間', '心ゆくまで',
    ],
    good_examples: [
      '新しいの入荷しました📦\n思ってたよりずっといい感じで嬉しい✨\nみんなはもう見てくれた？',
      '久しぶりにこれ使ったら\nやっぱり好きだなってなった\nまた仕入れてよかった',
      '今日のはこれです🎉\n気に入ってくれたら嬉しいな\nぜひ一度試してみてね',
    ],
    bad_examples: [
      '本日は新メニューをご紹介させていただきます。皆様ぜひご来店ください',
      '幻想的な雰囲気をお楽しみいただけます',
      '心より皆様のご来店をお待ちしております',
    ],
  },

  professional: {
    name: '丁寧（プロフェッショナル）',
    persona: 'あなたは実際にお店を運営している本人です。お客様に丁寧に、でも堅苦しくなく、温かみを持って伝えてください。AIが書いた感じを出さず、誠実な人間の言葉で書いてください。',
    style_rules: [
      '「です・ます」調。でも冷たくなく、温かさを込める',
      '「させていただく」「ございます」は使わない。「です」「ます」「します」で十分',
      '短く具体的に。1文で情報を詰め込まず、改行で分ける',
      '絵文字は1〜2個。控えめに、でも無機質にならないよう使う',
      '数字・具体的な情報を入れると読んでもらいやすい（時間、価格、日程など）',
    ],
    forbidden_words: [
      'ございます', 'させていただきます', 'いたします', 'いただけます',
      '幻想的', '魅了', '洗練された', '本質的', '彩る', '溢れる',
      '心より', '心ゆくまで', '是非', 'ぜひとも', '特別なひととき',
    ],
    good_examples: [
      '新しい商品が入りました\n今週から販売します\nぜひお試しください✨',
      '本日は18時で閉店します\nお気をつけてお越しください',
      '今月の新作です\nこだわりの素材を使っています\nぜひ一度手に取ってみてください',
    ],
    bad_examples: [
      '本日は新商品をご紹介させていただきます。心よりお待ち申し上げます',
      '洗練された空間でお楽しみいただけます',
      '素晴らしい体験をご提供いたします',
    ],
  },
};

export const POST_LENGTH_MAP = {
  // 日本語キー（優先）
  '超短文': { range: '80文字以内（絶対厳守）', description: '超短文（コンパクト）' },
  '短文': { range: '100-150文字', description: '短文' },
  '中文': { range: '200-300文字', description: '中文' },
  '長文': { range: '400-500文字', description: '長文' },

  // 後方互換性のため英語キーも残す
  xshort: { range: '80文字以内（絶対厳守）', description: '超短文（コンパクト）' },
  short: { range: '100-150文字', description: '短文' },
  medium: { range: '200-300文字', description: '中文' },
  long: { range: '400-500文字', description: '長文' },
};

// L5: import文は本来先頭に置くべきだが、ESMがhoistするため実害はない
// 次回リファクタ時にファイル先頭に移動すること
import { getHashtagsForCategory } from '../config/categoryDictionary.js';

function getToneName(tone) {
  const toneData = TONE_MAP[tone] || TONE_MAP.casual;
  return toneData.name;
}

function getToneData(tone) {
  return TONE_MAP[tone] || TONE_MAP.casual;
}

function getPostLengthInfo(length = 'medium') {
  return POST_LENGTH_MAP[length] || POST_LENGTH_MAP.medium;
}

/**
 * 店舗登録テキストを解析するプロンプト
 */
export function buildStoreParsePrompt(userInput) {
  return `以下のテキストから店舗情報を抽出して、JSON形式で返してください。

入力テキスト: ${userInput}

必ず以下のJSON形式でのみ回答してください。説明文や追加のテキストは一切含めず、JSONのみを出力してください:

{
  "category": "業種（例: ネイルサロン、カフェ、ベーカリーなど）",
  "name": "店舗名",
  "strength": "こだわりや強み",
  "tone": "フレンドリー"
}

tone は必ず以下のいずれか1つを選んでください:
- フレンドリー (親しみやすい・明るい)
- 丁寧 (プロフェッショナル・ビジネス的)
- カジュアル (タメ口・親しみやすい)

category は入力された業種をそのまま使用してください。

重要: 必ずJSONのみを返し、他の文章を含めないでください。`;
}

/**
 * キャラクター設定をプロンプトに変換
 */
function buildCharacterSection(store) {
  const character = store.config?.character_settings;
  if (!character) return '';

  const parts = [];

  if (character.catchphrases && character.catchphrases.length > 0) {
    parts.push(`【口癖・よく使う表現（必ず使う）】\n${character.catchphrases.join('、')}`);
  }

  if (character.ng_words && character.ng_words.length > 0) {
    parts.push(`【絶対に使わないフレーズ（NG）】\n${character.ng_words.join('、')}`);
  }

  if (character.personality) {
    parts.push(`【キャラクター・個性】\n${character.personality}`);
  }

  if (parts.length === 0) return '';

  return `\n━━━━━━━━━━━━━━━━━━━━━━━━\n🎭 あなたの個性（最優先で反映）\n━━━━━━━━━━━━━━━━━━━━━━━━\n${parts.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
}

/**
 * 画像から投稿を生成するプロンプト
 */
export function buildImagePostPrompt(store, lengthOverride = null, blendedInsights = null, personalization = '', imageDescription = null) {
  const postLength = lengthOverride || store.config?.post_length || 'xshort';
  const lengthInfo = getPostLengthInfo(postLength);
  const toneData = getToneData(store.tone);

  const templates = store.config?.templates || {};
  // templateInfoはAIに渡さない（生成後に末尾固定追記するため）
  const templateInfo = '';

  // 集合知データの構築（同業種の成功パターンを反映）
  let collectiveIntelligenceSection = '';
  let industryPatternSection = ''; // 業種傾向（参考）セクション（署名性保護のため分離）
  let dbTags = [];

  if (blendedInsights) {
    const { category, group, own } = blendedInsights;
    const insights = [];

    // C20修正: topHashtags が Array であることを確認してからスライス
    if (category && category.sampleSize > 0 && Array.isArray(category.topHashtags)) {
      dbTags.push(...category.topHashtags.slice(0, 3));
    }
    if (group && group.sampleSize > 0 && Array.isArray(group.topHashtags)) {
      dbTags.push(...group.topHashtags.slice(0, 2));
    }
    // DBデータがない場合は辞書の静的タグにフォールバック
    if (dbTags.length === 0 && store.category) {
      const staticTags = getHashtagsForCategory(store.category);
      dbTags.push(...staticTags.slice(0, 5));
    }

    // M5: 保存強度が高い投稿の文字数（メイン指標）— ?? で 0 を正しく扱う
    const topPostsLength = category?.topPostsAvgLength ?? group?.topPostsAvgLength;
    const topSaveIntensity = category?.topPostsAvgSaveIntensity ?? group?.topPostsAvgSaveIntensity;
    if (topPostsLength) {
      const intensityNote = topSaveIntensity != null
        ? `（保存強度 ${topSaveIntensity.toFixed(2)} の投稿群）`
        : '';
      insights.push(`【文字数（必須）】\n保存されやすい投稿${intensityNote}の平均文字数: ${topPostsLength}文字\n※ この文字数を目安に作成してください`);
    }

    const avgEmojiCount = category?.avgEmojiCount ?? group?.avgEmojiCount;
    if (avgEmojiCount !== undefined && avgEmojiCount !== null) {
      insights.push(`【絵文字（必須）】\n同業種の平均絵文字数: ${Math.round(avgEmojiCount)}個\n※ この数を目安に使用してください`);
    }

    const bestHours = category?.bestPostingHours || group?.bestPostingHours;
    if (bestHours && bestHours.length > 0) {
      insights.push(`【参考】最適投稿時間帯: ${bestHours.join('時, ')}時`);
    }

    // 勝ちパターン: 出所で扱いを分ける（署名性保護）
    // - 自店舗データ → 必須セクション内に「積極参考」として残す（このお店のファンに効くパターン）
    // - 業種データのみ → 別の「傾向参考」セクションへ（業種平均は均質化リスクあるため強制しない）
    const ownWinningPattern = own?.winningPattern;
    const industryWinningPattern = ownWinningPattern ? null : (category?.winningPattern || group?.winningPattern);

    if (ownWinningPattern) {
      const hookJp = buildHookTypeJapanese(ownWinningPattern.dominantHookType);
      const ctaJp = buildCTAPositionJapanese(ownWinningPattern.dominantCTAPosition);
      const lineBreakNote = ownWinningPattern.avgLineBreakDensity >= 0.06
        ? '多め（縦長・読みやすい構造）'
        : ownWinningPattern.avgLineBreakDensity >= 0.03
        ? '標準的'
        : '少なめ（まとまった段落）';
      const charBucketJp = buildCharBucketJapanese(ownWinningPattern.dominantCharBucket);
      const confidenceLabel = buildConfidenceLabel(ownWinningPattern.confidenceLevel);
      insights.push(`【🎯 あなたの店で保存されやすかった型${confidenceLabel}（${ownWinningPattern.sampleSize}件・あなた固有のデータ）】\n・1行目: ${hookJp}（${ownWinningPattern.dominantHookRatio}%）\n・文字数帯: ${charBucketJp}\n・CTA位置: ${ctaJp}\n・改行: ${lineBreakNote}\n→ このお店のフォロワーに刺さりやすいパターン。積極的に参考にしてよい`);
    }

    if (industryWinningPattern) {
      const hookJp = buildHookTypeJapanese(industryWinningPattern.dominantHookType);
      const ctaJp = buildCTAPositionJapanese(industryWinningPattern.dominantCTAPosition);
      const lineBreakNote = industryWinningPattern.avgLineBreakDensity >= 0.06
        ? '多め（縦長・読みやすい構造）'
        : industryWinningPattern.avgLineBreakDensity >= 0.03
        ? '標準的'
        : '少なめ（まとまった段落）';
      const charBucketJp = buildCharBucketJapanese(industryWinningPattern.dominantCharBucket);
      const sourceName = category?.winningPattern
        ? `同業種（${blendedInsights.categoryGroup || ''}）`
        : 'グループ';
      industryPatternSection = `\n━━━━━━━━━━━━━━━━━━━━━━━━\n📈 ${sourceName}の傾向（参考・この店の個性を優先してよい）\n━━━━━━━━━━━━━━━━━━━━━━━━\n以下は業種全体の平均傾向です。この写真・この店の文脈と合わなければ無視してよい：\n・書き出し: ${hookJp}が多い（${industryWinningPattern.dominantHookRatio}%）\n・文字数帯: ${charBucketJp}\n・CTA: ${ctaJp}\n・改行: ${lineBreakNote}\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }

    if (insights.length > 0) {
      collectiveIntelligenceSection = `\n━━━━━━━━━━━━━━━━━━━━━━━━\n📊 集合知データ【必ず反映すること】（同業種${category?.sampleSize || 0}件・保存強度ベース）\n※ 以下の指示は「守ること」セクションより優先して厳守する\n━━━━━━━━━━━━━━━━━━━━━━━━\n${insights.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }
  }

  // ハッシュタグ指示（優先順位: テンプレ固定タグ → 関連タグ → 集合知タグ）
  const categoryHint = store.category ? `業種「${store.category}」` : '';
  const templateHashtags = templates.hashtags || [];
  let hashtagInstruction = '';

  if (imageDescription) {
    const fixedTagNote = templateHashtags.length > 0
      ? `\n【固定ハッシュタグ（必ず先頭に含める）】\n${templateHashtags.join(' ')}\n上記の後に以下を追加:`
      : '';
    const collectiveTagNote = dbTags && dbTags.length > 0
      ? `\n追加可能な業種タグ（上記の後に1-3個追加してよい）: ${dbTags.join(', ')}`
      : '';
    hashtagInstruction = `\n【ハッシュタグ（厳守）】${fixedTagNote}\n順番: ${templateHashtags.length > 0 ? '①固定タグ（上記）→ ' : ''}②写真に実際に写っているもの・${categoryHint}に直結するタグ（3-5個）→ ③業種の定番タグ（1-3個）\n絶対NG：写真に写っていないもののタグ、#instagood #japan #photooftheday などの汎用タグ${collectiveTagNote}`;
  } else if (!collectiveIntelligenceSection) {
    const fixedTagNote = templateHashtags.length > 0
      ? `\n【固定ハッシュタグ（必ず先頭に含める）】\n${templateHashtags.join(' ')}\n上記の後に関連タグを追加:`
      : '';
    const staticTagNote = dbTags && dbTags.length > 0
      ? `\n以下の業種タグから3-5個を必ず使用: ${dbTags.join(', ')}`
      : '';
    hashtagInstruction = `\n【ハッシュタグ（必須）】${fixedTagNote}\n${categoryHint}この投稿内容に最も合うタグを合計5-8個。#instagood #japan など汎用タグは使わない。${staticTagNote}`;
  } else if (templateHashtags.length > 0) {
    // 集合知セクションがある場合でも固定タグを優先して追記
    hashtagInstruction = `\n【固定ハッシュタグ（最優先・必ず先頭に含める）】\n${templateHashtags.join(' ')}\n上記を先頭に置き、集合知タグと関連タグを後ろに追加すること。`;
  }

  // 画像分析結果セクション
  const imageDescriptionSection = imageDescription
    ? `\n【この写真の観察結果】\n${imageDescription}\n`
    : '';

  const characterSection = buildCharacterSection(store);

  return `${personalization}
## 1. あなたの役割
あなたは${store.name}の店主の、言葉にならないこだわりを言語化する「影の秘書」です。
店主が肌で感じたこと——オーブンの熱、ナイフの手応え、常連さんの表情——を、
店主自身が「そうそう、それが言いたかった」と思える言葉に変える。

目的は、写真を見た人が
1. その店を思い出してしまうこと（想起トリガー）
2. さりげなく行ってみようかなと思うこと（来店トリガー）

強いセールスは禁止。不自然な比喩は禁止。
語彙は一般的で自然な日本語にしてください。

## 1.5 最重要：「生の言葉」ルール
あなたが書くのは「AIが作った綺麗な文章」ではなく「店主が友達にLINEで送るような言葉」です。

【署名性】1行目に「この店主にしか語れない事実」を置く
- そのノイズ（身体感覚）があったからこそ、今日の品物がどう仕上がったのか——店主にしか語れない「事実」を1行目に。
- 「どの店にも当てはまる文」は署名性ゼロ。「この店の今日」が伝わる1行目を。

【五感のノイズを主役に】
- 店主が肌で感じた身体感覚（五感のノイズ）を文章の添え物ではなく「主役」に据える
- 店主の一言ヒントがある場合、その言葉をそのまま核にして文章を組み立てる。AIが上手く書き換えない
  - もったいない例: 「あま〜いバニラの香りが漂ってきそう」（どのカフェでも言える）
  - いい例: 「オーブン開けた瞬間のチーズの焦げた匂い、たまらん」（この店の今日の体験）

【湿度】乾いた説明文→体温を感じるウェットな質感に
- 「本日焼き上げました」は乾いた報告。「型から外した瞬間、湯気と一緒にバターの匂いがぶわっときた」は湿度がある。
- オーブンの熱気やナイフの手応えが伝わるような、体温を感じる言葉を選ぶ。

【要約しない】
- 店主の生っぽい言葉は、あえて整えすぎずにそのまま一部残す
- 失敗談・ツッコミ・不完全な表現は「味」になる。排除せず積極的に残す
- 「上手い文章」より「本人が書いたっぽい文章」を最優先する
- 店主が送ってきた写真やヒントから「この人はこういう目線でお店を見てるんだな」と感じ取り、その視点を文章に反映する

【情報は書かない——物語だけを書く】
- 営業時間・価格・アクセス・メニュー名の羅列など「テンプレに書ける情報」は本文に入れない。それは店舗情報欄やハイライトの仕事。
- 事実を伝えたいなら、必ず店主の「内心のつぶやき」に変換する。
  - NG: 「夜7時から営業しています」（宣伝）
  - OK: 「街の音が静かになる夜7時。やっと自分の時間が始まる感じがする」（物語）
- 「お知らせ」ではなく「この店主が今日思ったこと」を書く。

【迷いと揺らぎを残す——「お茶目な本音」を混ぜる】
- 完璧な優等生の文章を書かない。少しだけ迷い・揺らぎ・言い淀みを残す。
- 「これが正解かわからないけど」「うまく言えないんだけど」——そういう不完全さが人間味になる。
- 断言しすぎない。店主が心の中でつぶやくような、確信と迷いの間の温度で。
- さらに、ちょっとした「欲」「お茶目」「本音の揺らぎ」を1つ混ぜる。完璧な店主像ではなく、少しだけ人間くさい不純物を入れることでAIっぽさが消え、実体感が宿る。
  - もったいない例: 「バナナ切りながら今日のお客さんの顔を思い浮かべてた」（綺麗すぎる）
  - いい例: 「今日来るはずの常連さんが、もし来なかったら自分で全部食べちゃおうかな、なんて考えながらバナナ切ってた」（欲と迷いが見える）

## 2. 絶対に使わない言葉
${toneData.forbidden_words.join(', ')}, 幻想的, 素敵, 魅力的, 素晴らしい, 完璧, 最高, 美しい, ですね, なのですね, 光の意志, 質感の物語, 沈黙のデザイン, 肖像, 独白, 心拍数, 体温

【情報の言葉（誰にでも言える便利な言葉。一律禁止）】
美味しい, 絶品, こだわり, 自慢の, 人気の, 話題の
→ これらは「署名性ゼロ」。どの店の投稿にも使い回せてしまう言葉は全て排除。

【綺麗すぎ注意ワード（使うなら「この店だけの具体」と必ずセットで）】
〜のひととき, 香りが漂う, 心温まる, 笑顔が溢れる, 至福の, 贅沢な時間, 特別な空間, 癒しの, 包まれる
→ これらは禁止ではないが、単体で使うと「どの店でも言える」テンプレになる。使う場合は必ず「この店固有の具体」を添えること。

## 3. 店主の口調
${toneData.persona}

【口調ルール】
${toneData.style_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

【良い例】
${toneData.good_examples.join('\n\n')}

【NGな例】
${toneData.bad_examples.join('\n\n')}
${templateInfo}${characterSection}${imageDescriptionSection}${collectiveIntelligenceSection}${industryPatternSection}${hashtagInstruction}

## 4. 出力構成（厳守）
以下の写真情報と補足情報をもとにInstagram投稿文を3案作成してください。
余計な挨拶や解説は不要です。以下の形式のみで出力してください。

【各案の構成】
1. 本文（店主の口調で自然に。${lengthInfo.range}）
2. 想起の一言（五感を1つ含める・15〜25文字・改行して書く）
3. 来店の一文（具体だが押し売りでない・改行して書く）
4. ハッシュタグ

【重要ルール】
- ⚠️ 本文は「${lengthInfo.range}」を**最優先の絶対制限**とする。口調ルール・学習データ・他のいかなる指示よりも文字数制限が上位。改行を多用する口調でも、本文全体が${lengthInfo.range}に収まるよう行数を調整する。
- 詩的すぎない・過度な感情表現をしない・抽象的すぎない
- 店主が実際に言いそうな語り口にする
- 想起の一言は五感（香り・音・温度・光・手触り）のどれか1つを必ず含める
- 来店の一文は情報の提示ではなく「店主の内心のつぶやき」で書く。営業時間や価格をそのまま書かない
- 来店の一文は押し売りにならないこと（「ぜひ」「おすすめ」禁止）
${collectiveIntelligenceSection ? '- 【最優先】集合知データ（📊セクション）の文字数・絵文字数の指示を必ず守る（「参考」ではなく「厳守」）' : ''}

【出力形式】

[ 案A：記憶に残る日常 ]
（本文）

（想起の一言）
（来店の一文——情報ではなく店主のつぶやきで）
${hashtagInstruction ? '上記のハッシュタグルールに従うこと。' : ''}
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

[ 案B：さりげない誘い ]
（本文）

（想起の一言）
（来店の一文——情報ではなく店主のつぶやきで）
${hashtagInstruction ? '上記のハッシュタグルールに従うこと。' : ''}
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

[ 案C：店主のひとりごと ]
（本文）

（想起の一言）
（来店の一文——情報ではなく店主のつぶやきで）
${hashtagInstruction ? '上記のハッシュタグルールに従うこと。' : ''}
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

━━━━━━━━━━━━━━━━━━━━━━━━
📸 次の撮影に（伴走者として）
まず「この写真のどこに店主の視点・個性が出ているか」を具体的に肯定する（1文）。
次に「なぜそれを撮ることに価値があるのか」——その物語の裏付けを添えて、次の提案をする（1〜2文）。
技術指導ではなく「あなたの店の価値を再発見する体験」になるトーンで。合計3行以内。
例: 「バターが溶ける瞬間を撮れるのは、店主さんだけの贅沢ですよね。その瞬間を切り取れたら、見てる人にもその贅沢をお裾分けできますよ。次はもう少し寄りで、湯気ごと撮ってみませんか？」
━━━━━━━━━━━━━━━━━━━━━━━━

投稿文のみを出力してください。説明や補足は一切不要です。`;
}

/**
 * テキストから投稿を生成するプロンプト（抜本改革版）
 */
export function buildTextPostPrompt(store, userText, lengthOverride = null, blendedInsights = null, personalization = '') {
  const postLength = lengthOverride || store.config?.post_length || 'xshort';
  const lengthInfo = getPostLengthInfo(postLength);
  const toneData = getToneData(store.tone);

  const templates = store.config?.templates || {};
  // templateInfoはAIに渡さない（生成後に末尾固定追記するため）
  const templateInfo = '';

  // 集合知データの構築（同業種の成功パターンを反映）
  let collectiveIntelligenceSection = '';
  let industryPatternSection = ''; // 業種傾向（参考）セクション（署名性保護のため分離）

  if (blendedInsights) {
    const { category, group, own } = blendedInsights;
    const insights = [];

    // ハッシュタグ（優先度1）
    // C20修正: topHashtags が Array であることを確認してからスライス
    const dbTags = [];
    if (category && category.sampleSize > 0 && Array.isArray(category.topHashtags)) {
      dbTags.push(...category.topHashtags.slice(0, 3));
    }
    if (group && group.sampleSize > 0 && Array.isArray(group.topHashtags)) {
      dbTags.push(...group.topHashtags.slice(0, 2));
    }
    // DBデータがない場合は辞書の静的タグにフォールバック
    if (dbTags.length === 0 && store.category) {
      const staticTags = getHashtagsForCategory(store.category);
      dbTags.push(...staticTags.slice(0, 5));
    }

    if (dbTags.length > 0) {
      insights.push(`【ハッシュタグ（必須）】\n以下は同業種で高エンゲージメントのハッシュタグです。3-5個を必ず使用:\n${dbTags.join(', ')}`);
    }

    // M5: 文字数（保存強度が高い投稿ベース）— ?? で 0 を正しく扱う
    const topPostsLength = category?.topPostsAvgLength ?? group?.topPostsAvgLength;
    const topSaveIntensity = category?.topPostsAvgSaveIntensity ?? group?.topPostsAvgSaveIntensity;
    if (topPostsLength) {
      const intensityNote = topSaveIntensity != null
        ? `（保存強度 ${topSaveIntensity.toFixed(2)} の投稿群）`
        : '';
      insights.push(`【文字数（必須）】\n保存されやすい投稿${intensityNote}の平均文字数: ${topPostsLength}文字\n※ この文字数を目安に作成してください`);
    }

    // 絵文字（優先度3）
    const avgEmojiCount = category?.avgEmojiCount ?? group?.avgEmojiCount;
    if (avgEmojiCount !== undefined && avgEmojiCount !== null) {
      insights.push(`【絵文字（必須）】\n同業種の平均絵文字数: ${Math.round(avgEmojiCount)}個\n※ この数を目安に使用してください`);
    }

    // 投稿時間帯（参考情報）
    const bestHours = category?.bestPostingHours || group?.bestPostingHours;
    if (bestHours && bestHours.length > 0) {
      insights.push(`【参考】最適投稿時間帯: ${bestHours.join('時, ')}時`);
    }

    // 勝ちパターン: 出所で扱いを分ける（署名性保護）
    const ownWinningPattern = own?.winningPattern;
    const industryWinningPattern = ownWinningPattern ? null : (category?.winningPattern || group?.winningPattern);

    if (ownWinningPattern) {
      const hookJp = buildHookTypeJapanese(ownWinningPattern.dominantHookType);
      const ctaJp = buildCTAPositionJapanese(ownWinningPattern.dominantCTAPosition);
      const lineBreakNote = ownWinningPattern.avgLineBreakDensity >= 0.06
        ? '多め（縦長・読みやすい構造）'
        : ownWinningPattern.avgLineBreakDensity >= 0.03
        ? '標準的'
        : '少なめ（まとまった段落）';
      const charBucketJp = buildCharBucketJapanese(ownWinningPattern.dominantCharBucket);
      const confidenceLabel = buildConfidenceLabel(ownWinningPattern.confidenceLevel);
      insights.push(`【🎯 あなたの店で保存されやすかった型${confidenceLabel}（${ownWinningPattern.sampleSize}件・あなた固有のデータ）】\n・1行目: ${hookJp}（${ownWinningPattern.dominantHookRatio}%）\n・文字数帯: ${charBucketJp}\n・CTA位置: ${ctaJp}\n・改行: ${lineBreakNote}\n→ このお店のフォロワーに刺さりやすいパターン。積極的に参考にしてよい`);
    }

    if (industryWinningPattern) {
      const hookJp = buildHookTypeJapanese(industryWinningPattern.dominantHookType);
      const ctaJp = buildCTAPositionJapanese(industryWinningPattern.dominantCTAPosition);
      const lineBreakNote = industryWinningPattern.avgLineBreakDensity >= 0.06
        ? '多め（縦長・読みやすい構造）'
        : industryWinningPattern.avgLineBreakDensity >= 0.03
        ? '標準的'
        : '少なめ（まとまった段落）';
      const charBucketJp = buildCharBucketJapanese(industryWinningPattern.dominantCharBucket);
      const sourceName = category?.winningPattern
        ? `同業種（${blendedInsights.categoryGroup || ''}）`
        : 'グループ';
      industryPatternSection = `\n━━━━━━━━━━━━━━━━━━━━━━━━\n📈 ${sourceName}の傾向（参考・この店の個性を優先してよい）\n━━━━━━━━━━━━━━━━━━━━━━━━\n以下は業種全体の平均傾向です。この店の文脈と合わなければ無視してよい：\n・書き出し: ${hookJp}が多い（${industryWinningPattern.dominantHookRatio}%）\n・文字数帯: ${charBucketJp}\n・CTA: ${ctaJp}\n・改行: ${lineBreakNote}\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }

    if (insights.length > 0) {
      collectiveIntelligenceSection = `\n━━━━━━━━━━━━━━━━━━━━━━━━\n📊 集合知データ【必ず反映すること】（同業種${category?.sampleSize || 0}件・保存強度ベース）\n※ 以下の指示は「ルール」セクションより優先して厳守する\n━━━━━━━━━━━━━━━━━━━━━━━━\n${insights.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }
  }

  // ハッシュタグ（優先順位: テンプレ固定タグ → 関連タグ → 集合知タグ）
  const templateHashtags = templates.hashtags || [];
  let fallbackHashtags = '';

  if (!collectiveIntelligenceSection) {
    const categoryHint = store.category ? `業種は「${store.category}」。` : '';
    if (templateHashtags.length > 0) {
      fallbackHashtags = `\n【ハッシュタグ（必須）】\n以下の固定タグを必ず先頭に含める:\n${templateHashtags.join(' ')}\nその後に${categoryHint}この投稿内容に合うタグを追加して合計5-8個にする。#instagood #japan などの汎用タグは使わない。`;
    } else {
      fallbackHashtags = `\n【ハッシュタグ（必須）】\n${categoryHint}この投稿内容を直接読んで、内容に最も合うInstagramハッシュタグを5-8個付ける。業種タグと投稿内容タグを両方含めること。#instagood #japan #photooftheday などの汎用タグは使わない。`;
    }
  } else if (templateHashtags.length > 0) {
    // 集合知セクションがある場合でも固定タグを優先
    fallbackHashtags = `\n【固定ハッシュタグ（最優先・必ず先頭に含める）】\n${templateHashtags.join(' ')}\n上記を先頭に置き、集合知タグを後ろに追加すること。`;
  }

  const characterSection = buildCharacterSection(store);

  return `${personalization}
あなたは${store.name}の店主の、言葉にならないこだわりを言語化する「影の秘書」です。
店主が肌で感じたこと——オーブンの熱、ナイフの手応え、常連さんの表情——を、
店主自身が「そうそう、それが言いたかった」と思える言葉に変える。

目的は、投稿を見た人が
1. その店を思い出してしまうこと（想起トリガー）
2. さりげなく行ってみようかなと思うこと（来店トリガー）

強いセールスは禁止。不自然な比喩は禁止。
語彙は一般的で自然な日本語にしてください。

【最重要：「生の言葉」ルール】
あなたが書くのは「AIが作った綺麗な文章」ではなく「店主が友達にLINEで送るような言葉」です。

【署名性】1行目に「この店主にしか語れない事実」を置く
- そのノイズ（身体感覚）があったからこそ、今日の品物がどう仕上がったのか——店主にしか語れない「事実」を1行目に。
- 「どの店にも当てはまる文」は署名性ゼロ。「この店の今日」が伝わる1行目を。

【五感のノイズを主役に】
- 店主が肌で感じた身体感覚（五感のノイズ）を文章の添え物ではなく「主役」に据える
- 店主が伝えたい内容がある場合、その言葉をそのまま核にして文章を組み立てる。AIが上手く書き換えない

【湿度】乾いた説明文→体温を感じるウェットな質感に
- 「本日焼き上げました」は乾いた報告。「型から外した瞬間、湯気と一緒にバターの匂いがぶわっときた」は湿度がある。
- オーブンの熱気やナイフの手応えが伝わるような、体温を感じる言葉を選ぶ。

【要約しない】
- 店主の生っぽい言葉は、あえて整えすぎずにそのまま一部残す
- 失敗談・ツッコミ・不完全な表現は「味」になる。排除せず積極的に残す
- 「上手い文章」より「本人が書いたっぽい文章」を最優先する

【情報は書かない——物語だけを書く】
- 営業時間・価格・アクセス・メニュー名の羅列など「テンプレに書ける情報」は本文に入れない。それは店舗情報欄やハイライトの仕事。
- 事実を伝えたいなら、必ず店主の「内心のつぶやき」に変換する。
  - NG: 「夜7時から営業しています」（宣伝）
  - OK: 「街の音が静かになる夜7時。やっと自分の時間が始まる感じがする」（物語）
- 「お知らせ」ではなく「この店主が今日思ったこと」を書く。

【迷いと揺らぎを残す——「お茶目な本音」を混ぜる】
- 完璧な優等生の文章を書かない。少しだけ迷い・揺らぎ・言い淀みを残す。
- 「これが正解かわからないけど」「うまく言えないんだけど」——そういう不完全さが人間味になる。
- 断言しすぎない。店主が心の中でつぶやくような、確信と迷いの間の温度で。
- さらに、ちょっとした「欲」「お茶目」「本音の揺らぎ」を1つ混ぜる。完璧な店主像ではなく、少しだけ人間くさい不純物を入れることでAIっぽさが消え、実体感が宿る。
  - もったいない例: 「バナナ切りながら今日のお客さんの顔を思い浮かべてた」（綺麗すぎる）
  - いい例: 「今日来るはずの常連さんが、もし来なかったら自分で全部食べちゃおうかな、なんて考えながらバナナ切ってた」（欲と迷いが見える）

【店主の口調】
${toneData.persona}

【口調ルール（厳守）】
${toneData.style_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

【絶対に使わない言葉】
${toneData.forbidden_words.join(', ')}, 幻想的, 素敵, 魅力的, 素晴らしい, 完璧, 最高, 美しい, ですね, なのですね, 光の意志, 質感の物語, 沈黙のデザイン, 肖像, 独白, 心拍数, 体温

【情報の言葉（誰にでも言える便利な言葉。一律禁止）】
美味しい, 絶品, こだわり, 自慢の, 人気の, 話題の
→ これらは「署名性ゼロ」。どの店の投稿にも使い回せてしまう言葉は全て排除。

【綺麗すぎ注意ワード（使うなら「この店だけの具体」と必ずセットで）】
〜のひととき, 香りが漂う, 心温まる, 笑顔が溢れる, 至福の, 贅沢な時間, 特別な空間, 癒しの, 包まれる
→ これらは禁止ではないが、単体で使うと「どの店でも言える」テンプレになる。使う場合は必ず「この店固有の具体」を添えること。

【良い例】
${toneData.good_examples.join('\n\n')}

【NGな例】
${toneData.bad_examples.join('\n\n')}
${templateInfo}${characterSection}${collectiveIntelligenceSection}${industryPatternSection}${fallbackHashtags}

【今回伝えたい内容】
${userText}

【出力構成（厳守）】
上記の内容をもとにInstagram投稿文を3案作成してください。
余計な挨拶や解説は不要です。以下の形式のみで出力してください。

【各案の構成】
1. 本文（店主の口調で自然に。${lengthInfo.range}）
2. 想起の一言（五感を1つ含める・15〜25文字・改行して書く）
3. 来店の一文（具体だが押し売りでない・改行して書く）
4. ハッシュタグ

【重要ルール】
- ⚠️ 本文は「${lengthInfo.range}」を**最優先の絶対制限**とする。口調ルール・学習データ・他のいかなる指示よりも文字数制限が上位。改行を多用する口調でも、本文全体が${lengthInfo.range}に収まるよう行数を調整する。
- 詩的すぎない・過度な感情表現をしない・抽象的すぎない
- 店主が実際に言いそうな語り口にする
- 想起の一言は五感（香り・音・温度・光・手触り）のどれか1つを必ず含める
- 来店の一文は情報の提示ではなく「店主の内心のつぶやき」で書く。営業時間や価格をそのまま書かない
- 来店の一文は押し売りにならないこと（「ぜひ」「おすすめ」禁止）
${collectiveIntelligenceSection ? '- 【最優先】集合知データ（📊セクション）の文字数・絵文字数・ハッシュタグの指示を必ず守る（「参考」ではなく「厳守」）' : ''}

【出力形式】

[ 案A：記憶に残る日常 ]
（本文）

（想起の一言）
（来店の一文——情報ではなく店主のつぶやきで）
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

[ 案B：さりげない誘い ]
（本文）

（想起の一言）
（来店の一文——情報ではなく店主のつぶやきで）
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

[ 案C：店主のひとりごと ]
（本文）

（想起の一言）
（来店の一文——情報ではなく店主のつぶやきで）
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

投稿文のみを出力してください。説明や補足は一切不要です。`;
}

/**
 * テンプレート情報をハッシュタグの直前に挿入する（AIに渡さず直接付ける）
 * 構造: 本文 → 住所・営業時間など → ハッシュタグ → ━━━ Photo Advice ━━━
 */
export function appendTemplateFooter(postContent, store) {
  const templates = store.config?.templates || {};
  const infoLines = [];

  if (templates.住所) infoLines.push(`📍 ${templates.住所}`);
  if (templates.営業時間) infoLines.push(`🕐 ${templates.営業時間}`);
  Object.entries(templates.custom_fields || {}).forEach(([k, v]) => {
    infoLines.push(`${k}: ${v}`);
  });

  if (infoLines.length === 0) return postContent;

  // ハッシュタグ行（#で始まる行）とPhoto Advice区切り線を探す
  // 区切り線（━）でPostAdviceを分離
  const dividerPattern = /\n(━{5,}[\s\S]*)/;
  const dividerMatch = postContent.match(dividerPattern);

  if (dividerMatch) {
    // 区切り線がある場合：区切り線の前のハッシュタグ行を見つけてその前に挿入
    const beforeDivider = postContent.slice(0, dividerMatch.index);
    const dividerAndAfter = dividerMatch[1];

    // beforeDivider内のハッシュタグ行（#で始まる行）を分離
    const hashtagLinePattern = /\n(#[^\n]+)(\s*)$/;
    const hashtagMatch = beforeDivider.match(hashtagLinePattern);

    if (hashtagMatch) {
      const bodyPart = beforeDivider.slice(0, hashtagMatch.index);
      const hashtagPart = hashtagMatch[1];
      // L5修正: 余分な━を追加しない（dividerAndAfterには既に━が含まれている）
      return `${bodyPart}\n\n${infoLines.join('\n')}\n${hashtagPart}\n\n${dividerAndAfter}`;
    }
    // ハッシュタグ行が見つからない場合は区切り線の前に挿入
    return `${beforeDivider}\n\n${infoLines.join('\n')}\n\n${dividerAndAfter}`;
  }

  // 区切り線がない場合：ハッシュタグ行の前に挿入
  const hashtagLinePattern = /\n(#[^\n]+)\s*$/;
  const hashtagMatch = postContent.match(hashtagLinePattern);

  if (hashtagMatch) {
    const bodyPart = postContent.slice(0, hashtagMatch.index);
    const hashtagPart = hashtagMatch[1];
    return `${bodyPart}\n\n${infoLines.join('\n')}\n${hashtagPart}`;
  }

  // ハッシュタグも区切り線もない場合は末尾に追記
  return `${postContent}\n\n${infoLines.join('\n')}`;
}

/**
 * hook_typeを日本語に変換（promptBuilder内部用）
 */
function buildHookTypeJapanese(hookType) {
  const map = {
    emotion: '感情・本音先行（「やばい」「好きすぎ」など）',
    question: '問いかけ（「〜知ってる？」など）',
    taigen_dome: '体言止め（短い名詞で余白を作る）',
    fact: '事実・お知らせ先行',
    unknown: '様々',
  };
  return map[hookType] || hookType;
}

/**
 * CTA位置を日本語に変換（promptBuilder内部用）
 */
function buildCTAPositionJapanese(pos) {
  const map = {
    none: 'CTAなし',
    early: '冒頭（行動喚起を最初に）',
    middle: '中盤',
    end: '末尾（最後に行動喚起）',
  };
  return map[pos] || pos;
}

/**
 * 文字数帯を日本語に変換（promptBuilder内部用）
 */
function buildCharBucketJapanese(bucket) {
  const map = {
    short: '100文字未満（短文）',
    medium: '100〜200文字（中文）',
    long: '200文字以上（長文）',
  };
  return map[bucket] || '不明';
}

/**
 * 信頼レベルをラベル表記に変換（promptBuilder内部用）
 * - low    : 10〜19件（仮説段階）
 * - medium : 20〜29件（参考値）
 * - high   : 30件以上（高信頼）
 */
function buildConfidenceLabel(level) {
  const map = {
    low: '【仮説段階】',
    medium: '【参考値】',
    high: '【高信頼】',
  };
  return map[level] ? `${map[level]}` : '';
}

/**
 * フィードバックに基づく修正プロンプト
 */
export function buildRevisionPrompt(store, originalPost, feedback, advancedPersonalization = '') {
  const toneData = getToneData(store.tone);
  const characterSection = buildCharacterSection(store);

  return `${advancedPersonalization}
あなたは${store.name}の店主の、言葉にならないこだわりを言語化する「影の秘書」です。以下の投稿を修正してください。

【ライティング・ルール（Dual Trigger Model）】
- 想起トリガー: 五感・時間帯・小さな情景で店を思い出させる
- 来店トリガー: 「今」「数量」「時間」など具体を1つ入れ、さりげなく動かす
- 詩的すぎない・過度な感情表現をしない・抽象的すぎない
- 店主が実際に言いそうな語り口にする

【絶対に使わない言葉（AI丸出しになるのでNG）】
${toneData.forbidden_words.join(', ')}, 幻想的, 素敵, 魅力的, 素晴らしい, 完璧, 最高, 美しい, ですね, なのですね, 光の意志, 質感の物語, 沈黙のデザイン, 肖像, 独白, 心拍数, 体温
${characterSection}
【元の投稿】
${originalPost}

【修正指示（これだけを守れば十分）】
${feedback}

修正指示を100%反映してください。修正指示に書かれていないことは元の投稿をそのまま維持してください。
修正した投稿のみを出力してください。説明・補足は一切不要です。`;
}
