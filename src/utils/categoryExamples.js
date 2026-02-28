/**
 * カテゴリー別「直し:」例文 / クイックリプライ選択肢
 *
 * store.category の値（categoryDictionary.js の label）に対応。
 */

// ─────────────────────────────────────────────────────────────
// 投稿生成後の例文テキスト（「✏️ 直し: 〇〇」の〇〇部分）
// ─────────────────────────────────────────────────────────────

const CATEGORY_REVISION_EXAMPLES = {
  // 美容系
  'ネイルサロン':          'もっとトレンド感を出して',
  '美容室':               'サロンの雰囲気をより伝えて',
  'エステサロン':          'リラックス感を前面に出して',
  'まつげエクステ':        '目元の魅力をもっと表現して',
  'リラクゼーションサロン': '癒しの空間感をより強調して',

  // 飲食系
  'カフェ':               '温かみのある雰囲気で書き直して',
  'レストラン':            '料理の美味しさをもっと伝えて',
  'ベーカリー':            '焼きたての香りが伝わるように',
  'スイーツ店':            'ワクワク感をもっと出して',
  'ラーメン店':            '本格感とコクをもっと表現して',
  '和食店':               '和の上品さをより丁寧に表現して',
  'イタリアン':            'イタリアの活気を加えて',
  'フレンチ':              '上品でエレガントな表現で',
  'コーヒー豆専門店':      '豆の個性と風味をもっと伝えて',

  // 小売系
  'アパレル':              '着こなしを想像させる表現で',
  '雑貨店':               '日常に馴染むあたたかさで書いて',
  '古着屋':               'ヴィンテージの独自の魅力をもっと伝えて',
  'アクセサリーショップ':  '身に着けた時の輝きを表現して',
  '家具店':               '暮らしのシーンを想像させて',
  '書店':                 '本への愛情をもっと込めて',
  '花屋':                 '花の美しさをより詩的に表現して',

  // サービス系
  'フォトグラファー':      '光と情景の美しさをもっと表現して',
  'デザイン事務所':        'クリエイティブさを前面に出して',
  'コワーキングスペース':  '一緒に働く喜びをもっと伝えて',
  '学習塾':               '生徒の成長をより前向きに描いて',
  'ヨガスタジオ':          '心身の解放感をより強調して',

  // 専門職系
  '士業':                 'もっと親しみやすい言葉で書いて',
  'コンサルタント':        '成果と信頼感をより強調して',
  '不動産':               '暮らしの理想をもっと描いて',

  // クリエイティブ系
  'ハンドメイド作家':      '手作りのぬくもりをもっと伝えて',
  'アーティスト':          '作品への情熱をもっと表現して',
  '音楽教室':             '音楽の楽しさをより感じさせて',
};

const DEFAULT_REVISION_EXAMPLE = 'もっとカジュアルに';

/**
 * カテゴリーに合った「直し:」の例文を返す
 * @param {string|null|undefined} category - store.category の値
 * @returns {string} 例文テキスト（「直し: 〇〇」の〇〇部分）
 */
export function getRevisionExample(category) {
  if (!category) return DEFAULT_REVISION_EXAMPLE;
  return CATEGORY_REVISION_EXAMPLES[category] ?? DEFAULT_REVISION_EXAMPLE;
}

// ─────────────────────────────────────────────────────────────
// 「直し」ボタン押下時のクイックリプライ選択肢（グループ別4択）
// ─────────────────────────────────────────────────────────────

/** カテゴリーラベル → グループ ID */
const CATEGORY_TO_GROUP = {
  // 美容系
  'ネイルサロン':          'beauty',
  '美容室':               'beauty',
  'エステサロン':          'beauty',
  'まつげエクステ':        'beauty',
  'リラクゼーションサロン': 'beauty',
  // 飲食系
  'カフェ':               'food',
  'レストラン':            'food',
  'ベーカリー':            'food',
  'スイーツ店':            'food',
  'ラーメン店':            'food',
  '和食店':               'food',
  'イタリアン':            'food',
  'フレンチ':              'food',
  'コーヒー豆専門店':      'food',
  // 小売系
  'アパレル':              'retail',
  '雑貨店':               'retail',
  '古着屋':               'retail',
  'アクセサリーショップ':  'retail',
  '家具店':               'retail',
  '書店':                 'retail',
  '花屋':                 'retail',
  // サービス系
  'フォトグラファー':      'service',
  'デザイン事務所':        'service',
  'コワーキングスペース':  'service',
  '学習塾':               'service',
  'ヨガスタジオ':          'service',
  // 専門職系
  '士業':                 'professional',
  'コンサルタント':        'professional',
  '不動産':               'professional',
  // クリエイティブ系
  'ハンドメイド作家':      'creative',
  'アーティスト':          'creative',
  '音楽教室':             'creative',
};

/** グループ別クイックリプライ選択肢 */
const GROUP_REVISION_OPTIONS = {
  beauty: [
    { label: 'トレンド感を出して', text: 'トレンド感をもっと出して' },
    { label: '特別感を演出して',   text: '特別感をもっと演出して' },
    { label: '短くして',          text: 'もっと短くして' },
    { label: '明るくして',        text: 'もっと明るくして' },
  ],
  food: [
    { label: '温かみを出して',    text: '温かみをもっと出して' },
    { label: '季節感を加えて',    text: '季節感を加えて' },
    { label: '食欲をそそるように', text: '食欲をそそる表現に直して' },
    { label: '短くして',          text: 'もっと短くして' },
  ],
  retail: [
    { label: 'おしゃれな表現で',  text: 'もっとおしゃれな表現に直して' },
    { label: 'カジュアルに',      text: 'もっとカジュアルに' },
    { label: '短くして',          text: 'もっと短くして' },
    { label: '明るくして',        text: 'もっと明るくして' },
  ],
  service: [
    { label: '専門性を出して',    text: 'もっと専門性を出して' },
    { label: '親しみやすくして',  text: 'もっと親しみやすくして' },
    { label: '感動を伝えて',      text: '感動をもっと伝えて' },
    { label: '短くして',          text: 'もっと短くして' },
  ],
  professional: [
    { label: '信頼感を高めて',    text: '信頼感をもっと高めて' },
    { label: '親しみやすくして',  text: 'もっと親しみやすくして' },
    { label: '実績を前面に',      text: '実績をもっと前面に出して' },
    { label: '短くして',          text: 'もっと短くして' },
  ],
  creative: [
    { label: '熱量を伝えて',      text: '熱量をもっと伝えて' },
    { label: '物語性を加えて',    text: '物語性を加えて' },
    { label: 'カジュアルに',      text: 'もっとカジュアルに' },
    { label: '短くして',          text: 'もっと短くして' },
  ],
};

/** カテゴリー未設定またはマッチしない場合のデフォルト */
const DEFAULT_REVISION_OPTIONS = [
  { label: 'カジュアルに',    text: 'もっとカジュアルに' },
  { label: '絵文字を減らして', text: '絵文字を減らして' },
  { label: '短くして',        text: 'もっと短くして' },
  { label: '明るくして',      text: 'もっと明るくして' },
];

/**
 * 「直し」ボタン押下時のクイックリプライアイテム配列を返す
 * @param {string|null|undefined} category - store.category の値
 * @returns {Array} LINE quickReply items 配列
 */
export function getRevisionQuickReplies(category) {
  const group = category ? CATEGORY_TO_GROUP[category] : null;
  const options = (group && GROUP_REVISION_OPTIONS[group]) ?? DEFAULT_REVISION_OPTIONS;
  return options.map(({ label, text }) => ({
    type: 'action',
    action: { type: 'message', label, text },
  }));
}
