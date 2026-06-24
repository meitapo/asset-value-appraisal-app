// 中古車相場API（Netlify Function）— ソースはカーセンサーのみ。
// メーカー名＋車種名を受け取り、カーセンサーの車種コードを動的に解決して
// 実車両の本体価格を集計する。公開APIではなくHTMLを解析しているため、
// ページ構造の変更で動かなくなる可能性がある。
//
// 流れ：
//   1) メーカー名 → メーカーコード（bXX。安定しているのでハードコード）
//   2) メーカーの車種一覧ページから 車種名 → 車種コード（sNNN）を動的に解決
//   3) リスティングページ /usedcar/{bXX}/{sNNN}/ から本体価格・車名・画像を抽出

const { fetchHtml, iqrBounds, json } = require("./lib/common.js");

const BASE = "https://www.carsensor.net";

// メーカー名 → カーセンサーのメーカーコード
const MAKER_CODE = {
  "トヨタ": "bTO", "レクサス": "bLE", "日産": "bNI", "ホンダ": "bHO", "スズキ": "bSZ",
  "ポルシェ": "bPO", "フェラーリ": "bFE", "ランボルギーニ": "bLG", "ベンツ": "bME", "BMW": "bBM",
  "アウディ": "bAD", "ベントレー": "bBE", "ロールスロイス": "bRR", "マクラーレン": "bML",
  "アストンマーティン": "bAS", "マセラティ": "bMS", "ランドローバー": "bLR", "ジープ": "bJE",
};

// 車種一覧（メーカーごと）の簡易メモリキャッシュ。ウォーム起動間で再利用される。
const modelListCache = new Map();

exports.handler = async (event) => {
  const maker = (event.queryStringParameters?.maker || "").trim();
  const model = (event.queryStringParameters?.model || "").trim();
  if (!maker || !model) {
    return json(400, { error: "メーカーと車種を指定してください。" });
  }
  const makerCode = MAKER_CODE[maker];
  if (!makerCode) {
    return json(200, { keyword: `${maker} ${model}`, count: 0, stats: null, items: [], message: "未対応のメーカーです。" });
  }

  try {
    const models = await getModelList(makerCode);
    const modelCode = resolveModelCode(models, model);
    if (!modelCode) {
      return json(200, {
        keyword: `${maker} ${model}`,
        brand: maker,
        count: 0,
        stats: null,
        items: [],
        sources: ["カーセンサー"],
        message: "カーセンサーで該当車種が見つかりませんでした。",
      });
    }

    const items = await fetchListings(makerCode, modelCode);
    if (items.length === 0) {
      return json(200, {
        keyword: `${maker} ${model}`,
        brand: maker,
        count: 0,
        stats: null,
        items: [],
        sources: ["カーセンサー"],
        message: "現在この車種の出品が見つかりませんでした。",
      });
    }

    // 本体価格の外れ値を除外して統計を出す
    const sorted = [...items].sort((a, b) => a.price - b.price);
    const prices = sorted.map((i) => i.price);
    const [iqrLow, iqrHigh] = iqrBounds(prices);
    const used = sorted.filter((i) => i.price >= iqrLow && i.price <= iqrHigh);
    const display = used.length >= 3 ? used : sorted;
    const dp = display.map((i) => i.price);
    const median = dp[Math.floor(dp.length / 2)];

    return json(200, {
      keyword: `${maker} ${model}`,
      brand: maker,
      count: items.length,
      stats: {
        median,
        min: dp[0],
        max: dp[dp.length - 1],
        average: Math.round(dp.reduce((s, p) => s + p, 0) / dp.length),
        sampleCount: items.length,
        usedCount: dp.length,
      },
      // 高い順に表示（査定一覧の方針に合わせる）。車は20件まで。
      items: [...display].sort((a, b) => b.price - a.price).slice(0, 20),
      sources: ["カーセンサー"],
    });
  } catch (err) {
    return json(502, { error: `カーセンサーの取得に失敗しました：${err.message}` });
  }
};

// メーカーの車種一覧（{name, code} の配列）を取得（キャッシュあり）
async function getModelList(makerCode) {
  if (modelListCache.has(makerCode)) return modelListCache.get(makerCode);
  const html = await fetchHtml(`${BASE}/usedcar/shashu/${makerCode}/index.html`, { timeoutMs: 9000 });
  const flat = html.replace(/[\n\r\t]/g, " ");
  const re = new RegExp(`/usedcar/(?:map/)?${makerCode}/s(\\d+)/index\\.html"[^>]*>\\s*([^<]{1,30}?)\\s*<`, "g");
  const seen = new Set();
  const models = [];
  let m;
  while ((m = re.exec(flat))) {
    const code = "s" + m[1];
    const name = m[2].replace(/&nbsp;/g, " ").trim();
    if (!name || seen.has(code)) continue;
    seen.add(code);
    models.push({ name, code });
  }
  modelListCache.set(makerCode, models);
  return models;
}

// 車種名 → 車種コード。完全一致を優先し、無ければ部分一致（長い名前を優先）。
function resolveModelCode(models, model) {
  const norm = (s) => s.replace(/[\s　]/g, "").toLowerCase();
  const target = norm(model);
  let exact = models.find((mm) => norm(mm.name) === target);
  if (exact) return exact.code;
  // どちらかがどちらかを含む（より具体的＝長い車種名を優先）
  const partial = models
    .filter((mm) => norm(mm.name).includes(target) || target.includes(norm(mm.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];
  return partial ? partial.code : "";
}

// リスティングページから本体価格・車名・画像・URLを抽出
async function fetchListings(makerCode, modelCode) {
  const html = await fetchHtml(`${BASE}/usedcar/${makerCode}/${modelCode}/index.html`, { timeoutMs: 9000 });
  const flat = html.replace(/[\n\r\t]/g, " ");
  const items = [];
  const seen = new Set();
  // 各出品は detail リンクで始まる。チャンクごとに解析する。
  const chunks = flat.split('name="detail_a"').slice(1);
  for (const c of chunks) {
    const href = (c.match(/href="(\/usedcar\/detail\/[A-Z0-9]+\/index\.html)"/) || [])[1];
    const priceMan = (c.match(/basePrice__mainPriceNum">([0-9,]+)/) || [])[1];
    if (!href || !priceMan) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    // 車名は alt の中で最も長いもの（装備まで含む出品名）を採用
    const alts = [...c.matchAll(/alt="([^"]{4,})"/g)].map((m) => m[1].replace(/&nbsp;/g, " ").trim());
    const name = alts.sort((a, b) => b.length - a.length)[0] || "中古車";
    // 画像は「物件のメイン外観写真」を優先する。
    // /bkkn/…_001（1枚目＝外観）が車本体。無ければ他の bkkn 写真→任意の画像。
    const img =
      (c.match(/(\/\/[^"' ]*\/bkkn\/[^"' ]*_001[^"' ]*\.(?:jpg|jpeg|png))/i) || [])[1] ||
      (c.match(/(\/\/[^"' ]*\/bkkn\/[^"' ]+\.(?:jpg|jpeg|png))/i) || [])[1] ||
      (c.match(/data-original="([^"]+\.(?:jpg|jpeg|png)[^"]*)"/i) || [])[1];
    const price = Number(priceMan.replace(/,/g, "")) * 10000; // 万円→円
    if (!Number.isFinite(price) || price <= 0) continue;
    items.push({
      source: "カーセンサー",
      name,
      maker: "",
      price,
      url: BASE + href,
      image: img ? (img.startsWith("//") ? "https:" + img : img) : null,
      category: "",
    });
  }
  return items;
}
