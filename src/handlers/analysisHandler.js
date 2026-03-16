import { replyText, pushMessage } from '../services/lineService.js';
import { askClaude } from '../services/claudeService.js';
import { getStore, getFeatureAnalysis, getRecentPostsWithFeatures } from '../services/supabaseService.js';
import { getBlendedInsights } from '../services/collectiveIntelligence.js';
import { isFeatureEnabled } from '../services/subscriptionService.js';

/**
 * featureData配列をカテゴリ別にグルーピング＆save_rate降順ソート
 */
export function groupFeatureData(featureData) {
  const result = {};
  for (const row of featureData) {
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
  return result;
}

/**
 * 特徴タグの日本語ラベル変換
 */
const FEATURE_LABELS = {
  // feature_name
  main_subject: '被写体',
  scene_type: 'シーン',
  has_person: '人物',
  action_type: '動作',
  lighting_type: '照明',
  camera_angle: 'アングル',
  // feature_value
  food: '料理',
  person: '人物',
  hands: '手元',
  workspace: '作業スペース',
  interior: '店内',
  coffee: 'コーヒー/ドリンク',
  drink: '飲み物',
  product: '商品',
  meal: '食事シーン',
  cooking: '調理シーン',
  cafe_work: 'カフェ作業',
  portrait: 'ポートレート',
  conversation: '会話',
  empty_space: '空間',
  display: 'ディスプレイ',
  eating: '食事中',
  kneading: 'こねる',
  holding: '持つ',
  drinking: '飲む',
  talking: '会話中',
  looking_out: '外を見る',
  arranging: '並べる',
  serving: '提供',
  none: 'なし',
  natural_soft: '自然光（柔らか）',
  warm_indoor: '暖色照明',
  hard_backlight: '逆光',
  low_light: 'ローライト',
  bright_daylight: '明るい日差し',
  eye_level: '目線の高さ',
  top_down: '真上から',
  side: '横から',
  diagonal: '斜めから',
  close_crop: '寄り',
  true: 'あり',
  false: 'なし',
  other: 'その他',
  // color_tone
  color_tone: '色調',
  warm: '暖色系',
  cool: '寒色系',
  neutral: '中間',
  monochrome: 'モノトーン',
  vibrant: '鮮やか',
  // subject_density
  subject_density: '被写体の数',
  single: '1つ',
  few: '2-3個',
  many: '多数',
  // composition_type
  composition_type: '構図',
  center: '中央配置',
  rule_of_thirds: '三分割',
  symmetry: '対称',
  frame: 'フレーム',
  // diagonal already defined above as '斜めから'
};

function labelOf(val) {
  return FEATURE_LABELS[String(val)] || String(val);
}

/**
 * 分析プロンプト構築
 */
function buildAnalysisPrompt(store, grouped, blendedInsights, recentPosts) {
  // blendedInsightsからの補足
  let supplementData = '';
  if (blendedInsights?.own) {
    const own = blendedInsights.own;
    if (own.bestPostingHours?.length > 0) {
      supplementData += `\n投稿時間帯の傾向: ${own.bestPostingHours.map(h => `${h}時台`).join(', ')}が反応良い`;
    }
    if (own.winningPattern) {
      supplementData += `\n勝ちパターン: ${own.winningPattern}`;
    }
    if (own.sampleSize) {
      supplementData += `\n分析対象: ${own.sampleSize}件の報告済み投稿`;
    }
  }

  // recent_posts セクション
  const recentPostsSection = recentPosts && recentPosts.length > 0
    ? `\n\n直近の投稿データ（特徴セット × 保存率）：\n${JSON.stringify(recentPosts, null, 2)}`
    : '';

  return `あなたはInstagram運用の写真分析AIです。

目的：
このアカウント（${store.name}、業種: ${store.category || '未設定'}）で反応が良い写真パターンを見つけ、
次に撮るべき写真を具体的に提案してください。

■ 特徴別の集計データ（summary_stats）：
${JSON.stringify(grouped, null, 2)}
${supplementData}
${recentPostsSection}

出力フォーマット（このまま出力してください）：

📊 写真分析レポート

【強い特徴】
・{保存率が高い特徴を日本語で}（保存率 X.X%、N件）
・{2番目}
・{3番目}

【伸びやすい組み合わせ】
・{直近投稿データから読み取れる、保存率が高い特徴の組み合わせ}
・{2番目}
※ データ不足の場合は「まだ仮説段階です」と注記

【伸びにくい写真】
・{保存率が低い特徴を日本語で}

🎯 次に撮るべき写真
1. {具体的な撮影指示: 被写体 + 構図 + 光}
2. {具体的な撮影指示}
3. {具体的な撮影指示}

📸 まず1枚撮るならこれ
{最も効果的な組み合わせから導いた具体的な撮影指示。場所・時間帯・構図まで書く。
これを見て明日すぐ撮れるレベルまで落とし込む}

ルール：
1. 数値は入力データからそのまま使う（捏造しない）
2. save_rateは保存÷いいねの比率（0〜1）。パーセント表示する場合は×100
3. 「伸びやすい組み合わせ」は直近投稿データの特徴セットを見て、保存率が高い投稿に共通する特徴の組み合わせを見つける
4. 「次に撮るべき写真」は抽象論ではなく、明日すぐ撮れる具体指示にする
5. 「まず1枚撮るならこれ」は分析結果をそのまま撮影指示に変換する。読んだ人がスマホを持って立ち上がれるレベルの具体性
6. 業種（${store.category || '未設定'}）に合った提案をする
7. 特徴タグは日本語に変換して出力する
8. データが少ない（各項目3件程度）場合は「まだデータが少ないため参考値です」と冒頭に注記する
9. 前置きや説明は不要。フォーマットどおり出力するだけ`;
}

/**
 * AIレポート生成
 */
async function generateAnalysisReport(store, featureData, blendedInsights, recentPosts) {
  const grouped = groupFeatureData(featureData);
  const prompt = buildAnalysisPrompt(store, grouped, blendedInsights, recentPosts);
  const report = await askClaude(prompt, { max_tokens: 1500 });
  return report;
}

/**
 * 「分析」コマンドハンドラー
 */
export async function handleAnalysis(user, replyToken) {
  try {
    // 1. Premium チェック
    const enabled = await isFeatureEnabled(user.id, 'photoAnalysisReport');
    if (!enabled) {
      return await replyText(replyToken,
        '📊 写真分析レポートはプレミアムプランの機能です。\n\n「アップグレード」でプランを確認できます。');
    }

    // 2. 店舗チェック
    if (!user.current_store_id) {
      return await replyText(replyToken,
        '先にアカウントを登録してください。「登録」と送信すると始められます。');
    }

    // 3. 店舗取得
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, 'アカウント情報が見つかりません。');
    }

    // 4. データ取得（並列）
    const [featureData, recentPosts, blendedInsights] = await Promise.all([
      getFeatureAnalysis(store.id, 30),
      getRecentPostsWithFeatures(store.id, 30),
      getBlendedInsights(store.id, store.category).catch(() => null),
    ]);

    // 5. データ不足チェック
    if (!featureData || featureData.length === 0) {
      return await replyText(replyToken,
        '📊 分析にはもう少しデータが必要です。\n\n写真を投稿して「報告:」でエンゲージメントを報告すると、分析できるようになります。\n（目安: 報告済みの投稿が3件以上）');
    }

    // 6. AIレポート生成（時間がかかるのでまず応答）
    await replyText(replyToken, '📊 分析中です...（10秒ほどお待ちください）');

    const report = await generateAnalysisReport(store, featureData, blendedInsights, recentPosts);

    // 7. Push で送信
    await pushMessage(user.line_user_id, [{
      type: 'text',
      text: report,
    }]);

    console.log(`[Analysis] レポート生成完了: store=${store.name}`);
  } catch (err) {
    console.error('[Analysis] エラー:', err.message);
    try {
      await pushMessage(user.line_user_id, [{
        type: 'text',
        text: '分析中にエラーが発生しました。しばらくしてからお試しください。',
      }]);
    } catch {
      // Push失敗は無視
    }
  }
}
