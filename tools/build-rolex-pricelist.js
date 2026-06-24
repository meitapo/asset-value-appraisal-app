// ロレックス現行定価表ビルドスクリプト（ローカルで実行）
// ロレックス公式ブティック（そごう・西武）のサイトマップから全現行モデルの
// 詳細ページを取得し、公式の希望小売価格（税込）を抽出して
// public/data/rolex-pricelist.json を生成する。
//
// 実行: node tools/build-rolex-pricelist.js
// 価格改定があったら再実行してJSONを更新する。

const fs = require("fs");
const path = require("path");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const BASE = "https://www.rolexboutique-sogo-seibu.jp";

// スラッグ → シリーズ名（日本語）。長いものを先に判定する。
const SERIES_MAP = [
  ["cosmograph-daytona", "デイトナ"],
  ["sky-dweller", "スカイドゥエラー"],
  ["sea-dweller", "シードゥエラー"],
  ["deepsea", "ディープシー"],
  ["gmt-master-ii", "GMTマスターII"],
  ["explorer-ii", "エクスプローラーII"],
  ["lady-datejust", "レディデイトジャスト"],
  ["datejust", "デイトジャスト"],
  ["day-date", "デイデイト"],
  ["yacht-master", "ヨットマスター"],
  ["submariner", "サブマリーナー"],
  ["explorer", "エクスプローラー"],
  ["air-king", "エアキング"],
  ["oyster-perpetual", "オイスターパーペチュアル"],
  ["land-dweller", "ランドドゥエラー"],
  ["1908", "パーペチュアル1908"],
];

// グループ表示順
const SERIES_ORDER = SERIES_MAP.map(([, jp]) => jp);

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function seriesOf(slug) {
  for (const [key, jp] of SERIES_MAP) if (slug.startsWith(key)) return jp;
  return slug.replace(/-/g, " ");
}

async function run() {
  console.log("サイトマップ取得中…");
  const sm = await fetchText(`${BASE}/sitemap.php`);
  const urls = [
    ...new Set(
      (sm.match(new RegExp(`${BASE.replace(/[.]/g, "\\.")}/watches/[a-z0-9-]+-M[0-9A-Z-]+`, "g")) || [])
    ),
  ];
  console.log(`詳細ページ ${urls.length} 件を取得します…`);

  const items = [];
  let done = 0;
  const CONCURRENCY = 12;
  let idx = 0;
  async function worker() {
    while (idx < urls.length) {
      const url = urls[idx++];
      try {
        const html = await fetchText(url);
        const flat = html.replace(/[\n\r\t]/g, " ");
        // 本体価格を多段で抽出：①メイン価格要素(pceDisplay) ②<h1>直後 ③「希望小売価格」直前
        let price = (flat.match(/pceDisplay[^>]*>\s*([0-9,]+)\s*円/) || [])[1] || "";
        if (!price) {
          const h = flat.indexOf("</h1>");
          if (h >= 0) price = (flat.slice(h, h + 800).match(/([0-9,]{5,})\s*円/) || [])[1] || "";
        }
        if (!price) {
          const k = flat.indexOf("希望小売価格");
          if (k >= 0) {
            const nums = [...flat.slice(Math.max(0, k - 300), k).matchAll(/([0-9,]{5,})\s*円/g)];
            if (nums.length) price = nums[nums.length - 1][1];
          }
        }
        const refFull = (url.match(/-M([0-9A-Z]+-[0-9]+)$/) || url.match(/-M([0-9A-Z]+)/) || [])[1] || "";
        const ref = refFull.split("-")[0];
        const slug = (url.match(/\/watches\/(.+?)-M[0-9A-Z]/) || [])[1] || "";
        let title = (flat.match(/<title>([^<|]+)/) || [])[1] || "";
        title = title.replace(/ロレックス/g, "").replace(/、M[0-9A-Z-]+/g, "").replace(/\s+/g, " ").trim();
        // 文字盤色（仕様欄「ダイアル</dt><dd>◯◯</dd>」）。色違いを別行にするため抽出。
        let dial = (flat.match(/ダイアル\s*<\/dt>\s*<dd[^>]*>\s*([^<]{2,24})/) || [])[1] || "";
        dial = dial.split("、")[0].replace(/\s+/g, " ").trim(); // 「ホワイト、ブラック…」→ホワイト
        if (dial) title += `（${dial}）`;
        // モデル正面画像（公式CDN）。型番別の縦長画像を採用。
        const image =
          (flat.match(/https?:\/\/images\.dh-rx-image\.com\/[^"' )]*upright_watch_assets_portrait\/[^"' )]+\.webp/i) || [])[0] ||
          (flat.match(/https?:\/\/images\.dh-rx-image\.com\/[^"' )]*upright_watch_assets_portrait\/[^"' )]+\.(?:jpg|png)/i) || [])[0] ||
          "";
        if (price && ref) {
          items.push({
            series: seriesOf(slug),
            label: title,
            dial,
            ref,
            retail: Number(price.replace(/,/g, "")),
            url,
            image,
          });
        }
      } catch (e) {
        // 個別失敗はスキップ
      }
      done++;
      if (done % 50 === 0) console.log(`  ${done}/${urls.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`価格を取得できたページ: ${items.length} 件`);

  // 重複排除は「型番＋文字盤色＋価格」単位。色違い・ダイヤ有無は別行で残し、
  // 同一型番・同色・同価格（ブレス違い等）だけを1行に集約する。
  const byKey = new Map();
  for (const it of items) {
    const key = it.ref + "|" + it.dial + "|" + it.retail;
    if (!byKey.has(key)) byKey.set(key, it);
  }
  const grouped = new Map();
  for (const it of byKey.values()) {
    if (!grouped.has(it.series)) grouped.set(it.series, []);
    grouped.get(it.series).push({ label: it.label, ref: it.ref, retail: it.retail, url: it.url, image: it.image || "" });
  }
  const groups = [];
  const seriesNames = [...grouped.keys()].sort(
    (a, b) => (SERIES_ORDER.indexOf(a) + 1 || 99) - (SERIES_ORDER.indexOf(b) + 1 || 99)
  );
  for (const name of seriesNames) {
    const rows = grouped.get(name).sort((a, b) => b.retail - a.retail);
    groups.push({ name, rows });
  }

  const out = {
    brand: "ロレックス",
    source: "ロレックス公式ブティック（そごう・西武）",
    sourceUrl: BASE,
    updatedAt: new Date().toISOString().slice(0, 10),
    total: new Set([...byKey.values()].map((it) => it.ref)).size,
    groups,
  };

  const outDir = path.join(__dirname, "..", "public", "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "rolex-pricelist.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
  console.log(`書き出し完了: ${outPath}（${byKey.size} 行 / ${out.total} 型番 / ${groups.length} シリーズ）`);
}

run().catch((e) => {
  console.error("失敗:", e);
  process.exit(1);
});
