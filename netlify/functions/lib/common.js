// search / buyback 両Functionで共有するユーティリティ

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

async function fetchHtml(url, { encoding = "utf-8", timeoutMs = 6000 } = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ja",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  return new TextDecoder(encoding).decode(buffer);
}

function parsePrice(text) {
  const m = String(text).match(/[\d,]{4,}/g);
  if (!m) return null;
  // 「¥1,000,000~¥1,200,000」のような範囲表記は上限値を採用
  const nums = m.map((s) => Number(s.replace(/,/g, ""))).filter((n) => n > 0);
  return nums.length > 0 ? Math.max(...nums) : null;
}

function stripTags(str) {
  return String(str)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function makeStats(items) {
  const prices = items.map((i) => i.price).sort((a, b) => a - b);
  const filtered = trimOutliers(prices);
  return {
    sampleCount: items.length,
    usedCount: filtered.length,
    min: filtered[0],
    max: filtered[filtered.length - 1],
    median: median(filtered),
    average: Math.round(filtered.reduce((s, v) => s + v, 0) / filtered.length),
  };
}

// 四分位範囲（IQR）の1.5倍を超える価格を外れ値として除外する
function trimOutliers(sortedPrices) {
  if (sortedPrices.length < 4) return sortedPrices;
  const q1 = quantile(sortedPrices, 0.25);
  const q3 = quantile(sortedPrices, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const trimmed = sortedPrices.filter((p) => p >= lower && p <= upper);
  return trimmed.length > 0 ? trimmed : sortedPrices;
}

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function median(sorted) {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
    body: JSON.stringify(body),
  };
}

module.exports = { fetchHtml, parsePrice, stripTags, makeStats, json };
