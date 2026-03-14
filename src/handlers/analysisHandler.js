import { replyText, pushMessage } from '../services/lineService.js';
import { askClaude } from '../services/claudeService.js';
import { getStore, getFeatureAnalysis } from '../services/supabaseService.js';
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
};

function labelOf(val) {
  return FEATURE_LABELS[String(val)] || String(val);
}

/**
 * 分析プロンプト構築
 */
function buildAnalysisPrompt(store, grouped, blendedInsights) {
  // 投稿数の合計（概算）
  let totalPosts = 0;
  for (const items of Object.values(grouped)) {
    for (const item of items) {
      totalPosts = Math.max(totalPosts, item.count);
    }
  }

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

  return `あなたはInstagram運用の写真分析AIです。

目的：
このアカウント（${store.name}、業種: ${store.category || '未設定'}）で反応が良い写真パターンを見つけ、
次に撮るべき写真を具体的に提案してください。

入力データ（写真特徴 × エンゲージメント集計結果）：
${JSON.stringify(grouped, null, 2)}
${supplementData}

出力フォーマット（このまま出力してください）：

📊 写真分析レポート

【強い写真パターン】
・{保存率が高い特徴を日本語で}（保存率 X.X%、N件）
・{2番目}
・{3番目}

【伸びにくい写真】
・{保存率が低い特徴を日本語で}
・{2番目}

🎯 次に撮るべき写真
1. {具体的な撮影指示: 被写体 + 構図 + 光}
2. {具体的な撮影指示}
3. {具体的な撮影指示}

📸 明日撮るならこの1枚
{最も効果的な組み合わせの具体的な撮影指示。場所・時間帯・構図まで書く}

ルール：
1. 数値は入力データからそのまま使う（捏造しない）
2. save_rateは保存÷いいねの比率（0〜1）。パーセント表示する場合は×100
3. 「次に撮るべき写真」は抽象論ではなく、明日すぐ撮れる具体指示にする
4. 業種（${store.category || '未設定'}）に合った提案をする
5. 特徴タグは日本語に変換して出力する
6. データが少ない（各項目3件程度）場合は「まだデータが少ないため参考値です」と冒頭に注記する
7. 前置きや説明は不要。フォーマットどおり出力するだけ`;
}

/**
 * AIレポート生成
 */
async function generateAnalysisReport(store, featureData, blendedInsights) {
  const grouped = groupFeatureData(featureData);
  const prompt = buildAnalysisPrompt(store, grouped, blendedInsights);
  const report = await askClaude(prompt, { max_tokens: 1024 });
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
        '先に店舗を登録してください。「登録」と送信すると始められます。');
    }

    // 3. 店舗取得
    const store = await getStore(user.current_store_id);
    if (!store) {
      return await replyText(replyToken, '店舗情報が見つかりません。');
    }

    // 4. データ取得（並列）
    const [featureData, blendedInsights] = await Promise.all([
      getFeatureAnalysis(store.id, 30),
      getBlendedInsights(store.id, store.category).catch(() => null),
    ]);

    // 5. データ不足チェック
    if (!featureData || featureData.length === 0) {
      return await replyText(replyToken,
        '📊 分析にはもう少しデータが必要です。\n\n写真を投稿して「報告:」でエンゲージメントを報告すると、分析できるようになります。\n（目安: 報告済みの投稿が3件以上）');
    }

    // 6. AIレポート生成（時間がかかるのでまず応答）
    await replyText(replyToken, '📊 分析中です...（10秒ほどお待ちください）');

    const report = await generateAnalysisReport(store, featureData, blendedInsights);

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
