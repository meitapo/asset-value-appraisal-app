// search 系 Functionで共有するユーティリティ

const https = require("https");
const tls = require("tls");
const fs = require("fs");
const path = require("path");

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

// 中間証明書を配信していないサイト（例: rolex-ringo.com）向け。
// サーバーが証明書チェーンを完全に送らないため、同梱した Let's Encrypt の
// 中間証明書をCAリストへ補完する。証明書検証そのものは通常どおり行う。
let caBundle = null;
function getCaBundle() {
  if (!caBundle) {
    const pem = fs.readFileSync(
      path.join(__dirname, "letsencrypt-yr2.pem"),
      "utf-8"
    );
    caBundle = [...tls.rootCertificates, pem];
  }
  return caBundle;
}

function fetchHtmlCompleteChain(url, { timeoutMs = 6000, redirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        ca: getCaBundle(),
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "ja",
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume();
          const next = new URL(res.headers.location, url).href;
          resolve(fetchHtmlCompleteChain(next, { timeoutMs, redirects: redirects - 1 }));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(new TextDecoder("utf-8").decode(Buffer.concat(chunks))));
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
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

// 四分位範囲（IQR）の1.5倍を基準に外れ値除外の下限・上限を返す。
// 件数が少ない場合は実質無制限（全件採用）にする。
function iqrBounds(sortedPrices) {
  if (sortedPrices.length < 4) return [-Infinity, Infinity];
  const q1 = quantile(sortedPrices, 0.25);
  const q3 = quantile(sortedPrices, 0.75);
  const iqr = q3 - q1;
  return [q1 - 1.5 * iqr, q3 + 1.5 * iqr];
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

module.exports = {
  fetchHtml,
  fetchHtmlCompleteChain,
  parsePrice,
  stripTags,
  iqrBounds,
  json,
};
