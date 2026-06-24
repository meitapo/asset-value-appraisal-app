// パテック／AP 定価表ビルドスクリプト（ローカル実行）
// カミネ（正規販売店）のブランド一覧ページから、型番・税込価格（現行は定価）・
// 商品画像を抽出して public/data/{slug}-pricelist.json を生成する。
//
// 実行: node tools/build-kamine-pricelist.js

const fs = require("fs");
const path = require("path");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/525.36";
const ORIGIN = "https://www.kamine.co.jp";

// ブランド設定：出力スラッグ・表示名・一覧ページ・シリーズ判定
const BRANDS = [
  {
    slug: "patek",
    brand: "パテックフィリップ",
    pages: ["watch/patek-philippe/mens", "watch/patek-philippe/ladies"],
    series: (n) =>
      /キュビタス|Cubitus/i.test(n) ? "キュビタス" :
      /ノーチラス/.test(n) ? "ノーチラス" :
      /アクアノート/.test(n) ? "アクアノート" :
      /カラトラバ/.test(n) ? "カラトラバ" :
      /ゴンドーロ/.test(n) ? "ゴンドーロ" :
      /ゴールデン.?エリプス/.test(n) ? "ゴールデンエリプス" :
      /トゥエンティ|トウェンティ|Twenty/i.test(n) ? "トゥエンティ～4" :
      /グランド.?コンプリ/.test(n) ? "グランドコンプリケーション" :
      /コンプリ|アニュアル|パーペチュアル|クロノ|カレンダー/.test(n) ? "コンプリケーション" :
      "その他",
    order: ["ノーチラス", "アクアノート", "キュビタス", "カラトラバ", "ゴンドーロ", "ゴールデンエリプス", "トゥエンティ～4", "コンプリケーション", "グランドコンプリケーション", "その他"],
  },
  {
    slug: "vacheron",
    brand: "ヴァシュロン・コンスタンタン",
    pages: ["watch/vacheron-constantin/mens", "watch/vacheron-constantin/ladies"],
    series: (n) =>
      /オーヴァーシーズ|オーバーシーズ/.test(n) ? "オーヴァーシーズ" :
      /パトリモニー/.test(n) ? "パトリモニー" :
      /トラディショナル/.test(n) ? "トラディショナル" :
      /フィフティ/.test(n) ? "フィフティシックス" :
      /マルタ/.test(n) ? "マルタ" :
      /ヒストリーク/.test(n) ? "ヒストリーク" :
      /イゾグラフ|エジェリー|トゥール ?ド ?リル|メティエ/.test(n) ? "その他コレクション" :
      "その他",
    order: ["オーヴァーシーズ", "パトリモニー", "トラディショナル", "フィフティシックス", "マルタ", "ヒストリーク", "その他コレクション", "その他"],
  },
  {
    slug: "ap",
    brand: "オーデマピゲ",
    pages: ["watch/audemars-piguet/mens", "watch/audemars-piguet/ladies"],
    series: (n) =>
      /オフショア/.test(n) ? "ロイヤルオーク オフショア" :
      /コンセプト/.test(n) ? "ロイヤルオーク コンセプト" :
      /ロイヤル.?オーク/.test(n) ? "ロイヤルオーク" :
      /コード|CODE/i.test(n) ? "コード11.59" :
      /ミレネリー/.test(n) ? "ミレネリー" :
      "その他",
    order: ["ロイヤルオーク", "ロイヤルオーク オフショア", "ロイヤルオーク コンセプト", "コード11.59", "ミレネリー", "その他"],
  },
];

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ja" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parsePage(html, brandCfg) {
  const rows = [];
  // 商品アンカー単位で分割（href が class より前にあるため <a 区切りで取る）。
  // これで各商品の href（item/数字）がその商品ブロックの先頭に来る。
  const blocks = html.split(/<a\s/).filter((b) => /class="p-itemCol"/.test(b.slice(0, 240)));
  for (const b of blocks) {
    const url = (b.match(/^[^>]*?href="(https:\/\/www\.kamine\.co\.jp\/item\/\d+)"/) || b.match(/^[^>]*?href="([^"]+)"/) || [])[1] || "";
    const img = (b.match(/src="(\/uploads\/[^"]+\.(?:jpg|jpeg|png|webp))"/i) || [])[1] || "";
    const ref = (b.match(/Ref">\s*([0-9A-Za-z./-]{4,})/) || [])[1] || "";
    const price = (b.match(/([0-9,]{5,})\s*[（(]\s*税込/) || b.match(/[¥￥]\s?([0-9,]{5,})/) || [])[1] || "";
    // 名前：画像alt の「 BY 」より前を採用
    let name = (b.match(/alt="([^"]+)"/) || [])[1] || "";
    name = name.split(/\s*BY\s*/i)[0];
    name = name.replace(/PATEK PHILIPPE|AUDEMARS PIGUET|パテック\s*フィリップ|オーデマ\s*ピゲ/gi, "");
    // 「婦人用◯◯」→「◯◯（レディース）」
    name = name.replace(/婦人用\s*(.*)/, "$1（レディース）");
    name = name.replace(/\s+/g, " ").trim();
    if (!ref || !price) continue;
    rows.push({
      series: brandCfg.series(name),
      label: name,
      ref,
      retail: Number(price.replace(/,/g, "")),
      url,
      image: img ? ORIGIN + img : "",
    });
  }
  return rows;
}

async function buildBrand(cfg) {
  let all = [];
  for (const p of cfg.pages) {
    try {
      const html = await fetchText(`${ORIGIN}/${p}`);
      const rows = parsePage(html, cfg);
      console.log(`  ${p}: ${rows.length}件`);
      all = all.concat(rows);
    } catch (e) {
      console.log(`  ${p}: 取得失敗 ${e.message}`);
    }
  }
  // 型番で重複排除
  const byRef = new Map();
  for (const r of all) if (!byRef.has(r.ref)) byRef.set(r.ref, r);

  const grouped = new Map();
  for (const r of byRef.values()) {
    if (!grouped.has(r.series)) grouped.set(r.series, []);
    grouped.get(r.series).push({ label: r.label, ref: r.ref, retail: r.retail, url: r.url, image: r.image });
  }
  const groups = [...grouped.keys()]
    .sort((a, b) => (cfg.order.indexOf(a) + 1 || 99) - (cfg.order.indexOf(b) + 1 || 99))
    .map((name) => ({ name, rows: grouped.get(name).sort((a, b) => b.retail - a.retail) }));

  const out = {
    brand: cfg.brand,
    source: "カミネ（正規販売店）",
    sourceUrl: ORIGIN,
    updatedAt: new Date().toISOString().slice(0, 10),
    total: byRef.size,
    groups,
  };
  const outDir = path.join(__dirname, "..", "public", "data");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${cfg.slug}-pricelist.json`), JSON.stringify(out, null, 2), "utf-8");
  console.log(`${cfg.brand}: ${byRef.size}型番 / ${groups.length}シリーズ → ${cfg.slug}-pricelist.json`);
}

async function run() {
  for (const cfg of BRANDS) {
    console.log(`\n=== ${cfg.brand} ===`);
    await buildBrand(cfg);
  }
}

run().catch((e) => {
  console.error("失敗:", e);
  process.exit(1);
});
