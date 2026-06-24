// 貴金属相場API（Netlify Function）
// 田中貴金属の本日価格ページから、金・プラチナ・銀の店頭小売価格・買取価格
// （いずれも 円/g・税込）を取得して返す。実物資産（地金・ジュエリー）の
// 時価評価に使う。公開APIではなくHTMLを解析しているため、ページ構造の
// 変更で動かなくなる可能性がある。
//
// ページ構造（2026-06時点）：
//   retail_tax / purchase_tax のセルが出現順で 金→プラチナ→銀 と並ぶ。
//   金・プラチナは metal_name セルもあるが、銀は「現物販売なし」で構造が
//   異なるため、堅牢性のため出現順で 3 種に割り当てる。

const { fetchHtml, json } = require("./lib/common.js");

const SOURCE_URL = "https://gold.tanaka.co.jp/commodity/souba/";
const METAL_ORDER = ["金", "プラチナ", "銀"];

exports.handler = async () => {
  try {
    const html = await fetchHtml(SOURCE_URL, { encoding: "utf-8", timeoutMs: 8000 });

    const retail = pickCells(html, "retail_tax");
    const purchase = pickCells(html, "purchase_tax");

    const metals = {};
    METAL_ORDER.forEach((name, i) => {
      // 買取価格を「時価」として使う（売却時の手取りに近い）。小売も参考に返す。
      const buy = purchase[i];
      const sell = retail[i];
      if (buy || sell) {
        metals[name] = { purchase: buy || null, retail: sell || null };
      }
    });

    if (Object.keys(metals).length === 0) {
      return json(502, { error: "貴金属相場を取得できませんでした（ページ構造変更の可能性）。" });
    }

    return json(200, {
      metals,
      source: "田中貴金属",
      sourceUrl: SOURCE_URL,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    return json(502, { error: `貴金属相場の取得に失敗しました：${err.message}` });
  }
};

// class="xxx">12,345 円 形式のセルを出現順に数値配列で返す
function pickCells(html, className) {
  const flat = html.replace(/[\n\r]/g, "");
  const re = new RegExp(`class="${className}">([0-9.,]+)\\s*円`, "g");
  const out = [];
  let m;
  while ((m = re.exec(flat))) {
    const v = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(v) && v > 0) out.push(v);
  }
  // ページ上部に金・プラチナ・銀のサマリーが1組（3件）並ぶので先頭3件を採用
  return out.slice(0, 3);
}
