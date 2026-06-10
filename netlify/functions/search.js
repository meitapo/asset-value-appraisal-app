// 販売価格検索API（Netlify Function）
// 価格.com と 楽天市場 の検索結果ページを取得・解析し、各商品の販売価格から
// 統計値（最安値・中央値・平均・最高値）を集計して返す。
// いずれも公開APIではないため、ページ構造の変更で動かなくなる可能性がある。

const { fetchHtml, stripTags, makeStats, json } = require("./lib/common.js");

exports.handler = async (event) => {
  const keyword = (event.queryStringParameters?.q || "").trim();
  if (!keyword) {
    return json(400, { error: "検索キーワード（品名・型番）を入力してください。" });
  }

  // 各サイトを並列取得。片方が落ちても、もう片方の結果で査定を返す。
  const [kakaku, rakuten] = await Promise.allSettled([
    searchKakaku(keyword),
    searchRakuten(keyword),
  ]);

  const rawItems = [];
  if (kakaku.status === "fulfilled") rawItems.push(...kakaku.value);
  if (rakuten.status === "fulfilled") rawItems.push(...rakuten.value);

  const errors = [kakaku, rakuten]
    .filter((r) => r.status === "rejected")
    .map((r) => String(r.reason?.message || r.reason));

  // アクセサリー・別モデルの混入を除いて査定対象を絞り込む
  const items = refineItems(rawItems, keyword);

  if (items.length === 0) {
    return json(200, {
      keyword,
      count: 0,
      stats: null,
      items: [],
      errors,
      message:
        "販売価格が見つかりませんでした。型番・表記を変えてお試しください。",
    });
  }

  items.sort((a, b) => a.price - b.price);

  return json(200, {
    keyword,
    brand: dominantMaker(items),
    count: items.length,
    stats: makeStats(items),
    models: extractModels(items),
    items: items.slice(0, 30),
    sources: [...new Set(items.map((i) => i.source))],
    errors,
  });
};

// 検索結果の商品名から時計の型番（リファレンス番号）候補を抽出する。
// 価格.com公式カタログ品（"型番 [スペック]"形式）を優先しつつ、
// 「型番らしい」トークンを文字パターンで判定して頻度順に返す。
function extractModels(items) {
  const counts = new Map();
  const official = new Set();

  for (const it of items) {
    // 公式カタログ品: 商品名の "型番 [スペック]" の型番部分
    const bracket = it.name.match(/([A-Za-z0-9][A-Za-z0-9.\-/]{2,})\s*\[/);
    if (bracket) {
      const ref = normalizeRef(bracket[1]);
      if (isModelRef(ref)) official.add(ref);
    }
    // 商品名中のASCII英数字トークンをすべて候補にする（ドット区切りの型番も含む）
    const tokens = it.name.match(/[A-Za-z0-9][A-Za-z0-9.\-]{3,}/g) || [];
    for (const token of tokens) {
      const ref = normalizeRef(token);
      if (isModelRef(ref)) counts.set(ref, (counts.get(ref) || 0) + 1);
    }
  }

  const models = [];
  for (const [ref, count] of counts) {
    models.push({ ref, count, official: official.has(ref) });
  }
  // 公式カタログ品 → 出現頻度 → 型番文字列 の順で並べる
  models.sort(
    (a, b) =>
      Number(b.official) - Number(a.official) ||
      b.count - a.count ||
      a.ref.localeCompare(b.ref)
  );
  return models.slice(0, 30);
}

function normalizeRef(token) {
  return token
    .toUpperCase()
    .replace(/^REF\.?/, "") // 「Ref.126613LB」→「126613LB」
    .replace(/^#/, "")
    .replace(/[.\-]+$/, ""); // 末尾の区切り記号を除去
}

// 時計の型番として妥当なトークンかを文字パターンで判定する。
function isModelRef(ref) {
  if (/(MM|CM)$/.test(ref)) return false; // ケース径・ベルト幅（42MM等）
  if (/^(19|20)\d{2}$/.test(ref)) return false; // 年号（2025等）
  if (/^JP\d+$/.test(ref)) return false; // ショップ独自SKU（#jp28294）
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

    items.push({
      source: "価格.com",
      name: maker && !name.startsWith(maker) ? `${maker} ${name}` : name,
      maker,
      price,
      url: nameMatch[1],
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
  const url = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`;
  const html = await fetchHtml(url);

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

  const items = [];
  const seen = new Set();
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
      image: img ? img[1] : null,
      category: "", // 楽天はカテゴリ不明。カテゴリ絞り込みは通過させトークン一致で判定
    });
  }

  return items;
}

// 検索結果から査定対象を絞り込む。
// 1) 最も多いカテゴリ（価格.com由来）と同じカテゴリのみ採用 → ケース等の別カテゴリを除外。
//    カテゴリ不明の商品（楽天）はこのゲートを通過させ、トークン一致で判定する。
// 2) 検索語のすべての単語を商品名に含むもののみ採用 → 別モデル・無関係品を除外。
// 絞り込みすぎて件数が極端に減る場合は1段階前の結果に戻す。
const MIN_REFINED = 3;

function refineItems(items, keyword) {
  if (items.length === 0) return items;

  const topCategory = dominantCategory(items);
  const byCategory = topCategory
    ? items.filter((i) => !i.category || i.category === topCategory)
    : items;
  const base = byCategory.length >= MIN_REFINED ? byCategory : items;

  const tokens = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  const byTokens = base.filter((i) => {
    const name = i.name.toLowerCase();
    return tokens.every((t) => tokenInName(name, t));
  });

  return byTokens.length >= MIN_REFINED ? byTokens : base;
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
