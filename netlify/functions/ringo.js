// ロレックス参考買取相場API（Netlify Function）
// rolex-ringo.com（りんごロレックスマラソン）の買取相場記事から、
// モデル別の「未使用品買取相場」「中古買取相場」を抽出して返す。
// ロレックス専用。実売価格（/api/search）とは別枠の参考情報。
//
// ※ rolex-ringo.com は中間証明書を配信していないため、
//    証明書チェーンを補完する fetchHtmlCompleteChain を使う（検証は維持）。

const { fetchHtmlCompleteChain, stripTags, parsePrice, json } = require("./lib/common.js");

exports.handler = async (event) => {
  const q = (event.queryStringParameters?.q || "").trim();
  const ref = (event.queryStringParameters?.ref || "").trim();
  if (!q) {
    return json(400, { error: "モデル名を指定してください。" });
  }

  // 「ロレックス」はサイト全体が対象なので検索語から外す
  const query = q.replace(/ロレックス/g, "").trim() || q;

  let rows;
  let article = null;
  try {
    const searchHtml = await fetchHtmlCompleteChain(
      `https://rolex-ringo.com/?s=${encodeURIComponent(query)}`
    );
    const links = [
      ...new Set(
        [...searchHtml.matchAll(
          /<a href="(https:\/\/rolex-ringo\.com\/[^"?]+)" class="entry-card-wrap/g
        )].map((m) => m[1])
      ),
    ];
    if (links.length === 0) {
      return json(200, { found: false, rows: [], message: "相場記事が見つかりませんでした。" });
    }

    const articleHtml = await fetchHtmlCompleteChain(links[0]);
    article = {
      url: links[0],
      title: stripTags((articleHtml.match(/<title>([^<]*)/) || [])[1] || "").replace(/\s*\|.*$/, ""),
    };
    rows = parseRows(articleHtml);
  } catch (err) {
    return json(502, { error: `相場の取得に失敗しました（${err.message}）。` });
  }

  // 型番が指定されていれば、その型番の行に絞る
  if (ref) {
    const r = ref.toLowerCase();
    const matched = rows.filter((row) => row.ref && row.ref.toLowerCase().includes(r));
    if (matched.length > 0) rows = matched;
  }

  return json(200, {
    found: rows.length > 0,
    source: "rolex-ringo.com",
    article,
    rows: rows.slice(0, 30),
  });
};

// 相場テーブルの各行から モデル名・型番・定価・未使用品相場・中古相場 を抽出
function parseRows(html) {
  const tables = html.match(/<table[\s\S]*?<\/table>/g) || [];
  const rows = [];
  for (const table of tables) {
    for (const rowMatch of table.matchAll(/<tr[\s\S]*?<\/tr>/g)) {
      const row = rowMatch[0];
      if (row.includes("<th")) continue;
      const cells = [...row.matchAll(/<td[\s\S]*?<\/td>/g)].map((c) => stripTags(c[0]));
      if (cells.length < 3) continue;

      const head = cells[0];
      const unused = parsePrice(cells[1]);
      const used = parsePrice(cells[2]);
      if (!unused && !used) continue;

      const refMatch = head.match(/Ref\.?\s*([A-Za-z0-9.\-]+)/i);
      const retailMatch = head.match(/定価[：:]\s*[¥￥]?([\d,]+)/);
      const label = head.split(/Ref\.?/i)[0].trim();

      rows.push({
        label,
        ref: refMatch ? refMatch[1] : "",
        retail: retailMatch ? Number(retailMatch[1].replace(/,/g, "")) : null,
        unused,
        used,
      });
    }
  }
  return rows;
}
