// パテック・フィリップ現行定価表ビルドスクリプト（ローカル実行）
// パテック公式サイト（patek.com/ja）の各コレクションページから型番を集め、
// 個別モデルページの希望小売価格（￥）を抽出して
// public/data/patek-pricelist.json を生成する。
//
// 実行: node tools/build-patek-pricelist.js

const fs = require("fs");
const path = require("path");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const BASE = "https://www.patek.com/ja/collection";

// コレクション（family スラッグ → 日本語シリーズ名）
const FAMILIES = [
  ["nautilus", "ノーチラス"],
  ["aquanaut", "アクアノート"],
  ["calatrava", "カラトラバ"],
  ["complications", "コンプリケーション"],
  ["grand-complications", "グランドコンプリケーション"],
  ["golden-ellipse", "ゴールデンエリプス"],
  ["gondolo", "ゴンドーロ"],
  ["twenty-4", "トゥエンティ～4"],
];

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ja" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function run() {
  // 1) 各コレクションページから型番（5811/1G-001 形式）を収集
  const refByFamily = new Map();
  for (const [slug, jp] of FAMILIES) {
    try {
      const html = await fetchText(`${BASE}/${slug}`);
      const refs = [
        ...new Set([...html.matchAll(/\b(\d{4}\/\d+[A-Z]{0,2}-\d{3})\b/g)].map((m) => m[1])),
      ];
      refByFamily.set(slug, { jp, refs });
      console.log(`${jp}（${slug}）: 型番 ${refs.length} 件`);
    } catch (e) {
      console.log(`${slug}: コレクション取得失敗 ${e.message}`);
      refByFamily.set(slug, { jp, refs: [] });
    }
  }

  // 2) 個別モデルページから希望小売価格（￥）を取得
  const tasks = [];
  for (const [slug, { jp, refs }] of refByFamily) {
    for (const ref of refs) {
      tasks.push({ slug, jp, ref, url: `${BASE}/${slug}/${ref.replace(/\//g, "-")}` });
    }
  }
  console.log(`個別ページ ${tasks.length} 件を取得します…`);

  const rows = [];
  let done = 0;
  let idx = 0;
  const CONCURRENCY = 10;
  async function worker() {
    while (idx < tasks.length) {
      const t = tasks[idx++];
      try {
        const flat = (await fetchText(t.url)).replace(/[\n\r\t]/g, " ");
        const price = (flat.match(/[¥￥]\s?([0-9,]{5,})/) || [])[1];
        let title = (flat.match(/<title>([^<|]+)/) || [])[1] || "";
        title = title.replace(/Patek Philippe|パテック\s*フィリップ/gi, "").replace(/\s+/g, " ").trim();
        if (price) {
          rows.push({
            series: t.jp,
            label: title || t.jp,
            ref: t.ref.replace(/-\d{3}$/, ""), // 末尾の付番（-001等）は落として型番に
            retail: Number(price.replace(/,/g, "")),
            url: t.url,
          });
        }
      } catch (e) {
        // 個別失敗はスキップ
      }
      done++;
      if (done % 30 === 0) console.log(`  ${done}/${tasks.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`価格を取得できたモデル: ${rows.length} 件`);

  // 型番で重複排除（同一型番は最安＝基準）。シリーズ別にまとめる。
  const byRef = new Map();
  for (const r of rows) {
    const cur = byRef.get(r.ref);
    if (!cur || r.retail < cur.retail) byRef.set(r.ref, r);
  }
  const grouped = new Map();
  for (const r of byRef.values()) {
    if (!grouped.has(r.series)) grouped.set(r.series, []);
    grouped.get(r.series).push({ label: r.label, ref: r.ref, retail: r.retail, url: r.url });
  }
  const order = FAMILIES.map(([, jp]) => jp);
  const groups = [...grouped.keys()]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((name) => ({ name, rows: grouped.get(name).sort((a, b) => b.retail - a.retail) }));

  const out = {
    brand: "パテックフィリップ",
    source: "パテック・フィリップ公式サイト",
    sourceUrl: "https://www.patek.com/ja",
    updatedAt: new Date().toISOString().slice(0, 10),
    total: byRef.size,
    groups,
  };
  const outDir = path.join(__dirname, "..", "public", "data");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "patek-pricelist.json"), JSON.stringify(out, null, 2), "utf-8");
  console.log(`書き出し完了（${byRef.size} 型番 / ${groups.length} シリーズ）`);
}

run().catch((e) => {
  console.error("失敗:", e);
  process.exit(1);
});
