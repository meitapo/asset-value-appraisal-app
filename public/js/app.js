// 資産価値査定アプリ フロントエンド
// /api/search（価格.com・楽天市場の販売価格）で市場価値を査定し、
// 型番で絞り込み、ポートフォリオ（localStorage保存）でブランド別に資産を管理する。

const STORAGE_KEY = "asset-portfolio.v1";

const form = document.getElementById("search-form");
const keywordInput = document.getElementById("keyword");
const searchBtn = document.getElementById("search-btn");
const statusEl = document.getElementById("status");
const appraisalEl = document.getElementById("appraisal");
const listingsEl = document.getElementById("listings");
const listingGrid = document.getElementById("listing-grid");
const portfolioEl = document.getElementById("portfolio");
const addBtn = document.getElementById("add-portfolio-btn");
const refreshBtn = document.getElementById("refresh-portfolio-btn");
const modelFilterEl = document.getElementById("model-filter");
const modelSelect = document.getElementById("model-select");
const modelFilterHint = document.getElementById("model-filter-hint");

let lastResult = null; // 直近の査定結果（ポートフォリオ追加用）
let baseKeyword = ""; // 型番ドロップダウンの基準となる検索ワード（ブランド/モデル名）
let currentQueryId = 0;

const yen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");

// ---------------------------------------------------------------- 査定

form.addEventListener("submit", (e) => {
  e.preventDefault();
  runAppraisal(keywordInput.value.trim());
});

document.querySelectorAll(".example-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    keywordInput.value = chip.dataset.q;
    runAppraisal(chip.dataset.q);
  });
});

// 型番ドロップダウンで絞り込み。
// 型番のみだと無関係な商品が混ざるため、必ず親キーワードと組み合わせて検索する。
modelSelect.addEventListener("change", () => {
  const ref = modelSelect.value;
  runAppraisal(combineKeyword(baseKeyword, ref), { isDrill: true });
});

// 親キーワードと型番を結合する（重複時はそのまま）
function combineKeyword(base, ref) {
  if (!ref) return base;
  if (!base) return ref;
  return base.toLowerCase().includes(ref.toLowerCase()) ? base : `${base} ${ref}`;
}

// isDrill=true は型番ドロップダウンからの絞り込み。
// その場合は型番リストを作り直さず、選択中の型番だけ更新する。
async function runAppraisal(keyword, { isDrill = false } = {}) {
  if (!keyword) return;

  const queryId = ++currentQueryId;
  lastResult = null;
  appraisalEl.hidden = true;
  listingsEl.hidden = true;
  if (!isDrill) modelFilterEl.hidden = true;
  showStatus(`<span class="spinner"></span>「${escapeHtml(keyword)}」の販売価格を調査しています…`);
  searchBtn.disabled = true;

  try {
    const data = await fetchAppraisal(keyword);
    if (queryId !== currentQueryId) return;

    if (!data.stats || data.count === 0) {
      showStatus(data.message || "該当する商品が見つかりませんでした。型番を変えてお試しください。", true);
      if (!isDrill) modelFilterEl.hidden = true;
      return;
    }

    hideStatus();
    lastResult = data;
    if (!isDrill) {
      baseKeyword = keyword;
      renderModelFilter(data);
    }
    renderAppraisal(data);
    renderListings(data);
  } catch (err) {
    if (queryId === currentQueryId) showStatus(escapeHtml(err.message), true);
  } finally {
    if (queryId === currentQueryId) searchBtn.disabled = false;
  }
}

// 型番ドロップダウンを構築する（時計など型番が複数見つかった場合のみ表示）。
// 各選択肢は「親キーワード ＋ 型番」で表示し、選択時もそのセットで検索する。
function renderModelFilter(data) {
  const models = data.models || [];
  if (models.length < 2) {
    modelFilterEl.hidden = true;
    return;
  }

  modelSelect.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = `すべて（${baseKeyword}・全体 ${data.count}件）`;
  modelSelect.appendChild(allOpt);

  for (const m of models) {
    const opt = document.createElement("option");
    opt.value = m.ref;
    const count = m.official ? `（掲載 ${m.count}件）` : "";
    opt.textContent = `${baseKeyword} ${m.ref}${count}`;
    modelSelect.appendChild(opt);
  }

  modelSelect.value = "";
  modelFilterHint.textContent = `${models.length}件の型番が見つかりました`;
  modelFilterEl.hidden = false;
}

async function fetchAppraisal(keyword) {
  const res = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `査定に失敗しました（HTTP ${res.status}）`);
  }
  return data;
}

function renderAppraisal(data) {
  const stats = data.stats;

  document.getElementById("market-value").textContent = yen(stats.median);
  document.getElementById("market-note").textContent =
    `${(data.sources || []).join("・")}の${stats.sampleCount}件を参照（外れ値除外後 ${stats.usedCount}件で算出）`;

  document.getElementById("stat-min").textContent = yen(stats.min);
  document.getElementById("stat-median").textContent = yen(stats.median);
  document.getElementById("stat-avg").textContent = yen(stats.average);
  document.getElementById("stat-max").textContent = yen(stats.max);
  document.getElementById("stat-count").textContent = `${stats.sampleCount}件`;

  appraisalEl.hidden = false;
}

function renderListings(data) {
  document.getElementById("sources-label").textContent =
    data.sources?.length ? `参照元：${data.sources.join("・")}` : "";

  listingGrid.innerHTML = "";
  for (const item of data.items) {
    const card = document.createElement("a");
    card.className = "listing-card";
    card.href = item.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    const img = item.image
      ? `<img class="listing-img" src="${escapeAttr(item.image)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'listing-img placeholder\\'>画像なし</div>'">`
      : `<div class="listing-img placeholder">画像なし</div>`;

    card.innerHTML = `
      ${img}
      <div class="listing-body">
        <p class="listing-name">${escapeHtml(item.name)}</p>
        <p class="listing-price">${yen(item.price)}</p>
        <div class="listing-meta">
          <span class="listing-source">${escapeHtml(item.source)}</span>
          <span>${escapeHtml(item.category || "")}</span>
        </div>
      </div>`;
    listingGrid.appendChild(card);
  }

  listingsEl.hidden = false;
}

// ---------------------------------------------------------------- ポートフォリオ

addBtn.addEventListener("click", () => {
  if (!lastResult) return;
  const holdings = loadHoldings();

  holdings.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    keyword: lastResult.keyword,
    brand: lastResult.brand || lastResult.keyword.split(/\s+/)[0],
    median: lastResult.stats.median,
    sources: lastResult.sources || [],
    updatedAt: new Date().toISOString().slice(0, 10),
  });

  saveHoldings(holdings);
  renderPortfolio();
  portfolioEl.scrollIntoView({ behavior: "smooth" });
});

refreshBtn.addEventListener("click", refreshPortfolioPrices);

async function refreshPortfolioPrices() {
  const holdings = loadHoldings();
  if (holdings.length === 0) return;

  refreshBtn.disabled = true;
  refreshBtn.textContent = "更新中…";

  // 参照元への負荷を避けるため1件ずつ順番に取得する
  for (const h of holdings) {
    try {
      const data = await fetchAppraisal(h.keyword);
      if (data.stats) {
        h.median = data.stats.median;
        h.brand = data.brand || h.brand;
        h.sources = data.sources || h.sources;
        h.updatedAt = new Date().toISOString().slice(0, 10);
      }
    } catch {
      // 失敗した銘柄は前回価格のまま据え置く
    }
  }

  saveHoldings(holdings);
  renderPortfolio();
  refreshBtn.disabled = false;
  refreshBtn.textContent = "⟳ 価格を更新";
}

function removeHolding(id) {
  saveHoldings(loadHoldings().filter((h) => h.id !== id));
  renderPortfolio();
}

function renderPortfolio() {
  const holdings = loadHoldings();
  if (holdings.length === 0) {
    portfolioEl.hidden = true;
    return;
  }

  const total = holdings.reduce((s, h) => s + h.median, 0);

  document.getElementById("pf-total").textContent = yen(total);
  document.getElementById("pf-summary").textContent =
    `${holdings.length}点を保有（推定市場価値の合計）`;

  // ブランド別内訳（市場価値の大きい順）
  const byBrand = new Map();
  for (const h of holdings) {
    byBrand.set(h.brand, (byBrand.get(h.brand) || 0) + h.median);
  }
  const brands = [...byBrand.entries()].sort((a, b) => b[1] - a[1]);

  const brandsEl = document.getElementById("pf-brands");
  brandsEl.innerHTML = "";
  for (const [brand, brandValue] of brands) {
    const pct = (brandValue / total) * 100;
    const row = document.createElement("div");
    row.className = "pf-brand-row";
    row.innerHTML = `
      <div class="pf-brand-head">
        <span class="pf-brand-name">${escapeHtml(brand)}</span>
        <span class="pf-brand-value">${yen(brandValue)} <small>(${pct.toFixed(1)}%)</small></span>
      </div>
      <div class="pf-brand-bar"><div class="pf-brand-fill" style="width:${pct.toFixed(1)}%"></div></div>`;
    brandsEl.appendChild(row);
  }

  // 保有一覧
  const rowsEl = document.getElementById("pf-rows");
  rowsEl.innerHTML = "";
  for (const h of holdings) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(h.keyword)}</td>
      <td>${escapeHtml(h.brand)}</td>
      <td class="num strong">${yen(h.median)}</td>
      <td>${escapeHtml((h.sources || []).join("・"))}</td>
      <td>${escapeHtml(h.updatedAt)}</td>
      <td><button type="button" class="btn-remove" aria-label="削除">×</button></td>`;
    tr.querySelector(".btn-remove").addEventListener("click", () => removeHolding(h.id));
    rowsEl.appendChild(tr);
  }

  portfolioEl.hidden = false;
}

function loadHoldings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHoldings(holdings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
}

// ---------------------------------------------------------------- 共通

function showStatus(html, isError = false) {
  statusEl.innerHTML = html;
  statusEl.classList.toggle("error", isError);
  statusEl.hidden = false;
}

function hideStatus() {
  statusEl.hidden = true;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}

// 起動時に保存済みポートフォリオを表示
renderPortfolio();
