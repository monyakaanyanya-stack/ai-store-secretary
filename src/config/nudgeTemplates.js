/**
 * Daily Photo Nudge テンプレート辞書
 * categoryDictionary.js の groupId ごとに撮影提案を管理
 *
 * 各テンプレート:
 *   subject     - 何を撮る（10-20文字）
 *   cameraTip   - どう撮る（スマホ前提・15-30文字）
 *   description - 一言添え（20-40文字）
 *   season      - null = 通年 / '春'|'夏'|'秋'|'冬' = 季節限定
 */

export const NUDGE_TEMPLATES = {
  // ==================== 美容系 ====================
  beauty: [
    { subject: '施術中の手元', cameraTip: 'スマホを近づけて指先が写り込むくらいで', description: '手元の動きは技術への信頼感を伝えます', season: null },
    { subject: '今日使うカラー剤', cameraTip: '並べて真上から1枚', description: '色の名前を添えるとお客さんの想像が広がる', season: null },
    { subject: 'お客さんが帰った後の椅子', cameraTip: 'あえて片付ける前、そのままの空気で', description: '「ここで誰かが綺麗になった」という余韻', season: null },
    { subject: '閉店後のシャンプー台', cameraTip: '蛍光灯を消して窓からの光だけで', description: '静けさの中に1日の仕事が見える', season: null },
    { subject: 'ネイルのパーツ選び', cameraTip: 'パーツを指先に乗せて自然光の下で', description: '選ぶ過程にあなたのセンスが出る', season: null },
    { subject: '鏡越しのお店の景色', cameraTip: '自分が映らないアングルで鏡だけ撮る', description: '鏡に映るお店は別の表情を持っている', season: null },
    { subject: 'タオルの畳み方', cameraTip: '積み上げた状態を横から', description: '整った準備は「ここはちゃんとしてる」を伝える', season: null },
    { subject: '今日のアロマオイル', cameraTip: 'ボトルを手に持って窓際で', description: '「今日の香り」は来店のきっかけになりやすい', season: null },
    { subject: '予約帳の今日のページ', cameraTip: '名前は見えないようにぼかして', description: '埋まっている予約帳は無言の信頼証明', season: null },
    { subject: '仕上がり直後の後ろ姿', cameraTip: 'お客さんに許可をもらって自然光で', description: 'ビフォーアフターより「今の幸せそうな感じ」', season: null },
    { subject: '新しく届いた商材', cameraTip: '箱から出した瞬間を撮る', description: '「仕入れた」という事実がプロ感を出す', season: null },
    { subject: '窓から差し込む西日と店内', cameraTip: '夕方の光が当たる場所を探して', description: '夕方の光はお店を一番きれいに見せる', season: null },
    // 季節限定
    { subject: '春カラーのサンプル', cameraTip: 'チップを扇形に並べて真上から', description: '季節を先取りするカラー提案が反応を取りやすい', season: '春' },
    { subject: '夏のクールメニュー準備', cameraTip: 'ひんやり感が伝わる小道具と一緒に', description: '暑さ対策メニューは季節の変わり目に響く', season: '夏' },
    { subject: '秋色のネイルチップ', cameraTip: '落ち着いた布の上に並べて', description: '秋は深い色味が保存されやすい', season: '秋' },
  ],

  // ==================== 飲食系 ====================
  food: [
    { subject: '仕込み中の手元', cameraTip: 'カメラを近づけて、包丁が動いている瞬間を', description: '「今から作る」の臨場感が伝わる', season: null },
    { subject: 'コーヒー豆を挽く瞬間', cameraTip: 'ミルの上からのぞき込むように', description: '音と香りを想像させる1枚になる', season: null },
    { subject: '今日の仕入れ食材', cameraTip: 'キッチンに並べたところを自然光で', description: '食材の鮮度は信頼と「行きたい」を生む', season: null },
    { subject: '焼き上がり直後のパン', cameraTip: '湯気が見えるうちに、斜め上から', description: '焼きたての匂いは写真越しに伝わる', season: null },
    { subject: '盛り付け途中のお皿', cameraTip: 'あえて完成前の、手が動いている状態で', description: '完成品より「作っている途中」が保存される', season: null },
    { subject: '閉店後の厨房', cameraTip: 'きれいに片付けたあと、全体をパシャリ', description: '清潔な厨房は無言の品質保証', season: null },
    { subject: 'メニュー表の手書き部分', cameraTip: 'おすすめ欄や今日の一品を寄りで', description: '手書きの文字は人柄が伝わる', season: null },
    { subject: 'お客さんのいない席', cameraTip: 'テーブルセッティングした状態で、斜めから', description: '「ここに座りたい」と思わせる空間の切り取り', season: null },
    { subject: '使い込んだ調理器具', cameraTip: '作業台の上で、自然なまま撮る', description: '道具の年季は料理人としての信頼になる', season: null },
    { subject: 'ラテアートを注ぐ瞬間', cameraTip: 'カップを上から、ミルクが落ちる瞬間を', description: '動きのある瞬間は保存率が高い', season: null },
    { subject: '窓際の席から見える景色', cameraTip: 'お客さんの目線で、コーヒーと一緒に', description: '「この景色を見ながら飲みたい」の構図', season: null },
    { subject: '今日のまかない', cameraTip: '盛り付けは雑でOK、作りたてをそのまま', description: 'まかないは「本当に美味しいもの」の証拠', season: null },
    // 季節限定
    { subject: '冷たいドリンクの水滴', cameraTip: 'グラスの表面に水滴が浮いた瞬間を', description: '水滴は涼しさを視覚で伝える夏の最強素材', season: '夏' },
    { subject: '温かいスープの湯気', cameraTip: '逆光で湯気が見える位置から', description: '湯気は冬の「行きたい」を直接刺激する', season: '冬' },
    { subject: '春の新メニュー試作', cameraTip: '試作段階の素朴な盛り付けで', description: '「まだ試作中」は限定感と親近感を両方出す', season: '春' },
  ],

  // ==================== 小売系 ====================
  retail: [
    { subject: '入荷した段ボールの中身', cameraTip: '箱を開けた瞬間の状態で', description: '「届いた」の生々しさがフォロワーの期待を作る', season: null },
    { subject: '商品を並べ直す手元', cameraTip: 'ディスプレイを整えている動きの途中で', description: '手間をかけている姿はお店の本気を見せる', season: null },
    { subject: '今日のおすすめ1点', cameraTip: '自然光の当たる窓際に置いて', description: '「選んだ理由」を添えるとストーリーになる', season: null },
    { subject: '店内のいちばん好きな角度', cameraTip: 'お客さんが入ってくる方向から', description: 'あなたが好きな景色は見る人も好きになる', season: null },
    { subject: '値札を書いている手元', cameraTip: 'ペンを持っている手とPOPを一緒に', description: '手書きの値札は温度がある', season: null },
    { subject: '閉店後のレジ周り', cameraTip: 'レジを閉じて整えた状態で', description: '1日の終わりの静かな店は美しい', season: null },
    { subject: 'お客さんが触れる前の商品', cameraTip: '棚に並んだ状態を正面から', description: '「この中から選ぶ」ワクワク感を出す', season: null },
    { subject: 'ラッピング途中', cameraTip: '紙や箱を広げた作業台の上から', description: 'ラッピングの丁寧さは「ここで買いたい」の決め手', season: null },
    { subject: '試着室の鏡', cameraTip: '服がかかった状態で鏡越しに', description: '「着てみたい」を想像させる仕掛け', season: null },
    { subject: '在庫チェック中の棚', cameraTip: 'ぎっしり詰まった棚を横から', description: '品揃えの厚みは一目で伝わる', season: null },
    // 季節限定
    { subject: '春の新作を並べた棚', cameraTip: '明るい色が映える場所で', description: '春は色味で季節感を出すと反応率が上がる', season: '春' },
    { subject: '冬ギフトのラッピング', cameraTip: 'リボンを結んでいる手元を', description: '12月はギフト投稿の保存率が最も高い', season: '冬' },
  ],

  // ==================== サービス系 ====================
  service: [
    { subject: 'レッスン前の準備', cameraTip: '道具やマットを並べた状態を', description: '「これから始まる」の空気感が伝わる', season: null },
    { subject: 'スタジオの窓からの光', cameraTip: '誰もいない時間帯に、光の筋を撮る', description: '静かな空間は「行ってみたい」の入口', season: null },
    { subject: '今日使うテキスト', cameraTip: '開いたページを斜め上から', description: '学びの内容を見せると「自分も」と思わせる', season: null },
    { subject: 'ホワイトボードの板書', cameraTip: '書き終わった状態を正面から', description: '情報量のある写真は保存されやすい', season: null },
    { subject: 'お客さんの靴が並んだ玄関', cameraTip: 'きれいに揃った靴を真上から', description: '人の気配が間接的に「人気」を伝える', season: null },
    { subject: '片付け前の教室', cameraTip: '使った跡が残る、リアルな状態で', description: '「ここで何かが起きた」を想像させる', season: null },
    { subject: '撮影機材のセッティング', cameraTip: '三脚やライトを組んでいる途中で', description: 'プロの道具は信頼感を直接伝える', season: null },
    { subject: 'カメラのファインダー越し', cameraTip: 'スマホでファインダーを覗いている風に', description: '「この人に撮ってもらいたい」の入口になる', season: null },
    { subject: '予約表の今日の枠', cameraTip: '個人情報が映らないように上から', description: '予約が入っている事実が最大の広告', season: null },
    { subject: '朝一番のスタジオ', cameraTip: '朝の柔らかい光で全体を', description: '朝の静けさは1日の始まりの美しさを伝える', season: null },
  ],

  // ==================== 専門職系 ====================
  professional: [
    { subject: '今日のデスク周り', cameraTip: 'パソコンと書類が見える角度で', description: '仕事環境を見せると「ちゃんとしてる人」感が出る', season: null },
    { subject: '書類に書き込む手元', cameraTip: 'ペンを持つ手と書類を一緒に', description: '集中している手元は信頼を生む', season: null },
    { subject: '打ち合わせ前の会議室', cameraTip: '資料を並べた状態で', description: '準備の丁寧さはプロの証', season: null },
    { subject: '本棚の一角', cameraTip: '背表紙が読める距離で', description: '専門書の棚は「この人に相談したい」の素材', season: null },
    { subject: 'コーヒーと仕事道具', cameraTip: 'マグカップと資料を並べて自然光で', description: '日常の一コマが人柄を伝える', season: null },
    { subject: '窓からの景色と仕事場', cameraTip: 'デスクと窓を一緒に、引きで', description: '仕事環境の快適さは事務所の雰囲気を伝える', season: null },
    { subject: 'セミナー資料の準備', cameraTip: 'プリントアウトを束ねている手元を', description: '知識を共有する姿勢は専門家の信頼材料', season: null },
    { subject: '移動中の書類カバン', cameraTip: 'カバンから書類が少し見える状態で', description: '「現場に行く人」は動ける専門家の印象を作る', season: null },
  ],

  // ==================== クリエイティブ系 ====================
  creative: [
    { subject: '制作途中の作品', cameraTip: '手を止めた瞬間、そのままの状態で', description: '完成品より途中の方がストーリーが見える', season: null },
    { subject: '道具が散らばった作業台', cameraTip: '片付ける前のリアルな状態を真上から', description: '散らかった道具は「ガチで作ってる」の証拠', season: null },
    { subject: '今日使う素材', cameraTip: '並べて色や質感が分かるように', description: '素材選びの段階からファンは見たがっている', season: null },
    { subject: '失敗した作品', cameraTip: '成功作と並べて比較できるように', description: '失敗を見せると「この人は正直」の信頼になる', season: null },
    { subject: '手についた絵の具・のり・粉', cameraTip: '汚れた手を自然光で', description: '手の汚れは作り手の本気を伝える', season: null },
    { subject: '窓際で乾かしている作品', cameraTip: '光が当たっている状態で斜めから', description: '「待つ時間」も制作の一部という空気', season: null },
    { subject: '梱包前の完成品', cameraTip: '箱に入れる直前、最後の一瞥を', description: '送り出す直前の気持ちが写る', season: null },
    { subject: '練習用のスケッチ', cameraTip: 'ノートを開いた状態で自然に', description: '練習を見せると「努力している人」の親近感', season: null },
    { subject: 'アトリエの全景', cameraTip: '2歩下がって空気ごと1枚に', description: '制作空間は作品以上にその人を伝える', season: null },
    { subject: '今日のBGMとコーヒー', cameraTip: 'スピーカーとマグカップを一緒に', description: '制作中の空気感はファンが最も共感する投稿', season: null },
  ],
};

/**
 * グループIDからテンプレート一覧を取得
 * 不明なグループの場合は food（最も汎用的）にフォールバック
 */
export function getTemplatesForGroup(groupId) {
  return NUDGE_TEMPLATES[groupId] || NUDGE_TEMPLATES.food;
}
