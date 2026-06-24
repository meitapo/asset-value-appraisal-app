// 販売価格検索API（Netlify Function）
// 価格.com・楽天市場・Yahoo!ショッピング の検索結果を取得・解析し、各商品の
// 販売価格から統計値（最安値・中央値・平均・最高値）を集計して返す。
// 時計本体以外（ベルト等の付属品・無関係品）は除外する。
// いずれも公開APIではないため、ページ構造の変更で動かなくなる可能性がある。

const { fetchHtml, stripTags, iqrBounds, json } = require("./lib/common.js");

exports.handler = async (event) => {
  const keyword = (event.queryStringParameters?.q || "").trim();
  if (!keyword) {
    return json(400, { error: "検索キーワード（品名・型番）を入力してください。" });
  }

  const colorParam = (event.queryStringParameters?.color || "").trim();
  // ブランド品のモデル指定（スペーサー/バーキン等）。モール検索語には足して深く取得し、
  // 絞り込み自体は語彙の正規表現で寛容に行う（CH+ と CHプラスの表記ゆれ等を吸収）。
  const modelParam = (event.queryStringParameters?.model || "").trim();
  // ブランド品の色もモール検索語に足して、その色の出品を深く取得する
  const jcolorForMall = (event.queryStringParameters?.jcolor || "").trim();
  // モール検索専用の追加ワード（車の年式等）。出品名には現れないが説明文で
  // マッチする語のため、refineItems の必須トークンには含めない。
  const mallParam = (event.queryStringParameters?.mall || "").trim();
  // 色をモール検索語に付けてその色の出品も取得する。型番の厳格一致は refineItems
  // （色を含まない keyword）で維持するため、別型番（色だけ一致）は混入しない。
  const mallKeyword = [keyword, modelParam, jcolorForMall, colorParam, mallParam].filter(Boolean).join(" ");

  // 各サイトを並列取得。一部が落ちても、取得できたサイトの結果で査定を返す。
  const results = await Promise.allSettled([
    searchKakaku(mallKeyword),
    searchRakuten(mallKeyword),
    searchYahoo(mallKeyword),
  ]);

  const rawItems = [];
  for (const r of results) {
    if (r.status === "fulfilled") rawItems.push(...r.value);
  }
  const errors = results
    .filter((r) => r.status === "rejected")
    .map((r) => String(r.reason?.message || r.reason));

  // ブランド品の場合、keyword から brand/category/model を推測
  const parts = keyword.split(/[\s　]+/).filter(Boolean);
  const brandJewelry = parts[0]; // "エルメス" など
  const categoryJewelry = parts[1]; // "バッグ" など
  const modelJewelry = parts[2]; // "バーキン" など

  // 除外語（例：ロイヤルオーク選択時に「オフショア」「コンセプト」を除く）
  const exclude = (event.queryStringParameters?.exclude || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // 1) 別モデル・別カテゴリの混入を除く 2) 付属品（ベルト等）を除く 3) 下位バリエーションを除く
  let relevantAll = removeAccessories(refineItems(rawItems, keyword));
  if (exclude.length > 0) {
    const filtered = relevantAll.filter(
      (i) => !exclude.some((t) => i.name.includes(t))
    );
    if (filtered.length > 0) relevantAll = filtered;
  }

  if (relevantAll.length === 0) {
    return json(200, {
      keyword,
      count: 0,
      stats: null,
      items: [],
      colors: [],
      errors,
      message:
        "時計本体の販売価格が見つかりませんでした。型番・表記を変えてお試しください。",
    });
  }

  // 文字盤色の選択肢（絞り込み前の全体から作る）。色指定があればその色に絞る。
  const colors = buildColors(relevantAll);
  let relevant = colorParam
    ? relevantAll.filter((i) => detectColor(i.name) === colorParam)
    : relevantAll;

  // ブランド品の絞り込み（モデル・サイズ・刻印・色）。
  // 絞り込みはキーワード一致ではなく出品名の解析（語彙の正規表現）で行うので、
  // 「CH+ / CHプラス」のような表記ゆれで0件になることがない。
  const sizeParam = (event.queryStringParameters?.size || "").trim();
  const stampParam = (event.queryStringParameters?.stamp || "").trim();
  const jcolorParam = (event.queryStringParameters?.jcolor || "").trim();
  const modelJewelryEff = modelParam || modelJewelry;
  if (modelParam) {
    const vocab = JEWELRY_MODEL_VOCAB[brandJewelry] || [];
    const entry = vocab.find(([label]) => label === modelParam);
    const re = entry ? entry[1] : null;
    relevant = relevant.filter((i) => (re ? re.test(i.name) : i.name.includes(modelParam)));
  }
  // サイズ等の選択肢は、その項目で絞る前（モデル絞り込み後）の集合から作る
  const jewelryPool = relevant;
  if (sizeParam || stampParam || jcolorParam) {
    relevant = relevant.filter((i) => {
      const d = extractJewelryDetails(i.name, brandJewelry, categoryJewelry, modelJewelryEff);
      if (sizeParam && d.size !== sizeParam) return false;
      if (stampParam && d.year !== stampParam) return false;
      if (jcolorParam && d.color !== jcolorParam) return false;
      return true;
    });
  }

  if (relevant.length === 0) {
    // 0件でも選択肢（他の条件で絞った集合の件数）は返す。
    // 組み合わせで0件になったとき、ユーザーが選択を変えられるようにする。
    return json(200, {
      keyword,
      count: 0,
      stats: null,
      items: [],
      colors,
      jmodels: buildJewelryModels(relevantAll, brandJewelry),
      sizes: buildSizes(
        jewelryFilter(jewelryPool, brandJewelry, categoryJewelry, modelJewelryEff, { stamp: stampParam, color: jcolorParam }),
        brandJewelry, categoryJewelry, modelJewelryEff
      ),
      stamps: buildStamps(
        jewelryFilter(jewelryPool, brandJewelry, categoryJewelry, modelJewelryEff, { size: sizeParam, color: jcolorParam }),
        brandJewelry, categoryJewelry, modelJewelryEff
      ),
      jcolors: buildJColors(
        jewelryFilter(jewelryPool, brandJewelry, categoryJewelry, modelJewelryEff, { size: sizeParam, stamp: stampParam }),
        brandJewelry, categoryJewelry, modelJewelryEff
      ),
      errors,
      message: "指定の条件の販売価格が見つかりませんでした。",
    });
  }

  // 価格の外れ値を統計・一覧の両方から除外する。
  // ・IQR上限 … 極端な高値（無関係な高額品）を除外
  // ・価格フロア … 中央値の12%未満は本体ではない（本・修理サービス・他ブランドの
  //   キーワードスパム等）とみなして除外。IQR下限は広レンジだと負値になり効かないため。
  const sorted = [...relevant].sort((a, b) => a.price - b.price);
  const prices = sorted.map((i) => i.price);
  const med = prices[Math.floor(prices.length / 2)];
  const [iqrLow, iqrHigh] = iqrBounds(prices);
  const lower = Math.max(iqrLow, med * 0.12);
  const used = sorted.filter((i) => i.price >= lower && i.price <= iqrHigh);
  const display = used.length >= 3 ? used : sorted;

  return json(200, {
    keyword,
    brand: dominantMaker(display),
    count: relevant.length,
    stats: buildStats(relevant.length, display),
    // 型番は価格トリム前の関連集合から抽出する（金無垢など高額バリエーションも拾う）。
    // 他ブランドのスパムはプレフィックス照合・8桁除外・付属品フィルタで抑える。
    models: extractModels(relevant),
    colors,
    // ブランド品のモデル候補（実際の出品から学習。カテゴリ選択時に使う）
    jmodels: buildJewelryModels(relevantAll, brandJewelry),
    // ブランド品の場合、サイズ・刻印年号・色の一覧を返す。
    // 各一覧は「その項目以外の条件で絞った集合」から作る（自分自身で1択に潰れないように）。
    sizes: buildSizes(
      jewelryFilter(jewelryPool, brandJewelry, categoryJewelry, modelJewelryEff, { stamp: stampParam, color: jcolorParam }),
      brandJewelry, categoryJewelry, modelJewelryEff
    ),
    stamps: buildStamps(
      jewelryFilter(jewelryPool, brandJewelry, categoryJewelry, modelJewelryEff, { size: sizeParam, color: jcolorParam }),
      brandJewelry, categoryJewelry, modelJewelryEff
    ),
    jcolors: buildJColors(
      jewelryFilter(jewelryPool, brandJewelry, categoryJewelry, modelJewelryEff, { size: sizeParam, stamp: stampParam }),
      brandJewelry, categoryJewelry, modelJewelryEff
    ),
    // 各出品に判定した文字盤色を付ける（名前のベゼル色と混同しないように一覧で明示）
    // ブランド品の場合、サイズ・刻印年号も抽出。一覧は価格の高い順に表示する
    items: [...display].sort((a, b) => b.price - a.price).slice(0, 30).map((i) => {
      const item = { ...i, dial: detectColor(i.name) };
      if (modelJewelryEff) {
        item.jewelryDetails = extractJewelryDetails(i.name, brandJewelry, categoryJewelry, modelJewelryEff);
      }
      return item;
    }),
    sources: [...new Set(display.map((i) => i.source))],
    errors,
  });
};

// 文字盤色の定義（同義語）。具体色を先に置き、汎用色は後ろに。
// 金属色（K18等）との誤検出を避けるため、金・銀はカタカナのみ採用。
const DIAL_COLORS = [
  ["メテオライト", ["メテオライト"]],
  ["サンダスト", ["サンダスト"]],
  ["シェル", ["マザーオブパール", "ホワイトシェル", "シェル"]],
  ["パンダ", ["逆パンダ", "パンダ"]],
  ["アイスブルー", ["アイスブルー"]],
  ["ターコイズ", ["ターコイズ"]],
  ["シャンパン", ["シャンパン"]],
  ["オリーブ", ["オリーブ"]],
  ["ミント", ["ミントグリーン", "ミント"]],
  ["コニャック", ["コニャック"]],
  ["チョコレート", ["チョコレート"]],
  ["アイボリー", ["アイボリー"]],
  ["ロジウム", ["ロジウム"]],
  ["アンスラサイト", ["アンスラサイト"]],
  ["ブルー", ["ブルー", "青", "ネイビー", "紺"]],
  ["グリーン", ["グリーン", "緑"]],
  ["ブラウン", ["ブラウン", "茶"]],
  ["ピンク", ["ピンク", "ロゼ", "ローズ"]],
  ["パープル", ["パープル", "紫", "グレープ"]],
  ["スレート", ["スレート"]], // スレート（ローマ）はグレーとは別の文字盤として扱う
  ["グレー", ["グレー", "グレイ", "灰"]],
  ["シルバー", ["シルバー"]],
  ["ゴールド", ["ゴールド"]],
  ["ホワイト", ["ホワイト", "白"]],
  ["ブラック", ["ブラック", "黒"]],
];

// ブランド品のモデル語彙。出品名と照合して「市場に実在するモデル」を学習する。
// ラベルは出品名に実際に現れる表記を使う（検索キーワードにそのまま使うため）。
const JEWELRY_MODEL_VOCAB = {
  "クロムハーツ": [
    ["スペーサー", /スペーサー/],
    ["ダガー", /ダガー|デイガー/],
    ["スクロール", /スクロール/],
    ["プレーン", /プレーン/],
    ["フローラル", /フローラル/],
    ["オーバルクロス", /オーバル/],
    ["セメタリー", /セメタリー/],
    ["キーパー", /キーパー/],
    ["スター", /スター(?!リングシルバー)/],
    ["CHプラス", /CHプラス|CH\+|ＣＨプラス/],
    ["ベイビーファット", /ベイビーファット|ベビーファット/],
    ["タイニー", /タイニー/],
    ["ドッグタグ", /ドッグタグ/],
    ["クロスボール", /クロスボール/],
    ["ペーパーチェーン", /ペーパーチェーン/],
    ["フレア", /フレア/],
    ["SBT", /SBT/],
    ["NTFL", /NTFL/],
    ["K&T", /K[&＆]T/],
    ["TFP", /TFP/],
    ["エタニティ", /エタニティ/],
    ["ファンシーチェーン", /ファンシーチェーン/],
    ["クラシックリンク", /クラシックリンク/],
    ["IDブレス", /ID[\s　]*ブレス/],
  ],
  "エルメス": [
    // ブレスレット（「ケリーブレス」は「ケリー」より先に照合する）
    ["シェーヌダンクル", /シェーヌ.?ダンクル/],
    ["クリッククラック", /クリック.?クラック|クリックH/],
    ["コリエドシアン", /コリエ.?ド.?シアン/],
    ["ケリーブレス", /ケリー.?ブレス/],
    // バッグ
    ["バーキン", /バーキン/],
    ["ケリー", /ケリー/],
    ["ボリード", /ボリード/],
    ["ピコタン", /ピコタン/],
    ["ガーデンパーティ", /ガーデンパーティ/],
    ["エブリン", /エブリン/],
    ["リンディ", /リンディ/],
    ["コンスタンス", /コンスタンス/],
    ["オータクロア", /オータクロア/],
  ],
  // バンクリはアルハンブラの系列が多いので、具体的なものを先に置く
  "ヴァンクリーフ": [
    ["ヴィンテージアルハンブラ", /ヴィンテージ.{0,3}アルハンブラ/],
    ["スウィートアルハンブラ", /ス(ウィ|イ)ート.{0,3}アルハンブラ/],
    ["マジックアルハンブラ", /マジック.{0,3}アルハンブラ/],
    ["ピュアアルハンブラ", /ピュア.{0,3}アルハンブラ/],
    ["ラッキーアルハンブラ", /ラッキー.{0,3}アルハンブラ/],
    ["アルハンブラ", /アルハンブラ/],
    ["ペルレ", /ペルレ/],
    ["フリヴォル", /フリヴォル|フリボル/],
    ["カデナ", /カデナ/],
  ],
  "カルティエ": [
    ["ラブ", /ラブリング|ラブブレス|ラブネックレス|LOVEリング|ラブ[\s　]/i],
    ["トリニティ", /トリニティ/],
    ["ジュストアンクル", /ジュスト.?アン.?クル/],
    ["バレリーナ", /バレリーナ/],
    ["パンテール", /パンテール/],
    ["Cドゥカルティエ", /Cドゥ|シードゥ/],
    ["クラッシュドゥカルティエ", /クラッシュ/],
  ],
  "ティファニー": [
    ["バイザヤード", /バイ.?ザ.?ヤード/],
    ["ハードウェア", /ハードウェア/],
    ["Tスマイル", /T.?スマイル/],
    ["Tワン", /T.?ワン|T ONE/i],
    ["オープンハート", /オープンハート/],
    ["アトラス", /アトラス/],
    ["リターントゥ", /リターン.?トゥ/],
    ["ソレスト", /ソレスト/],
  ],
  "ハリーウィンストン": [
    ["リリークラスター", /リリー.?クラスター/],
    ["ループ", /ループ/],
    ["サンフラワー", /サンフラワー/],
    ["HWロゴ", /HW.?ロゴ|ロゴ.?リング|ロゴ.?ペンダント/i],
  ],
  "ブルガリ": [
    ["ビーゼロワン", /ビー.?ゼロワン|B-?ZERO ?1|Bゼロ1/i],
    ["セルペンティ", /セルペンティ/],
    ["ディーヴァドリーム", /ディーヴァ/],
    ["ブルガリブルガリ", /ブルガリ.?ブルガリ/],
    ["モネーテ", /モネーテ/],
  ],
  // シャネルはバッグのモデルを分ける（マトラッセ・ボーイ等）
  "シャネル": [
    ["マトラッセ", /マトラッセ/],
    ["ボーイシャネル", /ボーイ.?シャネル|ボーイ.?チェーン/],
    ["2.55", /2\.55/],
    ["ココハンドル", /ココ.?ハンドル/],
    ["ヴァニティ", /ヴァニティ|バニティ/],
    ["ドーヴィル", /ドーヴィル/],
    ["ガブリエル", /ガブリエル/],
    ["ココクラッシュ", /ココ.?クラッシュ/],
    ["カメリア", /カメリア/],
  ],
  "グッチ": [
    ["GGマーモント", /マーモント/],
    ["ホースビット", /ホースビット/],
    ["ジャッキー", /ジャッキー/],
    ["オフィディア", /オフィディア/],
    ["バンブー", /バンブー/],
  ],
  "ルイヴィトン": [
    ["スピーディ", /スピーディ/],
    ["ネヴァーフル", /ネヴァーフル|ネバーフル/],
    ["アルマ", /アルマ/],
    ["キーポル", /キーポル/],
    ["カプシーヌ", /カプシーヌ/],
    ["オンザゴー", /オンザゴー|ON THE GO/i],
    ["ポルトフォイユ", /ポルトフォイユ/],
  ],
};

// 出品名からモデルを頻度集計する（市場データからの学習）。
// 語彙は具体的なものから並べてあり、最初に一致したモデルだけ数える
// （「ヴィンテージアルハンブラ」が「アルハンブラ」にも二重計上されないように）。
function buildJewelryModels(items, brand) {
  const vocab = JEWELRY_MODEL_VOCAB[brand];
  if (!vocab) return [];
  const counts = new Map();
  for (const i of items) {
    for (const [label, re] of vocab) {
      if (re.test(i.name)) {
        counts.set(label, (counts.get(label) || 0) + 1);
        break;
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([model, count]) => ({ model, count }));
}

// エルメスの色（バッグ・革小物）。具体色を先に置き、汎用色は後ろに。
const HERMES_COLORS = [
  ["エトゥープ", ["エトゥープ", "エトープ"]],
  ["エタン", ["エタン"]],
  ["トゥルティエール", ["トゥルティエール"]],
  ["グリペール", ["グリペール"]],
  ["グリアスファルト", ["グリアスファルト"]],
  ["ブルージーン", ["ブルージーン"]],
  ["ブルーニュイ", ["ブルーニュイ"]],
  ["ブルーエレクトリック", ["ブルーエレクトリック", "ブルーエレクトリーク"]],
  ["アネモネ", ["アネモネ"]],
  ["カプシーヌ", ["カプシーヌ"]],
  ["フランボワーズ", ["フランボワーズ"]],
  ["ルージュアッシュ", ["ルージュアッシュ", "ルージュH"]],
  ["ルージュ", ["ルージュ"]],
  ["ローズ", ["ローズ"]],
  ["クレ", ["クレ"]],
  ["ナタ", ["ナタ"]],
  ["ショコラ", ["ショコラ"]],
  ["マロン", ["マロン"]],
  ["ハバナ", ["ハバナ"]],
  ["ヴェール", ["ヴェール"]],
  ["ジョーヌ", ["ジョーヌ"]],
  ["オレンジ", ["オレンジ"]],
  ["ベージュ", ["ベージュ"]],
  ["ブラック", ["ブラック", "ノワール", "黒"]],
  ["ゴールド", ["ゴールド"]],
  ["ホワイト", ["ホワイト", "白"]],
  ["ブラウン", ["ブラウン", "茶"]],
  ["ブルー", ["ブルー", "青"]],
  ["グレー", ["グレー", "グレイ"]],
  ["ピンク", ["ピンク"]],
  ["グリーン", ["グリーン", "緑"]],
  ["レッド", ["レッド", "赤"]],
];

// エルメスの刻印 → 製造年。□A〜□R は 1997〜2014年、○A〜○Z は 1971〜1996年、
// 2015年以降は記号なしの1文字（T/X/A/C/D/Y/Z/U/B/W…）。
const STAMP_NEW_ERA = {
  T: 2015, X: 2016, A: 2017, C: 2018, D: 2019,
  Y: 2020, Z: 2021, U: 2022, B: 2023, W: 2024,
};

function stampToYear(stamp) {
  if (!stamp) return null;
  const sym = stamp[0];
  const letter = stamp[stamp.length - 1];
  const code = letter.charCodeAt(0) - 64; // A=1
  if (sym === "□") return 1996 + code; // □A=1997 … □R=2014
  if (sym === "○") return 1970 + code; // ○A=1971 … ○Z=1996
  return STAMP_NEW_ERA[letter] || null;
}

// 「□B刻印」「Z刻印」等から刻印を取り出す
function extractStamp(name) {
  const m = /([□◯○])?[\s　]*([A-Z])[\s　]*刻印/.exec(name);
  if (!m) return "";
  const sym = m[1] ? (m[1] === "□" ? "□" : "○") : "";
  return sym + m[2];
}

// エルメスの色を出品名から推定（最も左に出る色を採用）
function detectHermesColor(name) {
  let best = null;
  for (const [lbl, synonyms] of HERMES_COLORS) {
    for (const s of synonyms) {
      const idx = name.indexOf(s);
      if (idx !== -1 && (!best || idx < best.idx)) best = { idx, label: lbl };
    }
  }
  return best ? best.label : "";
}

// ブランド品のモデル・サイズ・刻印・色を抽出する。
function extractJewelryDetails(name, brand, category, model) {
  const details = { model, size: "", year: "", color: "" };

  // エルメスのバッグ：サイズ・刻印年号・色を抽出
  if (brand === "エルメス" && (model === "バーキン" || model === "ケリー")) {
    const sizeMatch =
      new RegExp(model + "[\\s　]*([2-4]\\d)").exec(name) ||
      /[\s　]([2-4]\d)(?=cm|㎝|サイズ)/.exec(name);
    if (sizeMatch) details.size = sizeMatch[1] + "cm";
    details.year = extractStamp(name);
    details.color = detectHermesColor(name);
  }

  return details;
}

// 文字盤の色を推定する。
// 1) 「○○文字盤」の直前のカタカナ語を文字盤色として自動採用する（＝データから学習。
//    色リストに無い新しい色名 サンダスト/オパール/ロジウム等も自動で拾える）。
// 2) 「○○文字盤」が無ければ、色リスト（同義語）から最も左に出る色を採用。
//    ベゼル（○○ベゼル）や素材（○○ゴールド）に隣接する色は文字盤色から除外。
function detectColor(name) {
  let label = extractDialAdjacent(name);

  if (!label) {
    let leftBest = null; // ベゼル/素材以外で最も左に出る色
    for (const [lbl, synonyms] of DIAL_COLORS) {
      for (const s of synonyms) {
        let idx = name.indexOf(s);
        while (idx !== -1) {
          const after = name.slice(idx + s.length, idx + s.length + 4);
          const isBezelOrMetal =
            after.startsWith("ベゼル") || after.startsWith("ゴールド") || after.startsWith("ゴルド");
          if (!isBezelOrMetal && (!leftBest || idx < leftBest.idx)) leftBest = { idx, label: lbl };
          idx = name.indexOf(s, idx + 1);
        }
      }
    }
    label = leftBest ? leftBest.label : "";
  }

  // スレートはローマ数字インデックスを別格の文字盤として分ける
  if (label === "スレート" && /ローマ|ローマン|roman/i.test(name)) {
    return "スレートローマ";
  }
  // サンダストは「ブラックサンダスト（黒＋サンダスト）」と「サンダスト一色」を分ける
  if (label === "サンダスト" && /ブラック|黒/.test(name)) {
    return "ブラックサンダスト";
  }
  return label;
}

// 「○○文字盤」の直前のカタカナ語（＝文字盤色）を取り出す。色でない語は除外。
function extractDialAdjacent(name) {
  const re = /([ァ-ヶ][ァ-ヶー]{1,})文字盤/g;
  let m;
  while ((m = re.exec(name))) {
    let w = m[1];
    if (NON_COLOR_WORDS.has(w)) continue;
    // 素材・ブレス・ベゼル等が直前に連結している語は色ではないので除外
    if (/ステンレス|スチール|ゴールド|プラチナ|オイスター|ジュビリー|ブレス|ベゼル|ラバー|サブ/.test(w)) continue;
    w = w.replace(/ローマン/g, "ローマ"); // 表記ゆれを統一（ローマン→ローマ）
    return w;
  }
  return "";
}

// 「○○文字盤」の○○が色でない（インデックス・素材・仕様）場合の除外語
const NON_COLOR_WORDS = new Set([
  "ローマ", "アラビア", "バー", "インデックス", "スティック",
  "ステンレス", "オイスター", "ジュビリー", "プレジデント",
  "コンビ", "ツートン", "オイスターフレックス", "コンピューター",
]);

// 文字盤色ごとの件数を集計（多い順）。
// 最多色の15%未満の色は、ベゼル等の取りこぼし（少数の誤検出）とみなして除外する。
function buildColors(items) {
  const counts = new Map();
  for (const i of items) {
    const c = detectColor(i.name);
    if (c) counts.set(c, (counts.get(c) || 0) + 1);
  }
  const arr = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (arr.length === 0) return [];
  const top = arr[0][1];
  return arr
    .filter(([, count]) => count >= top * 0.15)
    .map(([color, count]) => ({ color, count }));
}

// ブランド品の属性（サイズ/刻印/色）で絞り込む（一覧の選択肢作成用）
function jewelryFilter(items, brand, category, model, { size = "", stamp = "", color = "" } = {}) {
  if (!brand || !model || (!size && !stamp && !color)) return items;
  return items.filter((i) => {
    const d = extractJewelryDetails(i.name, brand, category, model);
    if (size && d.size !== size) return false;
    if (stamp && d.year !== stamp) return false;
    if (color && d.color !== color) return false;
    return true;
  });
}

// ブランド品のサイズ一覧（バーキン30等）を集計
function buildSizes(items, brand, category, model) {
  if (!brand || !model) return [];
  const counts = new Map();
  for (const i of items) {
    const details = extractJewelryDetails(i.name, brand, category, model);
    if (details.size) counts.set(details.size, (counts.get(details.size) || 0) + 1);
  }
  const arr = [...counts.entries()].sort((a, b) => parseInt(a[0]) - parseInt(b[0])); // サイズ昇順
  return arr.map(([size, count]) => ({ size, count }));
}

// ブランド品の刻印一覧（□B等）を集計。製造年も付けて返す。
function buildStamps(items, brand, category, model) {
  if (!brand || !model) return [];
  const counts = new Map();
  for (const i of items) {
    const details = extractJewelryDetails(i.name, brand, category, model);
    if (details.year) counts.set(details.year, (counts.get(details.year) || 0) + 1);
  }
  const arr = [...counts.entries()].sort((a, b) => {
    // 製造年の新しい順（年が不明な刻印は後ろ）
    const ay = stampToYear(a[0]) || 0;
    const by = stampToYear(b[0]) || 0;
    return by - ay;
  });
  return arr.map(([stamp, count]) => ({ stamp, year: stampToYear(stamp), count }));
}

// ブランド品の色一覧（エトゥープ等）を集計
function buildJColors(items, brand, category, model) {
  if (!brand || !model) return [];
  const counts = new Map();
  for (const i of items) {
    const details = extractJewelryDetails(i.name, brand, category, model);
    if (details.color) counts.set(details.color, (counts.get(details.color) || 0) + 1);
  }
  const arr = [...counts.entries()].sort((a, b) => b[1] - a[1]); // 出品数で降順
  return arr.map(([color, count]) => ({ color, count }));
}

// 表示対象（外れ値除外後）から統計値を作る
function buildStats(sampleCount, used) {
  const prices = used.map((i) => i.price).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 0
      ? Math.round((prices[mid - 1] + prices[mid]) / 2)
      : prices[mid];
  return {
    sampleCount,
    usedCount: prices.length,
    min: prices[0],
    max: prices[prices.length - 1],
    median,
    average: Math.round(prices.reduce((s, v) => s + v, 0) / prices.length),
  };
}

// 検索結果の商品名から時計の型番（リファレンス番号）候補を抽出する。
// 価格.com公式カタログ品（"型番 [スペック]"形式）を優先しつつ、
// 「型番らしい」トークンを文字パターンで判定して頻度順に返す。
function extractModels(items) {
  const counts = new Map();
  const chronoVotes = new Map(); // 型番ごとの「クロノグラフ」表記の数
  const official = new Set();

  for (const it of items) {
    // 「クロノグラフ」搭載か（「クロノメーター」＝精度規格とは区別する）
    const isChrono = /クロノグラフ|chronograph/i.test(it.name);
    // 公式カタログ品: 商品名の "型番 [スペック]" の型番部分
    const bracket = it.name.match(/([A-Za-z0-9][A-Za-z0-9.\-/]{2,})\s*\[/);
    if (bracket) {
      const ref = baseRef(normalizeRef(bracket[1]));
      if (isModelRef(ref)) official.add(ref);
    }
    // 商品名中のASCII英数字トークンをすべて候補にする（ドット区切りの型番も含む）
    const tokens = it.name.match(/[A-Za-z0-9][A-Za-z0-9.\-]{3,}/g) || [];
    for (const token of tokens) {
      const ref = baseRef(normalizeRef(token));
      if (isModelRef(ref)) {
        counts.set(ref, (counts.get(ref) || 0) + 1);
        if (isChrono) chronoVotes.set(ref, (chronoVotes.get(ref) || 0) + 1);
      }
    }
  }

  let models = [];
  for (const [ref, count] of counts) {
    // 半数以上がクロノグラフ表記ならクロノグラフ型番とみなす
    const chrono = (chronoVotes.get(ref) || 0) * 2 >= count;
    models.push({ ref, count, official: official.has(ref), chrono });
  }

  // 枝番（LN/LV等）を省いた数字だけの型番を、対応する英字付き型番に統合する。
  // 例: 「116500」→「116500LN」（同じ数字で始まる英字付きが1種だけのとき）。
  // 複数の英字付き（126610LN/126610LV等）がある場合は曖昧なので統合しない。
  for (const num of models.filter((m) => /^\d+$/.test(m.ref))) {
    const lettered = models.filter(
      (m) => m !== num && m.ref.startsWith(num.ref) && /^[A-Z]/.test(m.ref.slice(num.ref.length))
    );
    if (lettered.length === 1) {
      lettered[0].count += num.count;
      if (num.official) lettered[0].official = true;
      num._merged = true;
    }
  }
  models = models.filter((m) => !m._merged);

  // 単発（count=1）の型番には他モデルのキーワードスパム（別ブランド等）が混じりやすい。
  // 出品2件以上の型番が十分ある人気ブランドでは単発型番を落とす。ただし、人気型番と
  // 数字プレフィックス（先頭4文字）が一致する＝同形式の型番は正規品とみなして残す。
  // （例: デイトジャスト 126231 は 126234 等と「1262」が一致 → 残す。カシオOCW等は除外）
  const strong = models.filter((m) => m.count >= 2);
  if (strong.length >= 5) {
    const strongPrefixes = new Set(strong.map((m) => m.ref.slice(0, 4)));
    models = models.filter(
      (m) => m.count >= 2 || m.official || strongPrefixes.has(m.ref.slice(0, 4))
    );
  }

  // 並び順：3針 → クロノグラフ で分け、各グループ内は
  // 桁数（世代：6桁→5桁→4桁）→ 人気（流通量の多い順）→ 現行カタログ品 → 新しい世代。
  // 人気を桁数の次に置くことで、番号が小さくても流通の多い定番（例: デイトナ 116500LN）が上位に来る。
  models.sort(
    (a, b) =>
      Number(a.chrono) - Number(b.chrono) ||
      refDigits(b.ref) - refDigits(a.ref) ||
      b.count - a.count ||
      Number(b.official) - Number(a.official) ||
      refRecency(b.ref) - refRecency(a.ref) ||
      a.ref.localeCompare(b.ref)
  );
  return models.slice(0, 30);
}

// 型番先頭の数字の桁数（世代の目安。6桁=現行/5桁=旧型/4桁=ヴィンテージ）。
function refDigits(ref) {
  const m = ref.match(/^\d+/);
  return m ? m[0].length : 0;
}

// 型番の先頭の数値（同桁数内での新しさの目安）。数値が無ければ0。
function refRecency(ref) {
  const m = ref.match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function normalizeRef(token) {
  return token
    .toUpperCase()
    .replace(/^REF\.?/, "") // 「Ref.126613LB」→「126613LB」
    .replace(/^#/, "")
    .replace(/[.\-]+$/, ""); // 末尾の区切り記号を除去
}

// 構造化型番を、文字盤色・ブレス違いをまたいだ「基準型番」にまとめる。色は④文字盤で選ぶ。
// ・オーデマピゲ等（数字4-6桁＋英字2字で始まりドットが続く）→ 先頭セグメント（モデル＋素材）。
//   例: 15510ST.OO.1320ST.09 / .08 / 「15510ST」表記 → すべて 15510ST に統合
// ・オメガ等（ドット区切りの数値）→ 末尾の枝番（文字盤コード）だけまとめる。
//   例: 310.30.42.50.01.002 / .001 → 310.30.42.50.01
// ・ロレックス等（ドット無し 126610LN）はそのまま。
function baseRef(ref) {
  const ap = ref.match(/^(\d{4,6}[A-Z]{2})\./);
  if (ap) return ap[1];
  if (ref.includes(".")) return ref.replace(/\.[0-9]{2,3}$/, "");
  return ref;
}

// 時計の型番として妥当なトークンかを文字パターンで判定する。
function isModelRef(ref) {
  if (/(MM|CM)$/.test(ref)) return false; // ケース径・ベルト幅（42MM等）
  if (/^(19|20)\d{2}$/.test(ref)) return false; // 年号（2025等）
  if (/^JP\d+$/.test(ref)) return false; // ショップ独自SKU（#jp28294）
  if (/^\d{8}/.test(ref)) return false; // 先頭8桁以上の数字＝JAN/店舗SKU（型番ではない）
  if (/^\d{3}(\.\d{2,3}){3,}$/.test(ref)) return true; // オメガ等のドット型番
  if (/^[A-Z]{2,6}\d{2,5}[A-Z]{0,3}$/.test(ref)) return true; // SBGA465 / IW3777
  if (/^\d{4,6}[A-Z]{0,4}$/.test(ref)) return true; // ロレックス 126610LN / 1680
  if (/^[A-Z0-9]{2,}[.\-][A-Z0-9.\-]+$/.test(ref) && /\d/.test(ref) && ref.length >= 6) {
    return true; // ハイフン/ドット結合型番（GMW-B5000D-1JF / WDA2112.BA0043）
  }
  return false;
}

// ポートフォリオのブランド別集計用に、絞り込み後の最頻メーカー名を返す
function dominantMaker(items) {
  const counts = new Map();
  for (const i of items) {
    if (!i.maker) continue;
    counts.set(i.maker, (counts.get(i.maker) || 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [maker, count] of counts) {
    if (count > bestCount) {
      best = maker;
      bestCount = count;
    }
  }
  return best;
}

async function searchKakaku(keyword) {
  // nmonly=1: 商品名のみを対象に検索（関連アクセサリーの混入を減らす）
  const url = `https://search.kakaku.com/${encodeURIComponent(keyword)}/?nmonly=1`;
  const html = await fetchHtml(url, { encoding: "shift_jis" });

  const items = [];
  const blocks = html.split(/class="c-list1_cell p-resultItem/).slice(1);

  for (const block of blocks) {
    const nameMatch = block.match(
      /<p class="p-item_name">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/
    );
    const priceMatch = block.match(/<em class="p-item_priceNum">([\d,]+)/);
    if (!nameMatch || !priceMatch) continue;

    const price = Number(priceMatch[1].replace(/,/g, ""));
    if (!Number.isFinite(price) || price <= 0) continue;

    const imageMatch = block.match(
      /<img src="([^"]+)"[^>]*class="p-item_visual_entity"/
    );
    const makerMatch = block.match(/<p class="p-item_maker">([^<]*)<\/p>/);
    const categoryMatch = block.match(/<p class="p-item_category">([^<]*)<\/p>/);

    const maker = makerMatch ? makerMatch[1].trim() : "";
    const name = stripTags(nameMatch[2]);

    // 有料掲載のリダイレクトURL（ksearch/jump/paid/?u=…）は、リダイレクトが
    // 弾かれて開けないことがあるため、ショップの直接URLに変換する
    let url = nameMatch[1];
    const jump = url.match(/[?&]u=([^&]+)/);
    if (url.includes("/ksearch/jump/") && jump) {
      try {
        url = decodeURIComponent(jump[1]);
      } catch {
        // デコード失敗時は元のURLのまま
      }
    }

    items.push({
      source: "価格.com",
      name: maker && !name.startsWith(maker) ? `${maker} ${name}` : name,
      maker,
      price,
      url,
      image: imageMatch ? imageMatch[1] : null,
      category: categoryMatch ? categoryMatch[1].trim() : "",
    });
  }

  return items;
}

// 楽天市場の検索結果ページを解析する。
// React製でクラス名がハッシュ化されるため、安定している
// 商品リンク（item.rakuten.co.jp）と data-price 属性をDOM順でペアにする。
async function searchRakuten(keyword) {
  // 網羅性を上げるため2ページ取得して結合する
  const base = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`;
  const pages = await Promise.allSettled([
    fetchHtml(base),
    fetchHtml(`${base}?p=2`),
  ]);
  const items = [];
  const seen = new Set();
  for (const r of pages) {
    if (r.status === "fulfilled") parseRakuten(r.value, items, seen);
  }
  return items;
}

function parseRakuten(html, items, seen) {
  // 画像と出品ショップ名はReactの埋め込みstate（/エスケープされたJSON）に
  // 商品URLと対で入っているため、先に対応表を作る。
  const imgMap = new Map();
  const unesc = (s) => s.replace(/\\u002F/g, "/");
  const stateRe = /"originalItemUrl":"([^"]+)"[\s\S]{0,600}?"images":\[\{"title":[^,]*,"url":"([^"]+)"/g;
  let sm;
  while ((sm = stateRe.exec(html))) {
    const u = unesc(sm[1]).split("?")[0];
    if (!imgMap.has(u)) imgMap.set(u, unesc(sm[2]));
  }

  // 出品ショップ名（"shop":{"name":"…"}）。商品URLと位置で対応付ける
  const sellerMap = new Map();
  {
    const shops = [];
    for (const s of html.matchAll(/"shop":\{"name":"([^"]+)"/g)) shops.push({ idx: s.index, name: s[1] });
    for (const u of html.matchAll(/"originalItemUrl":"([^"]+)"/g)) {
      const url = unesc(u[1]).split("?")[0];
      if (sellerMap.has(url)) continue;
      // 商品URLの直前に出る最後のshopを採用（同一商品オブジェクト内）
      let best = null;
      for (const s of shops) {
        if (s.idx < u.index && u.index - s.idx < 5000) best = s;
        if (s.idx > u.index) break;
      }
      if (best) sellerMap.set(url, best.name);
    }
  }

  // 商品データは JSON-LD（ItemList）にも構造化されている（名前・画像・価格・URL）。
  // まずこちらを使い、残り（JSON-LDは先頭10件程度）はHTML解析で取得する。
  const ldRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let ld;
  while ((ld = ldRe.exec(html))) {
    try {
      const data = JSON.parse(ld[1]);
      if (data["@type"] !== "ItemList" || !Array.isArray(data.itemListElement)) continue;
      for (const el of data.itemListElement) {
        const it = el && el.item;
        if (!it || !it.name) continue;
        const url = String(it.url || "").split("?")[0];
        const price = Number(it.offers && it.offers.price);
        if (!url || !price || seen.has(url)) continue;
        seen.add(url);
        items.push({
          source: "楽天市場",
          name: it.name,
          maker: "",
          price,
          url,
          image: (Array.isArray(it.image) ? it.image[0] : it.image) || imgMap.get(url) || null,
          seller: sellerMap.get(url) || "",
          category: "",
        });
      }
    } catch {
      // JSONが壊れている場合はHTML解析に任せる
    }
  }

  // タイトル付きの商品リンク（画像のみのリンクは本文長で除外）
  const titles = [];
  const titleRe =
    /<a\b[^>]*?href="(https:\/\/item\.rakuten\.co\.jp\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = titleRe.exec(html))) {
    const name = stripTags(m[2]);
    if (name.length < 12) continue;
    titles.push({ url: m[1].split("?")[0], name, index: m.index });
  }

  // 価格は各商品ブロックの data-price 属性に入っている
  const prices = [];
  const priceRe = /data-price="(\d+)"/g;
  while ((m = priceRe.exec(html))) {
    prices.push({ price: Number(m[1]), index: m.index });
  }

  for (let i = 0; i < titles.length; i++) {
    const t = titles[i];
    const nextIdx = i + 1 < titles.length ? titles[i + 1].index : Infinity;
    // タイトル直後〜次のタイトルまでに現れる価格を対応付ける
    const p = prices.find((pr) => pr.index > t.index && pr.index < nextIdx);
    if (!p || !p.price || seen.has(t.url)) continue;
    seen.add(t.url);

    // 画像はタイトルの手前（画像リンク）にあることが多い
    const before = html.slice(Math.max(0, t.index - 1600), t.index);
    const img = before.match(
      /<img[^>]+(?:src|data-src)="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i
    );

    items.push({
      source: "楽天市場",
      name: t.name,
      maker: "",
      price: p.price,
      url: t.url,
      image: (img ? img[1] : null) || imgMap.get(t.url) || null,
      seller: sellerMap.get(t.url) || "",
      category: "", // 楽天はカテゴリ不明。カテゴリ絞り込みは通過させトークン一致で判定
    });
  }
}

// Yahoo!ショッピングの検索結果を解析する。
// Next.js製で、商品データは __NEXT_DATA__ のJSON内に構造化されている。
async function searchYahoo(keyword) {
  // 網羅性を上げるため2ページ取得（b=31が2ページ目の先頭）して結合する
  const base = `https://shopping.yahoo.co.jp/search?p=${encodeURIComponent(keyword)}`;
  const pages = await Promise.allSettled([
    fetchHtml(base),
    fetchHtml(`${base}&b=31`),
  ]);
  const items = [];
  const seen = new Set();
  for (const r of pages) {
    if (r.status === "fulfilled") parseYahoo(r.value, items, seen);
  }
  return items;
}

function parseYahoo(html, items, seen) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return;
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return;
  }

  // JSONを走査して「price/name/url を持つ商品配列」を集める
  const found = [];
  (function walk(node) {
    if (Array.isArray(node)) {
      if (
        node.length &&
        node[0] &&
        typeof node[0] === "object" &&
        "price" in node[0] &&
        "name" in node[0] &&
        "url" in node[0]
      ) {
        for (const it of node) if (it && it.name && it.price) found.push(it);
        return;
      }
      node.forEach(walk);
    } else if (node && typeof node === "object") {
      for (const v of Object.values(node)) walk(v);
    }
  })(data.props || data);

  for (const it of found) {
    const url2 = String(it.url || "").split("?")[0];
    const price = Number(it.price);
    if (!url2 || !price || seen.has(url2)) continue;
    seen.add(url2);
    items.push({
      source: "Yahoo!ショッピング",
      name: stripTags(it.name),
      maker: (it.brand && it.brand.name) || "",
      price,
      url: url2,
      image: it.image ? it.image.imageUrl || it.image.url || null : null,
      seller: (it.store && it.store.name) || "",
      category: "", // カテゴリはトークン一致で判定するため空にする
    });
  }
}

// ヤフオク！の検索結果を解析する（即決のみ fixed=3）。出品数が多く、カバレッジを補う。
// 各商品は data-auction-* 属性に構造化されている（即決価格・タイトル・画像・URL）。
async function searchYahooAuction(keyword) {
  const base = `https://auctions.yahoo.co.jp/search/search?p=${encodeURIComponent(keyword)}&fixed=3`;
  const pages = await Promise.allSettled([
    fetchHtml(base),
    fetchHtml(`${base}&b=51`), // 2ページ目（51件目〜）
    fetchHtml(`${base}&b=101`), // 3ページ目（101件目〜）
  ]);
  const items = [];
  const seen = new Set();
  for (const r of pages) {
    if (r.status === "fulfilled") parseYahooAuction(r.value, items, seen);
  }
  return items;
}

function parseYahooAuction(html, items, seen) {
  // 商品リンクのタグは複数行に分かれているため class〜次の'>'までをまとめて取る
  const tagRe = /class="Product__titleLink[\s\S]*?>/g;
  let m;
  while ((m = tagRe.exec(html))) {
    const tag = m[0];
    const title = (tag.match(/data-auction-title="([^"]*)"/) || [])[1];
    const price = Number((tag.match(/data-auction-price="(\d+)"/) || [])[1]);
    const img = (tag.match(/data-auction-img="([^"]*)"/) || [])[1];
    const href = (tag.match(/href="(https:\/\/auctions\.yahoo\.co\.jp\/[^"]+)"/) || [])[1];
    if (!title || !price || !href || seen.has(href)) continue;
    seen.add(href);
    items.push({
      source: "ヤフオク",
      name: stripTags(title),
      maker: "",
      price,
      url: href,
      image: img ? img.split("?")[0] : null,
      category: "", // カテゴリはトークン一致で判定するため空にする
    });
  }
}

// 付属品・関連品（ベルト等）を除外する。
// 時計本体の名称には通常現れない、付属品・社外品に特有の語を対象にする。
// 革ベルト等の本体を巻き込まないよう、語は限定的にしている。
const ACCESSORY_PATTERNS = [
  /ラバーベルト/,
  /替えベルト|交換用ベルト|互換ベルト|社外ベルト/,
  /互換品|社外品/,
  /RUBBERB|ラバーB/i,
  /ベルト\s*のみ|バンド\s*のみ|ストラップ\s*のみ/,
  /尾錠|美錠|Dバックル|バックル単体/,
  /インサート/, // 社外ベゼルインサート（交換用パーツ）
  /ベゼル[\s　]*(交換|インサート)|交換用ベゼル/,
  /ワインダー|ワインディング|winder/i,
  /保護フィルム|液晶保護|保護ガラス|保護シート/,
  /バネ棒|ばね棒|工具セット|交換工具/,
  /ウォッチケース|時計ケース|収納ケース|時計ボックス|ウォッチボックス|コレクションケース/,
  /クリーニングクロス|クリーナー/,
  /写真集|ムック|MOOK|雑誌|カタログ|攻略本/i,
  /ゼロからわかる|完全ガイド|の教科書|大全|入門書|読本/,
  /ステッカー|シール|ポスター/,
  // 文字盤・針などの部品単体（時計本体ではない）
  /文字盤[\s　]*(のみ|単体)|ダイヤル[\s　]*(のみ|単体)/,
  /リダン|社外文字盤|カスタム文字盤/,
  /NOS[\s　]*DIAL/i,
  /針[\s　]*一式|文字盤[\s　・･]*針/,
  /返還品/, // 日本ロレックス返還の純正部品（文字盤・針等）
  // 修理・メンテナンスサービス（時計本体ではない）
  /オーバーホール|分解掃除|修理|研磨|磨き直し|外装仕上げ|電池交換/,
  // 工具・ツール類
  /Tightenix|タイトニックス/i,
  // バッグ・ジュエリーの付属品（本体ではない）
  /バッグインバッグ|インナーバッグ|バッグの中敷/,
  /ハンドルカバー|持ち手カバー|レインカバー/,
  /保存袋|保管袋|型崩れ防止|バッグピロー|あんこ/,
  /バッグ[\s　]*チャーム|チャームのみ/,
  /ツイリー単体|スカーフのみ/,
  /ショルダーストラップ[\s　]*(のみ|単体)|単体ストラップ/,
  /クリーニング済みでない訳あり|ジャンク/,
  // 模倣品・本体と無関係なグッズ（キーワードスパム）
  /レプリカ|コピー品|ノーブランド|無刻印|インスパイア|オマージュ/,
  /スマホケース|iPhone[\s　]*ケース|アイフォン[\s　]*ケース|手帳型/i,
  /キーホルダー|ストラップ付きマスコット|ぬいぐるみ/,
  /香水|フレグランス|ルームスプレー/,
];

function removeAccessories(items) {
  const filtered = items.filter(
    (i) => !ACCESSORY_PATTERNS.some((re) => re.test(i.name))
  );
  // すべて弾いてしまった場合は元の集合に戻す（過剰除外の保険）
  return filtered.length > 0 ? filtered : items;
}

// 検索結果から査定対象を絞り込む。
// 1) 最も多いカテゴリ（価格.com由来）と同じカテゴリのみ採用 → ケース等の別カテゴリを除外。
//    カテゴリ不明の商品（楽天）はこのゲートを通過させ、トークン一致で判定する。
// 2) 検索語のすべての単語を商品名に含むもののみ採用 → 別モデル・無関係品を除外。
// トークン一致は必ず維持する（件数が少なくても別型番にフォールバックしない）。
const MIN_REFINED = 3;

function refineItems(items, keyword) {
  if (items.length === 0) return items;

  const topCategory = dominantCategory(items);
  const byCategory = topCategory
    ? items.filter((i) => !i.category || i.category === topCategory)
    : items;
  const base = byCategory.length >= MIN_REFINED ? byCategory : items;

  const tokens = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  return base.filter((i) => {
    const name = i.name.toLowerCase();
    return tokens.every((t) => tokenInName(name, t));
  });
}

// 最頻の（空でない）カテゴリを返す
function dominantCategory(items) {
  const counts = new Map();
  for (const i of items) {
    if (!i.category) continue;
    counts.set(i.category, (counts.get(i.category) || 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [cat, count] of counts) {
    if (count > bestCount) {
      best = cat;
      bestCount = count;
    }
  }
  return best;
}

// 単純な部分一致だと「Mark II」が「Mark III」にも一致してしまうため、
// 文字種（英字/数字/その他）の切れ目を単語境界とみなして照合する。
// 例:「iphone15」では「15」に一致（英字→数字は境界）、「iii」中の「ii」には一致しない。
function tokenInName(name, token) {
  let idx = name.indexOf(token);
  while (idx !== -1) {
    const before = name[idx - 1];
    const after = name[idx + token.length];
    if (
      isBoundary(before, token[0]) &&
      isBoundary(after, token[token.length - 1])
    ) {
      return true;
    }
    idx = name.indexOf(token, idx + 1);
  }
  return false;
}

function isBoundary(adjacentChar, tokenEdgeChar) {
  if (adjacentChar === undefined) return true;
  const adjacent = charClass(adjacentChar);
  return adjacent === "other" || adjacent !== charClass(tokenEdgeChar);
}

function charClass(ch) {
  if (/[0-9０-９]/.test(ch)) return "digit";
  if (/[a-zａ-ｚ]/i.test(ch)) return "alpha";
  return "other";
}
