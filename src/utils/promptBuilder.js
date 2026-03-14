const TONE_MAP = {
  // 日本語キー（優先）
  'カジュアル': {
    name: 'カジュアル（タメ口）',
    persona: 'あなたは実際にお店を運営している本人です。Instagramに自分の言葉でタメ口で投稿してください。AIが生成した感じを一切出さず、本当にその場にいる人間が書いたような文章にしてください。',
    style_rules: [
      '完全なタメ口。「〜だった」「〜した」「〜かも」「〜じゃん」「〜だね」「〜だな」が語尾',
      '「です・ます・ます体」は1文字も使わない。「〜んです」「〜だと思います」「〜なります」も全部NG',
      '1文は短く（10〜20文字）。改行を多用して縦に展開する',
      '感情・驚き・本音を最初に置く。「好きすぎる」「うれしい」「これは良い」から始めてOK',
      '絵文字は文末に1〜2個だけ。絵文字で始めない',
      '「なんか〜」「ちょっと〜」などの口語表現を自然に使う',
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
      'これほんと良かった\n思ってたより全然いい\nまた絶対頼む',
      'なんかこれすごい好き\n言葉にできないけど\nずっと見てられるやつ',
      'これすごい\n久しぶりにこれだけ感動した\nみんなにも見せたい',
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
      '感情・驚き・本音を最初に置く。「好きすぎる」「うれしい」「これは良い」から始めてOK',
      '絵文字は文末に1〜2個だけ。絵文字で始めない',
      '「なんか〜」「ちょっと〜」などの口語表現を自然に使う',
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
      'これほんと良かった\n思ってたより全然いい\nまた絶対頼む',
      'なんかこれすごい好き\n言葉にできないけど\nずっと見てられるやつ',
      'これすごい\n久しぶりにこれだけ感動した\nみんなにも見せたい',
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
  '超短文': { range: '2行以内（ハッシュタグ別・絶対厳守）', description: '超短文（2行以内）' },
  '短文': { range: '100-150文字', description: '短文' },
  '中文': { range: '200-300文字', description: '中文' },
  '長文': { range: '400-500文字', description: '長文' },

  // 後方互換性のため英語キーも残す
  xshort: { range: '2行以内（ハッシュタグ別・絶対厳守）', description: '超短文（2行以内）' },
  short: { range: '100-150文字', description: '短文' },
  medium: { range: '200-300文字', description: '中文' },
  long: { range: '400-500文字', description: '長文' },
};

// L5: import文は本来先頭に置くべきだが、ESMがhoistするため実害はない
// 次回リファクタ時にファイル先頭に移動すること
import { getHashtagsForCategory, getCategoryGroup, findCategoryByLabel } from '../config/categoryDictionary.js';
import { getTemplatesForGroup } from '../config/nudgeTemplates.js';

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
 * 業種別の撮影候補を3件ランダムに返す（季節フィルタ付き）
 * Photo Adviceの「💡次はこんなのも撮ってみない？」セクションで使用
 * @param {string} category - 店舗カテゴリ名
 * @returns {string} 候補テキスト（空文字=候補なし）
 */
function buildNextSubjectHints(category) {
  if (!category) return '';
  const catInfo = findCategoryByLabel(category);
  if (!catInfo) return '';

  const templates = getTemplatesForGroup(catInfo.groupId);
  if (!templates || templates.length === 0) return '';

  // 季節フィルタ
  const month = new Date().getMonth() + 1;
  const season = (month <= 2 || month === 12) ? '冬'
    : month <= 5 ? '春'
    : month <= 8 ? '夏' : '秋';
  const filtered = templates.filter(t => !t.season || t.season === season);

  // ランダムに3件選択（毎回違う候補を返す）
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, 3);

  return picked.map(t => `・${t.subject}（${t.description}）`).join('\n');
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

// ボタン選択テキストの一覧
const POST_TYPE_BUTTONS = ['お知らせ', 'お役立ち情報'];

/**
 * 業種別の追加プロンプトルールを返す
 * @param {string|null} category - 店舗カテゴリ
 * @returns {string} 業種別ルール文字列（なければ空文字）
 */
function buildCategoryRules(category) {
  if (!category) return '';
  const group = getCategoryGroup(category);

  if (group === '美容系') {
    return `
【業種ルール: 美容系（厳守）】
- 施術内容を具体的に書く（カラー名・技法・薬剤など。「施術しました」だけはNG）
- 仕上がりの質感・色味・手触りを描写する（「サラサラ」ではなく「光に当たるとほんのり紫が出る柔らかい色味」のように具体的に）
- 施術の結果や仕上がりを具体的に伝える（新カラー・ビフォーアフター・トリートメント結果など）
- 不自然な口語は禁止（「まじ実感しますよ」「やばいことになってる」→ 施術者として信頼感のある言葉で）
- ハッシュタグは施術内容に直結するもの（#アッシュカラー #透明感カラー #ブリーチカラー など）。#美容室 #ヘアカラー だけの汎用タグはNG
`;
  }

  return '';
}

/**
 * カテゴリグループに応じた良い投稿例を返す
 * tone の good_examples（文体の手本）に加えて、業種としてのコンテンツの手本を提供する
 */
function buildCategoryExamples(category) {
  if (!category) return '';
  const group = getCategoryGroup(category);

  const examples = {
    '美容系': `
【この業種の良い投稿例】
例1:
ブリーチ2回からのアッシュパープル
光に透けるとほんのり紫が出る、この感じ狙ってた
カラー剤混ぜてる時点でいい予感してたんだよな

色落ちしても綺麗なグレーになるように計算してます
春のイメチェン、まだ間に合います
#アッシュパープル #透明感カラー #ブリーチカラー #ダブルカラー #春カラー

例2:
縮毛矯正かけた直後のこのツヤ
触るとするする指が通って、思わず何回も触っちゃう
梅雨前にかけておくと朝のセットが本当に楽になる

ドライヤーの風を当てた瞬間のサラッと感
6月の予約、埋まってきてます
#縮毛矯正 #髪質改善 #ツヤ髪 #梅雨対策 #ストレートヘア`,

    '飲食系': `
【この業種の良い投稿例】
例1:
型から外した瞬間、バターの匂いがぶわっときた
今日のは自分でも「あ、これだ」ってなった
まだ粗熱とれてないけど我慢できなくて写真撮った

オーブン開けた時の焦げたチーズの匂い
週末分、あと6個だけ焼けます
#チーズケーキ #焼き菓子 #手作りおやつ #カフェスイーツ #焼きたて

例2:
仕込み中に味見したら止まらなくなった
昨日より煮込み時間を30分伸ばしたら肉がほろほろになった
これ出す時のお客さんの顔が楽しみで仕方ない

グツグツ煮込んでる鍋の湯気と香り
今日のランチ、11時半からです
#煮込み料理 #ランチ #手作りごはん #日替わり #地元カフェ`,

    '小売系': `
【この業種の良い投稿例】
例1:
入荷した瞬間に自分用に確保したくなった
この色味、写真だと伝わりきらないのがもどかしい
実物は光の当たり方で表情が変わるタイプ

手に取った時のずっしりした重み
残り3点、次の入荷は未定です
#新入荷 #雑貨屋 #インテリア雑貨 #一点もの #暮らしの道具

例2:
梱包開けた時の木の香りがすごくよかった
棚に並べてみたら思った以上にしっくりきた
こういうのは実際に手に取ってほしい

天然木のざらっとした手触り
週末、店頭に出してます
#木工雑貨 #ハンドメイド #天然素材 #暮らしを整える #雑貨好き`,

    'サービス系': `
【この業種の良い投稿例】
例1:
施術始めて5分で寝落ちされた
力加減がぴったりだったんだと思うと嬉しい
終わった後の「え、もう終わり？」って顔が毎回たまらない

温めたタオルを首に当てた瞬間のふわっとした湯気
平日午前、比較的ゆったりご案内できます
#リラクゼーション #整体 #肩こり解消 #癒しの時間 #プライベートサロン

例2:
今日のレッスン、全員が同じところで詰まった
教え方変えたら一気にできるようになって
この瞬間のためにこの仕事やってるなと思った

チョークの粉が手についたままの達成感
来月の体験レッスン、あと2枠です
#習い事 #教室 #体験レッスン #スキルアップ #少人数制`,
  };

  return examples[group] || '';
}

/**
 * ボタン選択に応じた出力形式テンプレートを返す
 * @param {string|null} hint - ユーザーの一言 or ボタンテキスト
 * @param {string} hashtagInstruction - ハッシュタグ指示
 */
function buildOutputFormat(hint, hashtagInstruction, postLength = null) {
  const tagNote = hashtagInstruction ? '上記のハッシュタグルールに従うこと。' : '';
  const tagLine = `${tagNote}\n#タグ1 #タグ2 #タグ3 #タグ4 #タグ5`;
  const labelWarning = '⚠️ [ 案A：... ] のラベルは以下の通り一字一句そのまま出力すること。独自のラベル（「光の肖像」「誠実の肖像」等）は絶対に使わない。';

  // ── 超短文（2行以内）モード ──
  if (postLength === 'xshort' || postLength === '超短文') {
    return `【出力形式】
${labelWarning}
⚠️ 3案は必ず「視覚 / ストーリー / 店主」の3パターンにする。

[ 案A：視覚で伝える ]
（本文2行以内）
${tagLine}

[ 案B：ストーリーを添える ]
※店主が自分勝手に楽しんでいる姿を描くこと。
（本文2行以内）
${tagLine}

[ 案C：店主のひとりごと ]
（本文2行以内）
${tagLine}`;
  }

  // ── お知らせモード ──
  if (hint === 'お知らせ') {
    return `【出力形式】
${labelWarning}

[ 案A：やっとお見せできる新着 ]
※「待ってました」感のある発表トーン。ずっと準備してきたものをお披露目する高揚感。
 - 写真に写っているものを「新しく始めたこと」「初めてお見せするもの」として扱う
 - 「実はずっと準備してて」「やっとお見せできる」のような店主のワクワク感を核に
（本文）
${tagLine}

[ 案B：今だけ・限定の匂わせ ]
※直接「限定です」「急いで」と煽らない。店主自身が「これ今だけだな」と惜しむ口調で。
 - NG: 「数量限定です！お早めに」（セールス）
 - OK: 「これ、材料がもうあんまり残ってないんだよな…」（店主の本音）
 - 「今だけ」「この時期だけ」「なくなったら終わり」を店主の独り言として匂わせる
（本文）
${tagLine}

[ 案C：店主のさらっと報告 ]
※大げさに発表しない。「ちなみに」「そういえば」ぐらいのテンションで。
 - 友達にLINEで「あ、そうそう」と伝えるような温度感
 - お知らせの内容を日常会話の延長として自然に混ぜる
（本文）
${tagLine}`;
  }

  // ── お役立ちモード ──
  if (hint === 'お役立ち情報') {
    return `【出力形式】
${labelWarning}

[ 案A：プロだから知ってる豆知識 ]
※店主が仕事の中で自然に身につけた知識を、友達に話すように。教科書的な解説は禁止。
 - 「これ意外と知られてないんだけど」「仕事してて気づいたんだけど」のトーンで
 - 写真に写っているものから、一般の人が知らない裏話や豆知識を引き出す
（本文）
${tagLine}

[ 案B：こだわりの裏側 ]
※プロとしてのこだわりを見せるが、自慢にならないこと。「つい気になっちゃう」という性分として描く。
 - NG: 「当店は素材にこだわっています」（宣伝）
 - OK: 「どうしてもここの仕上がりが気になって、結局3回やり直した」（性分）
 - 写真のディテールから、店主が普段こだわっている部分を掘り出す
（本文）
${tagLine}

[ 案C：意外な楽しみ方 ]
※お客さん目線で「こうすると実はもっと楽しめる」を、店主が教えてあげる口調で。
 - 「これ、実はこう使うともっといいんだよね」「常連さんに教えてもらったんだけど」
 - 押しつけがましくなく、「知ってたら得する」ぐらいの温度で
（本文）
${tagLine}`;
  }

  // ── 日常感モード（デフォルト: スキップ・自由テキスト・日常感ボタン） ──
  return `【出力形式】
${labelWarning}
⚠️ 3案は必ず「視覚 / ストーリー / 店主」の3パターンにする。内容が似通わないこと。

[ 案A：視覚で伝える ]
※写真に見えるもの（色・形・質感・配置・光）を言葉で描写する。視覚情報で勝負する案。
 - 「何が」「どう見えるか」を具体的に書く
 - 感情や物語は入れない。見た目だけで惹きつける
（本文）
${tagLine}

[ 案B：ストーリーを添える ]
※写真の裏側にある時間・選択・気持ちの流れを描く。店主が自分勝手に楽しんでいる姿を覗き見させる。
 - NG: 「こういう瞬間を一緒に味わえたらいいのにな」（読み手に期待を向けている）
 - OK: 「バターが溶けるのを眺めていたら、つい自分もコーヒーを淹れたくなっちゃった」（店主が勝手に楽しんでいる）
（本文）
${tagLine}

[ 案C：店主のひとりごと ]
（本文）
${tagLine}`;
}

/**
 * 画像から投稿を生成するプロンプト
 */
export function buildImagePostPrompt(store, lengthOverride = null, blendedInsights = null, personalization = '', imageDescription = null, options = {}) {
  const postLength = lengthOverride || store.config?.post_length || 'xshort';
  const lengthInfo = getPostLengthInfo(postLength);
  const toneData = getToneData(store.tone);

  const templates = store.config?.templates || {};
  // templateInfoはAIに渡さない（生成後に末尾固定追記するため）
  const templateInfo = '';

  // 集合知ハッシュタグの取得（文字数・勝ちパターン等は戦略アドバイスに転用済み）
  let collectiveIntelligenceSection = '';
  let industryPatternSection = '';
  let dbTags = [];

  if (blendedInsights) {
    const { category, group } = blendedInsights;
    if (category && category.sampleSize > 0 && Array.isArray(category.topHashtags)) {
      dbTags.push(...category.topHashtags.slice(0, 3));
    }
    if (group && group.sampleSize > 0 && Array.isArray(group.topHashtags)) {
      dbTags.push(...group.topHashtags.slice(0, 2));
    }
    if (dbTags.length === 0 && store.category) {
      const staticTags = getHashtagsForCategory(store.category);
      dbTags.push(...staticTags.slice(0, 5));
    }
  }

  // ハッシュタグ指示（優先順位: テンプレ固定タグ → 関連タグ → 集合知タグ）
  const categoryHint = (store.category && store.category !== '開発者テスト') ? `業種「${store.category}」` : '';
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

  // Detection（内部処理）セクション
  const detections = options.detections || [];
  let detectionSection = '';
  if (detections.length > 0) {
    const detectionList = detections.map(d => `- ${d}`).join('\n');
    detectionSection = `\n【Detection（内部処理 — 本文の1行目に自然に溶かすこと）】\n${detectionList}\n\n※ Detectionを説明するな。店主の行動の中に溶かせ。1行目がDetectionの言い換えになったらNG。\n`;
  }

  // ヒント（ユーザーの一言 or ボタン選択）セクション
  const hint = options.hint || null;
  const isInfluencer = store.category === 'インフルエンサー';
  const isButtonHint = hint && (POST_TYPE_BUTTONS.includes(hint) || hint === '日常感');
  let hintSection = '';
  if (hint && !isButtonHint) {
    // ボタン選択ではなく自由テキストの場合のみヒントセクションを追加
    const hintLabel = isInfluencer
      ? '【補足情報（投稿に自然に反映してよい）】'
      : '【店主からの一言（この言葉を投稿の核にすること）】';
    hintSection = `\n${hintLabel}\n${hint}\n`;
  }

  const characterSection = buildCharacterSection(store);

  // ── インフルエンサー専用プロンプト ──────────────────────────
  if (isInfluencer) {
    return buildInfluencerImagePrompt({
      personalization, characterSection, imageDescriptionSection,
      hintSection, collectiveIntelligenceSection, industryPatternSection,
      hashtagInstruction, lengthInfo, options, category: store.category,
    });
  }

  // 戦略アドバイス（Photo Advice セクション用）
  const strategicAdvice = buildStrategicAdvice(blendedInsights, store);
  const photoStyleHint = strategicAdvice?.photoStyleTip ? `\nデータ参考: ${strategicAdvice.photoStyleTip}` : '';

  // ── 店舗用プロンプト（従来通り）──────────────────────────
  const roleSection = `## 1. あなたの役割（最重要）
あなたは「写真観察AI」です。
あなたの役割は 写真を観察し その中にある視点・瞬間・空気感を見つけ SNS投稿のネタに変換することです。
あなたは文章生成AIではありません。
写真の中にある ・光 ・配置 ・素材 ・瞬間 ・店の空気 を観察し
店主が気づいていない魅力を SNS投稿として言語化します。
写真に写っていない情報を補わない。「それっぽい文脈」を足さない。
特に注意: 人数・人の行動・持ち物は写真に写っている範囲のみ記述する。
「カフェだから二人」「ランチだから賑わい」のような推測は禁止。1人なら1人、誰もいないなら誰もいない。`;

  const globalRulesSection = options.globalRules || '';

  return `${personalization}${globalRulesSection}
${roleSection}

## 1.5 写真観察→ネタ変換の型（最重要）
【観察（50%）— 写真から何を見つけるか】
- 光・色・配置・素材・瞬間・空気感を具体的に観察する
- 「この店の今日」にしかない要素を見つける
- Detectionがあれば、その視点を1行目に溶かし込む
- ★最重要: 要素をバラバラに列挙しない。「一番強い掛け合わせ」を1つ見つけること
  例: 赤いブラインド × 逆光 × スマホを見る女性 → 「静かな時間」
  この掛け合わせが3案すべての核になる。個別要素を並べるだけの投稿は弱い

【ネタ変換（30%）— 観察をSNS投稿にするには】
- ★文章構造の鉄則: 「視点 → 行動 → 情景（共感）」の3ステップで書く
  - 視点だけで終わらない。必ず「行動」を1行入れる
  - 最後は情景や共感で締める（体験・気付き・共感のどれか）
- ① 視点（1行）— 写真から気づいたポイント（観察結果の核）
- ② 行動（1行）— 食べる・手に取る・見る・巻く・並べるなどの具体的な動き
- ③ 情景・共感（1行）— 「気付いたら〜してしまう」「つい〜してしまう」「なんだか〜になる」
- NG: 視点の説明→感想で終わる（写真説明AIに見える）
- OK: 視点→行動→情景（店主の体験投稿に見える）
- 例:
  NG「黒い皿の溝がソースを受け止めています。二人でシェアしてしまいます。」
  OK「黒い皿の溝がトマトソースを受け止めてくれる。フォークで巻くたびにソースがしっかり絡む。気付いたら二人でシェアしてしまうパスタ。」
- 店主のヒントがある場合、その言葉をそのまま核にする。AIが上手く書き換えない

【文体（20%）— 最低限のルール】
- 説明文を書かない。独り言にする
- 1文は短く。少しラフでOK
- 写真の内容を説明しない。店主の行動と気づきだけ書く
- 「上手い文章」より「本人が書いたっぽい独り言」を最優先する
- 失敗談・ツッコミ・不完全な表現は「味」になる。排除せず残す
- ★最後の文は「体験」「気付き」「共感」のどれかで締める。説明で終わらない
  OK: 「気づいたら〜してしまう」「つい〜してしまう」「なんだか〜になる」
  NG: 事実の説明や感想だけで終わる

## 2. 禁止ワード
${toneData.forbidden_words.join(', ')}, 幻想的, 素敵, 魅力的, 素晴らしい, 完璧, 最高, 美しい, まじ, まじで, やばい, やばすぎ, 超, めっちゃ, 美味しい, 絶品, こだわり, 自慢の, 人気の, 話題の, 光の意志, 質感の物語, 沈黙のデザイン, 肖像, 独白
→ これらは「どの店でも使い回せる言葉」か「AIっぽい言葉」。代わりに「この店の今日」を具体的に書く。

## 3. 店主の口調
${toneData.persona}

【口調ルール】
${toneData.style_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}
${buildCategoryExamples(store.category)}
【NGな例】
${toneData.bad_examples.join('\n\n')}
${templateInfo}${characterSection}${imageDescriptionSection}${detectionSection}${hintSection}${collectiveIntelligenceSection}${industryPatternSection}${hashtagInstruction}

## 4. 出力構成（厳守）
以下の写真情報と補足情報をもとにInstagram投稿文を3案作成してください。
余計な挨拶や解説は不要です。以下の形式のみで出力してください。
${isButtonHint
  ? `\n【投稿タイプ: ${hint}】\n下記の出力形式に従い、このタイプに合った3案を作成してください。写真から読み取れる要素を各案で異なる切り口で使うこと。`
  : hint
    ? `\n【投稿の方向性（最重要）】\n店主の一言「${hint}」がこの投稿の目的です。本文の内容・視点・語りの方向すべてをこの一言から組み立ててください。\n- 本文の1行目から一言の意図が伝わること\n- 写真の要素のうち、この一言に関連するものだけを選んで使う\n- 3案はそれぞれ異なる切り口で書くこと`
    : '\n【投稿の方向性】\n写真から読み取れる要素を3つ選び、各案ごとに異なる要素を核にして書いてください。3案が似た内容にならないこと。'}

${postLength === 'xshort' || postLength === '超短文' ? `【各案の構成（2行モード）】
1. 本文2行以内
2. ハッシュタグ
${buildCategoryRules(store.category)}
【重要ルール】
- ⚠️ 本文は**2行以内**を最優先の絶対制限とする。3行以上は絶対禁止
- 文章を書くな。作業中の独り言を書け。写真の内容を説明しない
- 店主が実際に言いそうな独り言にする（視点は常に店主側。客のフリをしない）
- 短いからこそ1文に余計な修飾を入れない。体言止め・省略・ぶっきらぼうOK
- ⚠️ 「来店の一文」「営業時間」「開店情報」は絶対に書かない。「今日は〜まで開いています」「週末、店にいます」のような誘い文句は禁止
${collectiveIntelligenceSection ? '- 集合知データ（📊セクション）のハッシュタグは目安として参考にする' : ''}` : `【各案の構成】
1. 本文（店主の口調で自然に。${lengthInfo.range}）
2. ハッシュタグ
${buildCategoryRules(store.category)}
【重要ルール】
- ⚠️ 本文は「${lengthInfo.range}」を**最優先の絶対制限**とする。口調ルール・学習データ・他のいかなる指示よりも文字数制限が上位。改行を多用する口調でも、本文全体が${lengthInfo.range}に収まるよう行数を調整する。
- 文章を書くな。作業中の独り言を書け。写真の内容を説明しない
- 店主が実際に言いそうな独り言にする（視点は常に店主側。客のフリをしない）
- ⚠️ 「来店の一文」「営業時間」「開店情報」は絶対に書かない。「今日は〜まで開いています」「週末、店にいます」「明日も〜から開店です」のような誘い文句は禁止
- ⚠️ 「想起の一言」を独立した行で書かない。五感要素は本文の中に自然に含めること
`}

${personalization ? `\n⚠️ 最終チェック: 上部の【ライティング傾向】【文体ルール】を必ず反映してから出力すること。特に語尾・口癖・避ける表現は厳守。\n` : ''}
${buildOutputFormat(hint, hashtagInstruction, postLength)}

━━━━━━━━━━━━━━━━━━━━━━━━
📸 この写真の別の撮り方
同じ被写体を、別のアングル・光・構図・タイミングで撮る方法を1つ提案する。
「なぜその撮り方だと反応が変わるか」を1文で添える。合計2行以内・短く。${photoStyleHint}
例:
📸 この写真の別の撮り方
同じケーキを窓際の自然光で、もう少し引きで撮ると空気感が出ます。
「お店の雰囲気ごと伝わる写真」は保存されやすいです。
${options.isPremium ? (() => {
  const tomorrowHints = buildNextSubjectHints(store.category);
  return `
🎯 明日撮るべきもの
今日の写真の延長線上で、別の切り口を1つ提案する。
最優先: 同じ被写体の「別の瞬間・別のアングル・別の組み合わせ」（例: カップ→コーヒーを注いだ瞬間、ケーキ→カット断面）
次点: 今日の被写体と自然につながる別のもの（例: カップ→カップに合うお菓子、パン→仕込み中の生地）
${tomorrowHints ? `参考候補（写真と関連があるものだけ使ってよい）:
${tomorrowHints}` : ''}
ルール:
- 「何を」「いつ」「どう撮るか」「なぜ」を1セットで具体的に書く
  OK: 「明日の午後、同じ窓際席でコーヒーをテーブルに置く手元を逆光で撮って。ブラインドの光と湯気が重なると店の雰囲気が伝わりやすい」
  NG: 「コーヒーカップを置く瞬間」（いつ・どう・なぜが抜けている）
- 合計2行以内。${photoStyleHint}
- 抽象的な提案は禁止（「店内の様子」「商品」等NG）。具体物・時間帯・状態を必ず含める`;
})() : ''}
━━━━━━━━━━━━━━━━━━━━━━━━

投稿文のみを出力してください。説明や補足は一切不要です。`;
}

/**
 * インフルエンサー専用：画像投稿プロンプト
 */
function buildInfluencerImagePrompt({
  personalization, characterSection, imageDescriptionSection,
  hintSection = '', collectiveIntelligenceSection, industryPatternSection,
  hashtagInstruction, lengthInfo, options, category = null,
}) {
  return `${personalization}
あなたはSNSインフルエンサーの投稿を代筆します。
投稿は人がスマホでそのまま書いたような
自然なSNS文章にしてください。
整った文章や説明は不要です。
独り言のような話し方を使います。

文章ルール
・短文で書く
・1〜2文ごとに改行
・会話口調
・説明しすぎない
・完璧にまとめない
・少し雑でも自然

投稿構造（2行で完結）
1行目：独り言（写真から感じたこと・今の状況）
2行目：リスナーへの問いかけ（共感や反応を引く質問）

例
なんかこの光よくない？
みんな写真撮るとき光気にする派？

例
これ関係ないけど最近ずっと食べてる
こういう沼にハマった経験ない？

禁止
・広告っぽい文章
・「素敵」「魅力的」「おすすめ」などの宣伝語
・長い説明
・ポエム調
・3行以上の本文

写真から読み取った情報をもとに
独り言＋問いかけの2行で完結させてください。
${characterSection}${imageDescriptionSection}${hintSection}${collectiveIntelligenceSection}${industryPatternSection}${hashtagInstruction}

## 出力構成（厳守）
写真情報をもとにInstagram投稿文を3案作成。
余計な挨拶や解説は不要。以下の形式のみ。
${options.hint ? `\n【投稿の方向性（最重要）】\n一言「${options.hint}」がこの投稿の目的。本文の内容・視点・語りの方向すべてをこの一言から組み立てる。\n- 本文の1行目からこの意図が伝わること（導線だけに反映するのはNG）\n- 写真の要素のうち、この一言に関連するものだけを使う\n- 3案は異なる切り口で。` : '\n【投稿の方向性】\n写真から読み取れる要素を3つ選び、各案ごとに異なる要素を核にして書く。3案が似た内容にならないこと。'}

【各案の構成】
1. 本文（${lengthInfo.range}・短く自然に）
2. ひとこと（印象に残る短いフレーズ・15〜25文字）
3. さりげない導線（「フォローして」と直接言わない・1文）
4. ハッシュタグ

【ルール】
- 本文は「${lengthInfo.range}」を絶対制限とする
- ポエムや綺麗な表現は禁止。雑談レベルの言葉で

【出力形式】

[ 案A：視点の切り取り ]
（本文）
（ひとこと）
（さりげない導線）
${hashtagInstruction ? '上記のハッシュタグルールに従うこと。' : ''}
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

[ 案B：日常の一コマ ]
（本文）
（ひとこと）
（さりげない導線）
${hashtagInstruction ? '上記のハッシュタグルールに従うこと。' : ''}
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

[ 案C：本音のひとりごと ]
（本文）
（ひとこと）
（さりげない導線）
${hashtagInstruction ? '上記のハッシュタグルールに従うこと。' : ''}
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

━━━━━━━━━━━━━━━━━━━━━━━━
📸 この写真の別の撮り方
同じ被写体を、別のアングル・光・構図・タイミングで撮る方法を1つ。合計2行以内。
${(() => {
  const subjectHints = buildNextSubjectHints(category);
  return subjectHints ? `
💡 次はこんなのも撮ってみない？
今日の写真とは違う被写体を、以下から1つ選んで提案する（1文）。
候補:
${subjectHints}
なぜ反応が取れそうかを添えて。今日の写真と同じものは選ばない。` : '';
})()}${options.isPremium ? (() => {
  const tomorrowHints = buildNextSubjectHints(category);
  return `
🎯 明日撮るべきもの
今日の写真の延長線上で、別の切り口を1つ提案する。
最優先: 同じ被写体の「別の瞬間・別のアングル・別の組み合わせ」
次点: 今日の被写体と自然につながる別のもの
${tomorrowHints ? `参考候補（写真と関連があるものだけ使ってよい）:
${tomorrowHints}` : ''}
ルール:
- 「何を」「いつ」「どう撮るか」「なぜ」を1セットで具体的に書く
- 合計2行以内
- 抽象的な提案は禁止。具体物・時間帯・状態を必ず含める`;
})() : ''}
━━━━━━━━━━━━━━━━━━━━━━━━

投稿文のみを出力。説明や補足は不要。`;
}

/**
 * インフルエンサー専用：テキスト投稿プロンプト
 */
function buildInfluencerTextPrompt({
  personalization, characterSection, userText,
  collectiveIntelligenceSection, industryPatternSection,
  fallbackHashtags, lengthInfo,
}) {
  return `${personalization}
あなたはSNSインフルエンサーの投稿を代筆します。
投稿は人がスマホでそのまま書いたような
自然なSNS文章にしてください。
整った文章や説明は不要です。
独り言のような話し方を使います。

文章ルール
・短文で書く
・1〜2文ごとに改行
・会話口調
・説明しすぎない
・完璧にまとめない
・少し雑でも自然

投稿構造（2行で完結）
1行目：独り言（伝えたい内容から感じたこと）
2行目：リスナーへの問いかけ（共感や反応を引く質問）

例
なんかこの光よくない？
みんな写真撮るとき光気にする派？

例
これ関係ないけど最近ずっと食べてる
こういう沼にハマった経験ない？

禁止
・広告っぽい文章
・「素敵」「魅力的」「おすすめ」などの宣伝語
・長い説明
・ポエム調
・3行以上の本文

独り言＋問いかけの2行で完結させてください。
${characterSection}${collectiveIntelligenceSection}${industryPatternSection}${fallbackHashtags}

【今回伝えたい内容】
${userText}

【出力構成（厳守）】
上記の内容をもとにInstagram投稿文を3案作成。
余計な挨拶や解説は不要。以下の形式のみ。

【各案の構成】
1. 本文（${lengthInfo.range}・短く自然に）
2. ひとこと（印象に残る短いフレーズ・15〜25文字）
3. さりげない導線（「フォローして」と直接言わない・1文）
4. ハッシュタグ

【ルール】
- 本文は「${lengthInfo.range}」を絶対制限とする
- ポエムや綺麗な表現は禁止。雑談レベルの言葉で

【出力形式】

[ 案A：視点の切り取り ]
（本文）
（ひとこと）
（さりげない導線）
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

[ 案B：日常の一コマ ]
（本文）
（ひとこと）
（さりげない導線）
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

[ 案C：本音のひとりごと ]
（本文）
（ひとこと）
（さりげない導線）
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

投稿文のみを出力。説明や補足は不要。`;
}

/**
 * テキストから投稿を生成するプロンプト（抜本改革版）
 */
export function buildTextPostPrompt(store, userText, lengthOverride = null, blendedInsights = null, personalization = '', options = {}) {
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

    // 集合知データは戦略アドバイス（Daily Nudge / Photo Advice / Tips）に転用
    // テキスト生成プロンプトにはハッシュタグのみ残す

    if (insights.length > 0) {
      collectiveIntelligenceSection = `\n${insights.join('\n\n')}\n`;
    }
  }

  // ハッシュタグ（優先順位: テンプレ固定タグ → 関連タグ → 集合知タグ）
  const templateHashtags = templates.hashtags || [];
  let fallbackHashtags = '';

  if (!collectiveIntelligenceSection) {
    const categoryHint = (store.category && store.category !== '開発者テスト') ? `業種は「${store.category}」。` : '';
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

  // ── インフルエンサー専用プロンプト ──────────────────────────
  if (store.category === 'インフルエンサー') {
    return buildInfluencerTextPrompt({
      personalization, characterSection, userText,
      collectiveIntelligenceSection, industryPatternSection,
      fallbackHashtags, lengthInfo,
    });
  }

  // ── 店舗用プロンプト（従来通り）──────────────────────────
  const textRoleSection = `あなたは「写真観察AI」です。
${store.name}の店主が送ってきたテキスト情報から、投稿ネタになる視点・瞬間・空気感を見つけ、
店主自身が「そうそう、それが言いたかった」と思える言葉に変換します。
あなたは文章生成AIではありません。店主の言葉の中にある魅力を見つけて言語化します。

強いセールスは禁止。不自然な比喩は禁止。
「それっぽい文脈」を足さず、店主の言葉からしか生まれない投稿にすること。
語彙は一般的で自然な日本語にしてください。`;

  const globalRulesSection = options.globalRules || '';

  return `${personalization}${globalRulesSection}
${textRoleSection}

【書き方の型（最重要）】
あなたが書くのは「AIが作った綺麗な文章」ではなく「店主が友達にLINEで送るような言葉」です。

【1行目のルール】
店名を隠しても「あの店だ」とわかる1行目を書く。
- NG:「今日も頑張りました」（どの店でも言える）
- NG:「カラー剤の甘い匂いがたまらない」（美容室なら誰でも言える）
- OK:「ブリーチ2回からのアッシュパープル、狙い通りの透け感出た」（この施術をした人しか書けない）
- OK:「型から外した瞬間、バターの匂いがぶわっときた」（この店の今日の体験）

【本文の書き方 — 「視点→行動→情景」の流れ】
1行目（視点）: 今日やった具体的なこと・気づいたポイント
2行目（行動）: 手に取る・混ぜる・塗る・並べるなど具体的な動き
最後（情景・共感）: 「気付いたら〜してしまう」「つい〜してしまう」など体験で締める
- NG: 視点の説明→感想で終わる（説明文に見える）
- OK: 視点→行動→情景（店主の体験投稿に見える）
- 店主が伝えたい内容がある場合、その言葉をそのまま核にして文章を組み立てる。AIが上手く書き換えない
- 「上手い文章」より「本人が書いたっぽい文章」を最優先する
- 失敗談・ツッコミ・不完全な表現は「味」になる。排除せず残す

【避けること】
- 「本日焼き上げました」のような乾いた報告 → 「型から外した瞬間、湯気と一緒にバターの匂いがぶわっときた」のように体験として書く
- 営業時間・価格・メニュー名の羅列 → 本文に入れない。プロフィールに任せる
- 完璧な優等生の文章 → 少しだけ迷い・本音を混ぜて人間味を出す

【店主の口調】
${toneData.persona}

【口調ルール】
${toneData.style_rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

【禁止ワード】
${toneData.forbidden_words.join(', ')}, 幻想的, 素敵, 魅力的, 素晴らしい, 完璧, 最高, 美しい, まじ, まじで, やばい, やばすぎ, 超, めっちゃ, 美味しい, 絶品, こだわり, 自慢の, 人気の, 話題の, 光の意志, 質感の物語, 沈黙のデザイン, 肖像, 独白
→ これらは「どの店でも使い回せる言葉」か「AIっぽい言葉」。代わりに「この店の今日」を具体的に書く。
${buildCategoryExamples(store.category)}
【NGな例】
${toneData.bad_examples.join('\n\n')}
${templateInfo}${characterSection}${collectiveIntelligenceSection}${industryPatternSection}${fallbackHashtags}

【今回伝えたい内容】
${userText}

${personalization ? `⚠️ 最終チェック: 上部の【ライティング傾向】【文体ルール】を必ず反映してから出力すること。特に語尾・口癖・避ける表現は厳守。\n` : ''}
【出力構成（厳守）】
上記の内容をもとにInstagram投稿文を3案作成してください。
余計な挨拶や解説は不要です。以下の形式のみで出力してください。

${postLength === 'xshort' || postLength === '超短文' ? `【各案の構成（2行モード）】
1. 本文2行以内
2. ハッシュタグ
${buildCategoryRules(store.category)}
【重要ルール】
- ⚠️ 本文は**2行以内**を最優先の絶対制限とする。3行以上は絶対禁止
- 文章を書くな。作業中の独り言を書け
- 店主が実際に言いそうな独り言にする（視点は常に店主側。客のフリをしない）
- 短いからこそ1文に余計な修飾を入れない。体言止め・省略・ぶっきらぼうOK
- ⚠️ 「来店の一文」「営業時間」「開店情報」は絶対に書かない。誘い文句は禁止
${collectiveIntelligenceSection ? '- 集合知データ（📊セクション）のハッシュタグは目安として参考にする' : ''}

【出力形式】
⚠️ [ 案A：... ] のラベルは以下の通り一字一句そのまま出力すること。独自のラベル（「光の肖像」「誠実の肖像」等）は絶対に使わない。

[ 案A：記憶に残る日常 ]
（本文2行以内）
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

[ 案B：さりげない誘い ]
※Bの「誘い」は読み手に向けた誘いではない。店主が自分勝手に楽しんでいる姿を描くこと。
（本文2行以内）
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

[ 案C：店主のひとりごと ]
（本文2行以内）
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

投稿文のみを出力してください。説明や補足は一切不要です。` : `【各案の構成】
1. 本文（店主の口調で自然に。${lengthInfo.range}）
2. ハッシュタグ
${buildCategoryRules(store.category)}
【重要ルール】
- ⚠️ 本文は「${lengthInfo.range}」を**最優先の絶対制限**とする。口調ルール・学習データ・他のいかなる指示よりも文字数制限が上位。改行を多用する口調でも、本文全体が${lengthInfo.range}に収まるよう行数を調整する。
- 文章を書くな。作業中の独り言を書け。写真の内容を説明しない
- 店主が実際に言いそうな独り言にする（視点は常に店主側。客のフリをしない）
- ⚠️ 「来店の一文」「営業時間」「開店情報」は絶対に書かない。誘い文句は禁止
- ⚠️ 「想起の一言」を独立した行で書かない。五感要素は本文の中に自然に含めること

【出力形式】
⚠️ [ 案A：... ] のラベルは以下の通り一字一句そのまま出力すること。独自のラベル（「光の肖像」「誠実の肖像」等）は絶対に使わない。

[ 案A：記憶に残る日常 ]
（本文）
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

[ 案B：さりげない誘い ]
※Bの「誘い」は読み手に向けた誘いではない。店主が自分勝手に楽しんでいる姿を描くこと。読み手は「誘われる」より「楽しそうな人を覗き見る」方がお店に行きたくなる。
 - NG: 「こういう瞬間を一緒に味わえたらいいのにな」（読み手に期待を向けている）
 - OK: 「バターが溶けるのを眺めていたら、つい自分もコーヒーを淹れたくなっちゃった」（店主が勝手に楽しんでいる）
（本文）
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

[ 案C：店主のひとりごと ]
（本文）
#タグ1 #タグ2 #タグ3 #タグ4 #タグ5

投稿文のみを出力してください。説明や補足は一切不要です。`}`;
}

/**
 * 集合知データを戦略アドバイスに変換する
 * テキスト生成プロンプトではなく、ユーザーへの投稿判断アドバイスとして使用
 *
 * @param {object|null} blendedInsights - getBlendedInsights() の戻り値
 * @param {object} store - 店舗情報
 * @returns {object|null} { postingTimeTip, photoStyleTip, contentTip, dataSource } or null
 */
export function buildStrategicAdvice(blendedInsights, store) {
  if (!blendedInsights) return null;

  const { own, category, group } = blendedInsights;

  // データソース判定（自店舗 → カテゴリー → グループの順で優先）
  const ownSampleSize = own?.sampleSize || 0;
  const categorySampleSize = category?.sampleSize || 0;
  const groupSampleSize = group?.sampleSize || 0;

  if (ownSampleSize === 0 && categorySampleSize === 0 && groupSampleSize === 0) {
    return null; // データなし → アドバイスなし
  }

  const dataSource = ownSampleSize >= 5 ? 'own' : categorySampleSize > 0 ? 'category' : 'group';

  // 投稿時間アドバイス
  let postingTimeTip = null;
  const bestHours = (ownSampleSize >= 5 && own?.bestPostingHours?.length > 0)
    ? own.bestPostingHours
    : category?.bestPostingHours || group?.bestPostingHours;
  if (bestHours && bestHours.length > 0) {
    const hourStr = bestHours.slice(0, 2).map(h => `${h}時`).join('・');
    const sourceLabel = (ownSampleSize >= 5 && own?.bestPostingHours?.length > 0)
      ? 'あなたのお店のデータでは' : '同業種のデータでは';
    postingTimeTip = `${sourceLabel}${hourStr}台の投稿が反応良い傾向です`;
  }

  // 写真スタイルアドバイス（勝ちパターンから）
  let photoStyleTip = null;
  const winPattern = own?.winningPattern || category?.winningPattern || group?.winningPattern;
  if (winPattern) {
    const hookJp = buildHookTypeJapanese(winPattern.dominantHookType);
    const charBucketJp = buildCharBucketJapanese(winPattern.dominantCharBucket);
    if (winPattern.dominantHookType === 'emotion') {
      photoStyleTip = '感情が伝わる写真（手元・作業中・表情）の保存率が高い傾向です';
    } else if (winPattern.dominantHookType === 'question') {
      photoStyleTip = '「問いかけ」に合う写真（比較・ビフォーアフター）が反応を取りやすい傾向です';
    } else if (winPattern.dominantHookType === 'taigen_dome') {
      photoStyleTip = 'インパクトのある一枚（断面・アップ・完成形）が保存されやすい傾向です';
    } else if (winPattern.dominantHookType === 'fact') {
      photoStyleTip = '事実を伝える写真（過程・素材・道具）の反応が良い傾向です';
    }
  }

  // コンテンツアドバイス（書き出しパターンの偏り）
  let contentTip = null;
  if (winPattern && winPattern.dominantHookRatio >= 70) {
    // 70%以上同じパターン → バリエーション提案
    const hookJp = buildHookTypeJapanese(winPattern.dominantHookType);
    const alternatives = {
      emotion: '質問形や体言止めの書き出しも試してみると新鮮かもしれません',
      question: '感情から始まる書き出しも混ぜるとバリエーションが出ます',
      taigen_dome: '感情や問いかけの書き出しも反応が取れることがあります',
      fact: '感情や体言止めの書き出しも試してみると幅が広がります',
    };
    contentTip = `${hookJp}の書き出しが${winPattern.dominantHookRatio}%。${alternatives[winPattern.dominantHookType] || ''}`;
  }

  return { postingTimeTip, photoStyleTip, contentTip, dataSource };
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
あなたは「写真観察AI」です。${store.name}の投稿を修正してください。

【ライティング・ルール】
- 写真の観察結果を活かし、店主の言葉で書く
- 詩的すぎない・過度な感情表現をしない・抽象的すぎない
- 店主が実際に言いそうな語り口にする（視点は常に店主側。客のフリをしない）

【絶対に使わない言葉（AI丸出しになるのでNG）】
${toneData.forbidden_words.join(', ')}, 幻想的, 素敵, 魅力的, 素晴らしい, 完璧, 最高, 美しい, ですね, なのですね, 光の意志, 質感の物語, 沈黙のデザイン, 肖像, 独白, 心拍数, 体温, まじ, まじで, やばい, やばすぎ, 超, めっちゃ
${characterSection}
【元の投稿】
${originalPost}

【修正指示（これだけを守れば十分）】
${feedback}

修正指示を100%反映してください。修正指示に書かれていないことは元の投稿をそのまま維持してください。
修正した投稿のみを出力してください。説明・補足は一切不要です。`;
}
