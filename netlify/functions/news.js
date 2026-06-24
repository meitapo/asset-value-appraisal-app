// 新着ニュースAPI（Netlify Function）
// 選択中のブランド／メーカー／車種について、新型・新作・新製品・発表に関する
// 最新記事を Google ニュースの RSS（メーカー横断・安定XML）から取得して返す。
// 各メーカーのプレスページは構造がバラバラ・JS描画・多言語で個別取得が困難なため、
// 公式リリースとメディア報道を横断集約する Google ニュースを情報源にしている。

const { json } = require("./lib/common.js");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/525.36";

exports.handler = async (event) => {
  const q = (event.queryStringParameters?.q || "").trim();
  if (!q) return json(400, { error: "ブランド・車種を指定してください。" });

  // 新型・新作・新製品・発表に絞った検索クエリ
  const query = `${q} (新型 OR 新作 OR 新製品 OR 発表 OR 限定 OR 復刻)`;
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=ja&gl=JP&ceid=JP:ja";

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ja" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    const items = [];
    const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    for (const m of blocks) {
      const b = m[1];
      const rawTitle = pick(b, "title");
      const link = pick(b, "link");
      const pubDate = pick(b, "pubDate");
      const source = pick(b, "source");
      if (!rawTitle || !link) continue;
      // Google は "記事タイトル - 媒体名" の形式。末尾の媒体名を落とす。
      let title = decode(rawTitle);
      if (source && title.endsWith(" - " + decode(source))) {
        title = title.slice(0, -(" - " + decode(source)).length);
      }
      items.push({
        title: title.trim(),
        url: link.trim(),
        source: decode(source).trim(),
        date: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : "",
      });
      if (items.length >= 8) break;
    }

    return json(200, { query: q, count: items.length, items, source: "Google ニュース" });
  } catch (err) {
    return json(502, { error: `ニュースの取得に失敗しました：${err.message}` });
  }
};

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1] : "";
}

// XML/HTMLエンティティを軽くデコード
function decode(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
