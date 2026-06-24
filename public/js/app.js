// 資産価値査定アプリ フロントエンド（機械式時計特化）
// ブランド → モデル → 型番 → 文字盤 の順に絞り込み、価格.com・楽天市場・
// Yahoo!ショッピングの販売価格から市場価値を査定。ポートフォリオで資産管理する。

const STORAGE_KEY = "asset-portfolio.v1";

// ブランド → モデル（時計の系列）の対応表（機械式ブランドを網羅）。
// モデルが空の配列のブランドは、ブランド選択後そのまま型番選択へ進む。
const BRAND_MODELS = {
  "ロレックス": ["サブマリーナ", "デイトナ", "デイトジャスト", "GMTマスターII", "エクスプローラー", "エクスプローラーII", "ヨットマスター", "シードゥエラー", "ランドドゥエラー", "デイデイト", "オイスターパーペチュアル", "エアキング", "スカイドゥエラー", "1908"],
  "パテックフィリップ": ["ノーチラス", "アクアノート", "カラトラバ", "コンプリケーション", "ゴンドーロ"],
  "オーデマピゲ": ["ロイヤルオーク", "ロイヤルオーク オフショア", "ロイヤルオーク コンセプト", "コード11.59"],
  "ヴァシュロン・コンスタンタン": ["オーヴァーシーズ", "パトリモニー", "トラディショナル", "フィフティーシックス", "マルタ", "ヒストリーク"],
  "A.ランゲ&ゾーネ": ["ランゲ1", "サクソニア", "オデュッセウス", "ツァイトヴェルク"],
  "ブレゲ": ["クラシック", "マリーン", "タイプXX", "トラディション", "ヘリテージ"],
  "リシャールミル": [],
  "ジャガールクルト": ["レベルソ", "マスター", "ポラリス", "デュオメトル", "ランデヴー"],
  "ピアジェ": ["アルティプラノ", "ポロ", "ライムライト", "ポセション"],
  "パルミジャーニフルリエ": ["トンダ", "カルパ"],
  "グラスヒュッテオリジナル": ["セネタ", "パノ", "シックスティーズ"],
  "ブランパン": ["フィフティファゾムス", "ヴィルレ"],
  "ロジェデュブイ": ["エクスカリバー"],
  "ユリスナルダン": ["マリーン", "フリーク", "ダイバー"],
  "ジラールペルゴ": ["ロレアート", "1966", "ヴィンテージ1945", "シーホーク"],
  "ジャケドロー": ["グランセコンド", "プティ・ウール"],
  "H.モーザー": [],
  "ハリーウィンストン": ["オーシャン", "ミッドナイト", "アヴェニュー"],
  "ショパール": ["ハッピースポーツ", "ミッレミリア", "L.U.C", "アルパインイーグル"],
  "ショーメ": [],
  "コルム": ["アドミラル", "ブリッジ", "バブル"],
  "オメガ": ["スピードマスター", "シーマスター", "シーマスター アクアテラ", "シーマスター ダイバー300", "コンステレーション", "デ・ヴィル"],
  "IWC": ["ポルトギーゼ", "パイロットウォッチ", "ポートフィノ", "アクアタイマー", "インヂュニア", "ダ・ヴィンチ"],
  "パネライ": ["ルミノール", "ルミノール ドゥエ", "ラジオミール", "サブマーシブル"],
  "ブライトリング": ["ナビタイマー", "クロノマット", "スーパーオーシャン", "アベンジャー", "プレミエ", "トランスオーシャン"],
  "タグホイヤー": ["カレラ", "アクアレーサー", "モナコ", "リンク", "オータヴィア"],
  "ウブロ": ["ビッグバン", "ビッグバン ウニコ", "クラシックフュージョン", "スピリットオブビッグバン", "MP"],
  "ゼニス": ["エルプリメロ", "デファイ", "クロノマスター", "パイロット", "エリート"],
  "カルティエ": ["タンク", "サントス", "パシャ", "バロンブルー", "ロードスター", "カリブル", "ロンド"],
  "チューダー": ["ブラックベイ", "ペラゴス", "レンジャー", "ロイヤル", "1926"],
  "グランドセイコー": ["ヘリテージ", "エレガンス", "スポーツ", "エボリューション9"],
  "スウォッチ": ["ムーンスウォッチ", "ブランパン", "1965", "ロイヤルポップ"],
  "ベル&ロス": ["BR03", "BR05", "BR-X1", "ヴィンテージ"],
  "ノモス": ["タンジェント", "オリオン", "クラブ", "メトロ", "アホイ"],
  "オリス": ["アクイス", "ビッグクラウン", "ダイバーズ65", "アートリエ"],
  "ボーム&メルシエ": ["クリフトン", "クラシマ", "リビエラ", "ハンプトン"],
  "クロノスイス": [],
  "ボールウォッチ": ["エンジニア", "トレインマスター", "ロードマスター"],
  "Sinn": [],
  "ユンハンス": ["マックスビル", "マイスター"],
  "エポス": [],
  "エドックス": [],
  "フレデリックコンスタント": [],
  "ロンジン": ["マスターコレクション", "コンクエスト", "ハイドロコンクエスト", "ヘリテージ", "スピリット"],
  "ハミルトン": ["カーキ フィールド", "カーキ アビエーション", "ベンチュラ", "ジャズマスター", "ブロードウェイ"],
  "ティソ": ["PRX", "ジェントルマン", "ル・ロックル", "シースター"],
  "ミドー": ["オーシャンスター", "バロンチェッリ", "マルチフォート"],
  "ラドー": ["キャプテンクック", "ダイヤスター", "トゥルー"],
  "モーリス・ラクロア": ["アイコン", "マスターピース", "エリロス", "ポントス"],
  "フランクミュラー": ["トノウカーベックス", "ヴァンガード", "カサブランカ", "ロングアイランド", "コンキスタドール"],
  "セイコー": ["プレザージュ", "プロスペックス", "キングセイコー"],
  "シチズン": ["ザ・シチズン", "シリーズ8", "メカニカル"],
  "オリエント": ["バンビーノ", "オリエントスター", "キングマスター"],
};

// ブランド品（ジュエリー・バッグ等）：ブランド → カテゴリ。
// q は検索キーワード（表示名と異なる場合のみ指定）。
const JEWELRY_BRANDS = {
  "クロムハーツ": {
    categories: ["リング", "ネックレス", "ペンダント", "ブレスレット", "サングラス"],
    models: {
      "リング": ["スペーサー", "ダガー", "スクロール", "プレーン", "フローラル", "オーバルクロス", "セメタリー", "キーパー", "K&T", "CHプラス"],
      "ネックレス": ["ベイビーファット", "タイニー", "CHプラス", "ダガー", "ドッグタグ", "クロスボール", "ペーパーチェーン", "フレア"],
      "ペンダント": ["ベイビーファット", "タイニー", "CHプラス", "ダガー", "ドッグタグ", "クロスボール"],
      "ブレスレット": ["クラシックリンク", "ファンシーチェーン", "IDブレス", "ペーパーチェーン", "クロスボール", "フレア", "SBT"],
    }
  },
  "エルメス": {
    categories: ["バッグ", "財布", "ブレスレット"],
    models: {
      "バッグ": ["バーキン", "ケリー", "ボリード", "ピコタン", "ガーデンパーティ", "エブリン", "リンディ", "コンスタンス"],
      "ブレスレット": ["シェーヌダンクル", "クリッククラック", "コリエドシアン", "ケリーブレス"],
    }
  },
  "ヴァンクリーフ&アーペル": {
    q: "ヴァンクリーフ",
    categories: ["ネックレス", "ブレスレット", "リング", "ピアス"],
    models: {
      "ネックレス": ["ヴィンテージアルハンブラ", "スウィートアルハンブラ", "マジックアルハンブラ", "アルハンブラ", "フリヴォル"],
      "ブレスレット": ["ヴィンテージアルハンブラ", "スウィートアルハンブラ", "アルハンブラ", "ペルレ"],
      "リング": ["ヴィンテージアルハンブラ", "アルハンブラ", "ペルレ", "フリヴォル"],
      "ピアス": ["ヴィンテージアルハンブラ", "スウィートアルハンブラ", "フリヴォル"],
    }
  },
  "カルティエ": {
    categories: ["リング", "ネックレス", "ブレスレット"],
    models: {
      "リング": ["ラブ", "トリニティ", "ジュストアンクル", "バレリーナ", "クラッシュドゥカルティエ"],
      "ネックレス": ["ラブ", "トリニティ", "ジュストアンクル", "パンテール"],
      "ブレスレット": ["ラブ", "トリニティ", "ジュストアンクル", "パンテール"],
    }
  },
  "ティファニー": {
    categories: ["ネックレス", "リング", "ブレスレット"],
    models: {
      "ネックレス": ["バイザヤード", "ハードウェア", "Tスマイル", "オープンハート", "リターントゥ"],
      "リング": ["バイザヤード", "Tワン", "アトラス", "ソレスト"],
      "ブレスレット": ["ハードウェア", "Tワン", "リターントゥ"],
    }
  },
  "ハリーウィンストン": {
    categories: ["リング", "ネックレス", "ブレスレット"],
    models: {
      "リング": ["リリークラスター", "HWロゴ"],
      "ネックレス": ["リリークラスター", "ループ", "サンフラワー", "HWロゴ"],
    }
  },
  "シャネル": {
    categories: ["バッグ", "ネックレス", "ピアス"],
    models: {
      "バッグ": ["マトラッセ", "ボーイシャネル", "2.55", "ココハンドル", "ヴァニティ", "ドーヴィル", "ガブリエル"],
      "ネックレス": ["ココクラッシュ", "カメリア"],
    }
  },
  "ルイヴィトン": {
    categories: ["バッグ", "ウォレット", "ネックレス"],
    models: {
      "バッグ": ["スピーディ", "ネヴァーフル", "アルマ", "キーポル", "カプシーヌ", "オンザゴー"],
      "ウォレット": ["ポルトフォイユ"],
    }
  },
};

// TOPページ背景の注目モデル（写真付き）
// 左：クロムハーツ（ロゴ＝CHクロス）／中央：白デイトナ／右：バーキン（エトゥープ一色）
// extra を指定すると出品名の解析でモデル・色を厳密に絞る（他色の混入を防ぐ）
const FEATURED = [
  { query: "クロムハーツ クロス ペンダント", color: "", exclude: [] },
  { query: "ロレックス デイトナ 126500LN", color: "ホワイト", exclude: [] },
  { query: "エルメス バッグ", color: "", exclude: [], extra: { model: "バーキン", jcolor: "エトゥープ" } },
];

// ブランド名のゆれ（ROLEX / ロレックス 等）を日本語名に統一する別名表
const BRAND_ALIASES = {
  ROLEX: "ロレックス", OMEGA: "オメガ", "TAG HEUER": "タグホイヤー", TAGHEUER: "タグホイヤー",
  IWC: "IWC", PANERAI: "パネライ", "OFFICINE PANERAI": "パネライ", BREITLING: "ブライトリング",
  CARTIER: "カルティエ", TUDOR: "チューダー", "PATEK PHILIPPE": "パテックフィリップ", PATEKPHILIPPE: "パテックフィリップ",
  "AUDEMARS PIGUET": "オーデマピゲ", AUDEMARSPIGUET: "オーデマピゲ", "VACHERON CONSTANTIN": "ヴァシュロン・コンスタンタン",
  "A. LANGE & SOHNE": "A.ランゲ&ゾーネ", "LANGE & SOHNE": "A.ランゲ&ゾーネ", BREGUET: "ブレゲ",
  "RICHARD MILLE": "リシャールミル", "JAEGER-LECOULTRE": "ジャガールクルト", JAEGERLECOULTRE: "ジャガールクルト",
  PIAGET: "ピアジェ", "PARMIGIANI FLEURIER": "パルミジャーニフルリエ", "GLASHUTTE ORIGINAL": "グラスヒュッテオリジナル",
  BLANCPAIN: "ブランパン", "ROGER DUBUIS": "ロジェデュブイ", "ULYSSE NARDIN": "ユリスナルダン",
  "GIRARD-PERREGAUX": "ジラールペルゴ", "JAQUET DROZ": "ジャケドロー", "H. MOSER": "H.モーザー", "H. MOSER & CIE": "H.モーザー",
  "HARRY WINSTON": "ハリーウィンストン", CHOPARD: "ショパール", CHAUMET: "ショーメ", CORUM: "コルム",
  HUBLOT: "ウブロ", ZENITH: "ゼニス", "FRANCK MULLER": "フランクミュラー", "BAUME & MERCIER": "ボーム&メルシエ",
  CHRONOSWISS: "クロノスイス", BALL: "ボールウォッチ", SINN: "Sinn", JUNGHANS: "ユンハンス", EPOS: "エポス",
  EDOX: "エドックス", "FREDERIQUE CONSTANT": "フレデリックコンスタント", LONGINES: "ロンジン", HAMILTON: "ハミルトン",
  TISSOT: "ティソ", MIDO: "ミドー", RADO: "ラドー", "MAURICE LACROIX": "モーリス・ラクロア",
  ORIS: "オリス", NOMOS: "ノモス", "BELL & ROSS": "ベル&ロス", "GRAND SEIKO": "グランドセイコー",
  GRANDSEIKO: "グランドセイコー", SEIKO: "セイコー", CITIZEN: "シチズン", ORIENT: "オリエント",
  SWATCH: "スウォッチ",
};

// モデル名 → ブランド名（デイトナ等がブランド扱いされないように親へ寄せる）
const MODEL_TO_BRAND = {};
for (const [brand, models] of Object.entries(BRAND_MODELS)) {
  for (const model of models) MODEL_TO_BRAND[model.toLowerCase()] = brand;
}

function resolveBrand(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (MODEL_TO_BRAND[s.toLowerCase()]) return MODEL_TO_BRAND[s.toLowerCase()];
  return BRAND_ALIASES[s.toUpperCase()] || s;
}

const statusEl = document.getElementById("status");
const appraisalEl = document.getElementById("appraisal");
const listingsEl = document.getElementById("listings");
const listingGrid = document.getElementById("listing-grid");
const portfolioEl = document.getElementById("portfolio");
const addBtn = document.getElementById("add-portfolio-btn");
const refreshBtn = document.getElementById("refresh-portfolio-btn");
const brandSelect = document.getElementById("brand-select");
const modelLineSelect = document.getElementById("model-line-select");
const modelSelect = document.getElementById("model-select"); // ③ 型番
const colorSelect = document.getElementById("color-select"); // ④ 文字盤
const jbrandSelect = document.getElementById("jbrand-select"); // ブランド品①
const jcatSelect = document.getElementById("jcat-select"); // ブランド品②
const jmodelField = document.getElementById("jmodel-field");
const jmodelSelect = document.getElementById("jmodel-select"); // ブランド品③
const jsizeField = document.getElementById("jsize-field");
const jsizeSelect = document.getElementById("jsize-select"); // ブランド品④
const jcolorField = document.getElementById("jcolor-field");
const jcolorSelect = document.getElementById("jcolor-select"); // ブランド品⑤
const jstampField = document.getElementById("jstamp-field");
const jstampSelect = document.getElementById("jstamp-select"); // ブランド品⑥
const heroBgCells = document.querySelectorAll(".hero-bg-cell");
const photoInput = document.getElementById("photo-input");
const ringoEl = document.getElementById("ringo");
const ringoRows = document.getElementById("ringo-rows");
const ringoSource = document.getElementById("ringo-source");
const nostockEl = document.getElementById("nostock");
const nostockTarget = document.getElementById("nostock-target");
const nostockPrice = document.getElementById("nostock-price");
const nostockAddBtn = document.getElementById("nostock-add");

let lastResult = null;
let selectedBrand = ""; // ①で選択中のブランド（ポートフォリオのブランド確定に使う）
let currentQueryId = 0;
let photoTargetId = null; // 写真アップロード対象のポートフォリオID

// 段階選択の現在の状態
const g = { base: "", model: "", ref: "", color: "", exclude: [] };

// 選択モデルの下位バリエーション（オフショア等）を除外語として求める。
// 例: ブランド=オーデマピゲ, モデル=ロイヤルオーク
//   → 「ロイヤルオーク オフショア」「ロイヤルオーク コンセプト」の差分
//     「オフショア」「コンセプト」を除外語として返す。
function computeExcludes(brand, model) {
  if (!brand || !model) return [];
  const models = BRAND_MODELS[brand] || [];
  const ex = [];
  for (const s of models) {
    if (s !== model && s.startsWith(model)) {
      const suffix = s.slice(model.length).trim();
      if (suffix) ex.push(suffix);
    }
  }
  return ex;
}

const yen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");

// ---------------------------------------------------------------- 段階選択

for (const brand of Object.keys(BRAND_MODELS)) {
  const opt = document.createElement("option");
  opt.value = brand;
  opt.textContent = brand;
  brandSelect.appendChild(opt);
}

brandSelect.addEventListener("change", () => {
  const brand = brandSelect.value;
  resetJewelry(); // 時計を選んだらブランド品側はリセット
  resetCar();
  resetMetal();
  selectedBrand = brand;
  g.base = brand;
  g.model = "";
  g.ref = "";
  g.color = "";
  g.exclude = [];
  populateModelLines(brand);
  resetRefSelect();
  resetColorSelect();
  clearResults();
  // ブランドだけでは金額を出さない。モデルが定義されていないブランドのみ、
  // モデル段階が無いのでブランド単位で査定する。
  const hasModels = (BRAND_MODELS[brand] || []).length > 0;
  if (brand && !hasModels) search({ rebuildRef: true, rebuildColor: true });
});

// ---------------------------------------------------------------- ブランド品（ジュエリー等）

for (const brand of Object.keys(JEWELRY_BRANDS)) {
  const opt = document.createElement("option");
  opt.value = brand;
  opt.textContent = brand;
  jbrandSelect.appendChild(opt);
}

// ブランド品の選択状態
const jg = { brand: "", cat: "", model: "", size: "", stamp: "", color: "" };

// モール検索は「ブランド＋カテゴリ」の広いキーワードで行う。
// モデル・サイズ等はサーバー側で出品名を解析して絞り込む（再検索しないので
// ドロップダウンの件数と結果が必ず一致する）。
function jewelryQuery() {
  const def = JEWELRY_BRANDS[jg.brand] || {};
  return (def.q || jg.brand) + " " + jg.cat;
}

// ブランド品の査定を実行。rebuildModels はカテゴリ変更時（モデル候補を学習し直す）、
// rebuildOpts はモデル変更時（サイズ・色・刻印の選択肢を作り直す）に立てる。
function jewelrySearch({ rebuildModels = false, rebuildOpts = false } = {}) {
  selectedBrand = jg.brand;
  g.base = "";
  g.model = "";
  g.ref = "";
  g.color = "";
  g.exclude = [];
  resetRefSelect();
  resetColorSelect();
  const label = [jg.brand, jg.cat, jg.model, jg.size, jg.color, jg.stamp ? jg.stamp + "刻印" : ""]
    .filter(Boolean)
    .join(" ");
  runAppraisal(jewelryQuery(), {
    label,
    extra: { model: jg.model, size: jg.size, stamp: jg.stamp, jcolor: jg.color },
    onData: (data) => {
      if (rebuildModels) renderJModelSelect(data);
      if (rebuildOpts) renderJOptionSelects(data);
    },
  });
}

// モデル候補：API が実際の出品から学習した一覧（件数付き）を主とし、
// 定義済みリストにしか無いモデルは後ろに足す。
function renderJModelSelect(data) {
  // 件数は「カテゴリ検索のサンプル中の出現数」で、モデル選択後の取得件数とは
  // 一致しない（選択後はそのモデルで深く取り直すため多くなる）。
  // 紛らわしいので表示せず、並び順（人気順）にだけ使う。
  const learned = data && data.jmodels ? data.jmodels : [];
  const statics = (JEWELRY_BRANDS[jg.brand].models || {})[jg.cat] || [];
  const seen = new Set(learned.map((m) => m.model));
  const options = [
    ...learned.map((m) => ({ value: m.model, label: m.model })),
    ...statics.filter((m) => !seen.has(m)).map((m) => ({ value: m, label: m })),
  ];

  if (options.length === 0) {
    jmodelSelect.innerHTML = '<option value="">—</option>';
    jmodelField.hidden = true;
    jmodelSelect.disabled = true;
    return;
  }
  jmodelField.hidden = false;
  jmodelSelect.innerHTML = '<option value="">モデルを選択（任意）</option>';
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    jmodelSelect.appendChild(opt);
  }
  jmodelSelect.disabled = false;
  jmodelSelect.value = "";
}

// サイズ・色・刻印の選択肢（バーキン等。無い項目は欄ごと隠す）。
// 件数は「他の条件で絞った後」の数字なので、選択のたびに呼んで更新する。
// 現在の選択は保持し、組み合わせで0件になった場合も「(0件)」として残す
// （選び直せるように消さない）。
function renderJOptionSelects(data) {
  fillJSelect(jsizeField, jsizeSelect, (data && data.sizes) || [], (s) => [s.size, s.size], "サイズを選択（任意）", jg.size);
  fillJSelect(jcolorField, jcolorSelect, (data && data.jcolors) || [], (c) => [c.color, c.color], "色を選択（任意）", jg.color);
  fillJSelect(jstampField, jstampSelect, (data && data.stamps) || [], (st) => [st.stamp, `${st.stamp}刻印${st.year ? "（" + st.year + "年）" : ""}`], "刻印を選択（任意）", jg.stamp);
}

function fillJSelect(field, select, list, toOption, placeholder, selected = "") {
  if (list.length === 0 && !selected) {
    field.hidden = true;
    select.disabled = true;
    select.innerHTML = '<option value="">—</option>';
    return;
  }
  field.hidden = false;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  let hasSelected = false;
  for (const item of list) {
    const [value, label] = toOption(item);
    if (value === selected) hasSelected = true;
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }
  if (selected && !hasSelected) {
    const opt = document.createElement("option");
    opt.value = selected;
    opt.textContent = `${selected}（出品なし）`;
    select.appendChild(opt);
  }
  select.disabled = false;
  select.value = selected || "";
}

function hideJOptionFields() {
  for (const [f, s] of [[jsizeField, jsizeSelect], [jcolorField, jcolorSelect], [jstampField, jstampSelect]]) {
    f.hidden = true;
    s.disabled = true;
    s.innerHTML = '<option value="">—</option>';
  }
}

jbrandSelect.addEventListener("change", () => {
  const brand = jbrandSelect.value;
  resetWatch(); // ブランド品を選んだら時計側はリセット
  resetCar();
  resetMetal();
  jg.brand = brand;
  jg.cat = jg.model = jg.size = jg.stamp = jg.color = "";
  jcatSelect.innerHTML = "";
  const head = document.createElement("option");
  head.value = "";
  head.textContent = brand ? "カテゴリを選択" : "—";
  jcatSelect.appendChild(head);
  const cats = brand ? JEWELRY_BRANDS[brand].categories : [];
  for (const c of cats) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    jcatSelect.appendChild(opt);
  }
  jcatSelect.disabled = cats.length === 0;
  // 前のブランドのモデル候補が残らないよう中身ごとクリアする
  jmodelSelect.innerHTML = '<option value="">—</option>';
  jmodelSelect.disabled = true;
  jmodelField.hidden = true;
  hideJOptionFields();
  clearResults();
});

jcatSelect.addEventListener("change", () => {
  jg.cat = jcatSelect.value;
  jg.model = jg.size = jg.stamp = jg.color = "";
  jmodelSelect.innerHTML = '<option value="">—</option>';
  jmodelSelect.disabled = true;
  jmodelField.hidden = true;
  hideJOptionFields();
  clearResults();
  if (!jg.brand || !jg.cat) return;
  // カテゴリ全体で査定しつつ、出品からモデル候補を学習して③に出す
  jewelrySearch({ rebuildModels: true });
});

jmodelSelect.addEventListener("change", () => {
  jg.model = jmodelSelect.value;
  jg.size = jg.stamp = jg.color = "";
  hideJOptionFields();
  clearResults();
  if (!jg.model) {
    // モデル解除＝カテゴリ全体に戻す
    jewelrySearch({});
    return;
  }
  jewelrySearch({ rebuildOpts: true });
});

// サイズ・色・刻印を変えるたびに他の選択肢の件数も更新する
// （例：25cmを選ぶと、色一覧が「25cmの中での件数」に変わる）
jsizeSelect.addEventListener("change", () => {
  jg.size = jsizeSelect.value;
  jewelrySearch({ rebuildOpts: true });
});

jcolorSelect.addEventListener("change", () => {
  jg.color = jcolorSelect.value;
  jewelrySearch({ rebuildOpts: true });
});

jstampSelect.addEventListener("change", () => {
  jg.stamp = jstampSelect.value;
  jewelrySearch({ rebuildOpts: true });
});

// ---------------------------------------------------------------- 車

// メーカー → 車種。検索は「メーカー 車種 中古車」で行う
// （Yahoo!ショッピングの中古車販売店の出品から実勢価格を取る）。
const CAR_BRANDS = {
  "トヨタ": ["ランドクルーザー300", "ランドクルーザー250", "ランドクルーザープラド", "アルファード", "ヴェルファイア", "スープラ", "GRヤリス", "クラウン", "ハリアー"],
  "レクサス": ["LX", "RX", "NX", "LM", "IS", "LC"],
  "日産": ["GT-R", "フェアレディZ", "スカイライン", "エルグランド"],
  "ホンダ": ["シビック タイプR", "NSX", "ヴェゼル", "ステップワゴン"],
  "スズキ": ["ジムニー", "ジムニーシエラ"],
  "ポルシェ": ["911", "カイエン", "マカン", "パナメーラ", "ケイマン", "ボクスター", "タイカン"],
  "フェラーリ": ["488", "458", "F8", "ローマ", "ポルトフィーノ", "296"],
  "ランボルギーニ": ["ウルス", "ウラカン", "アヴェンタドール"],
  "ベンツ": ["Gクラス", "Sクラス", "Eクラス", "Cクラス", "GLE", "AMG GT"],
  "BMW": ["M3", "M4", "X5", "X7", "3シリーズ", "5シリーズ"],
  "アウディ": ["RS6", "R8", "Q7", "A6"],
  "ベントレー": ["コンチネンタルGT", "ベンテイガ", "フライングスパー"],
  "ロールスロイス": ["カリナン", "ゴースト", "ファントム"],
  "マクラーレン": ["720S", "アルトゥーラ"],
  "アストンマーティン": ["DB11", "ヴァンテージ", "DBX"],
  "マセラティ": ["レヴァンテ", "ギブリ", "グレカーレ"],
  "ランドローバー": ["レンジローバー", "レンジローバースポーツ", "ディフェンダー"],
  "ジープ": ["ラングラー", "グランドチェロキー"],
};

const cbrandSelect = document.getElementById("cbrand-select");
const cmodelSelect = document.getElementById("cmodel-select");

for (const maker of Object.keys(CAR_BRANDS)) {
  const opt = document.createElement("option");
  opt.value = maker;
  opt.textContent = maker;
  cbrandSelect.appendChild(opt);
}

cbrandSelect.addEventListener("change", () => {
  const maker = cbrandSelect.value;
  resetWatch();
  resetJewelry();
  resetMetal();
  cmodelSelect.innerHTML = "";
  const head = document.createElement("option");
  head.value = "";
  head.textContent = maker ? "車種を選択" : "—";
  cmodelSelect.appendChild(head);
  for (const m of maker ? CAR_BRANDS[maker] : []) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    cmodelSelect.appendChild(opt);
  }
  cmodelSelect.disabled = !maker;
  clearResults();
});

cmodelSelect.addEventListener("change", () => {
  const maker = cbrandSelect.value;
  const model = cmodelSelect.value;
  clearResults();
  if (!maker || !model) return;
  selectedBrand = maker;
  g.base = "";
  g.model = "";
  g.ref = "";
  g.color = "";
  g.exclude = [];
  resetRefSelect();
  resetColorSelect();
  // 車はカーセンサーのみを参照する（/api/cars）
  runAppraisal(`${maker} ${model}`, { car: { maker, model } });
});

// 車カスケードをリセット
function resetCar() {
  cbrandSelect.value = "";
  cmodelSelect.innerHTML = '<option value="">—</option>';
  cmodelSelect.disabled = true;
}

// ---------------------------------------------------------------- 金・プラチナ・銀（実物資産）

const metalSelect = document.getElementById("metal-select");
const weightField = document.getElementById("weight-field");
const weightInput = document.getElementById("weight-input");

let metalRatesCache = null; // 相場の取得結果（同一セッション内で再利用）

async function fetchMetalRates() {
  if (metalRatesCache) return metalRatesCache;
  const res = await fetch("/api/metals", { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.metals) throw new Error(data.error || "貴金属相場の取得に失敗しました。");
  metalRatesCache = data.metals;
  metalRatesCache._source = data.source;
  metalRatesCache._date = data.updatedAt;
  return metalRatesCache;
}

metalSelect.addEventListener("change", () => {
  const metal = metalSelect.value;
  resetWatch();
  resetJewelry();
  resetCar();
  clearResults();
  if (!metal) {
    weightField.hidden = true;
    return;
  }
  weightField.hidden = false;
  weightInput.value = "";
});

weightInput.addEventListener("input", metalAppraise);

async function metalAppraise() {
  const metal = metalSelect.value;
  const grams = Number(weightInput.value);
  if (!metal || !grams || grams <= 0) {
    clearResults();
    return;
  }
  showStatus(`<span class="spinner"></span>${metal}の本日相場を取得しています…`);
  try {
    const rates = await fetchMetalRates();
    const r = rates[metal];
    if (!r) throw new Error("相場が取得できませんでした。");
    hideStatus();
    const value = Math.round(r.purchase * grams);
    // 既存の査定UI・追加ボタンを流用するため lastResult を組み立てる
    lastResult = {
      keyword: `${metal} ${grams}g`,
      brand: metal,
      color: "",
      stats: { median: value, min: value, average: value, max: value, sampleCount: 1, usedCount: 1 },
      sources: [rates._source || "田中貴金属"],
      items: [],
      metal: { metal, grams },
    };
    selectedBrand = metal;
    renderMetalAppraisal(metal, r, grams, value, rates._date);
  } catch (err) {
    showStatus(escapeHtml(err.message), true);
  }
}

function renderMetalAppraisal(metal, r, grams, value, date) {
  appraisalEl.hidden = false;
  listingsEl.hidden = true;
  nostockEl.hidden = true;
  document.getElementById("news").hidden = true; // 貴金属はニュース対象外
  document.getElementById("market-value").textContent = yen(value);
  document.getElementById("market-note").textContent =
    `${metal} 買取相場 ${yen(r.purchase)}/g × ${grams}g（田中貴金属 ${date || ""} 時点）`;
  // 統計バーは貴金属向けに転用（買取/小売の単価などを表示）
  setStat("stat-min", `${yen(r.purchase)}/g`, "買取単価");
  setStat("stat-median", yen(value), "評価額");
  setStat("stat-avg", r.retail ? `${yen(r.retail)}/g` : "—", "小売単価");
  setStat("stat-max", `${grams}g`, "重量");
  setStat("stat-count", metal, "種類");
}

// 統計バーの1項目を書き換える（ラベルも差し替える）
function setStat(valueId, valueText, labelText) {
  const valueEl = document.getElementById(valueId);
  valueEl.textContent = valueText;
  const labelEl = valueEl.parentElement.querySelector(".stat-label");
  if (labelEl) labelEl.textContent = labelText;
}

// 貴金属カスケードをリセット
function resetMetal() {
  metalSelect.value = "";
  weightField.hidden = true;
  weightInput.value = "";
}

// ---------------------------------------------------------------- キーワード直接検索

const keywordInput = document.getElementById("keyword-input");
const keywordBtn = document.getElementById("keyword-btn");

// ブランド品のモデル名 → ブランド（キーワード検索のブランド自動補完用）
const JMODEL_TO_BRAND = {};
for (const [brand, def] of Object.entries(JEWELRY_BRANDS)) {
  for (const models of Object.values(def.models || {})) {
    for (const m of models) JMODEL_TO_BRAND[m] = def.q || brand;
  }
}

function keywordSearch() {
  let kw = keywordInput.value.trim();
  if (!kw) return;

  // モデル名だけで検索されたらブランド名を自動で補う。
  // 「デイトナ」単体だとバイク用品のDAYTONA等が混ざるため
  // （デイトナ→ロレックス デイトナ、バーキン→エルメス バーキン）。
  const first = kw.split(/[\s　]+/)[0];
  const watchBrand = MODEL_TO_BRAND[first.toLowerCase()];
  const jewelryBrand = JMODEL_TO_BRAND[first];
  const autoBrand = watchBrand || jewelryBrand;
  if (autoBrand && !kw.includes(autoBrand)) kw = autoBrand + " " + kw;

  // 各カスケードをリセットして自由入力で査定する
  resetWatch();
  resetJewelry();
  resetCar();
  resetMetal();
  selectedBrand = resolveBrand(kw.split(/[\s　]+/)[0]);
  g.base = kw;
  g.model = "";
  g.ref = "";
  g.color = "";
  g.exclude = [];
  // 型番・文字盤の絞り込みも使えるようにする（時計以外では型番が出ないだけ）
  runAppraisal(kw, { rebuildRef: true, rebuildColor: true });
}

keywordBtn.addEventListener("click", keywordSearch);
keywordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") keywordSearch();
});

// 時計カスケードをリセット
function resetWatch() {
  brandSelect.value = "";
  populateModelLines("");
  resetRefSelect();
  resetColorSelect();
}

// ブランド品カスケードをリセット
function resetJewelry() {
  jg.brand = jg.cat = jg.model = jg.size = jg.stamp = jg.color = "";
  jbrandSelect.value = "";
  jcatSelect.innerHTML = '<option value="">—</option>';
  jcatSelect.disabled = true;
  jmodelSelect.innerHTML = '<option value="">—</option>';
  jmodelSelect.disabled = true;
  jmodelField.hidden = true;
  hideJOptionFields();
}

modelLineSelect.addEventListener("change", () => {
  g.model = modelLineSelect.value;
  g.ref = "";
  g.color = "";
  g.exclude = computeExcludes(selectedBrand, g.model);
  resetRefSelect();
  resetColorSelect();
  if (!g.model) {
    // 「モデルを選択」に戻したら金額は出さない
    clearResults();
    return;
  }
  search({ rebuildRef: true, rebuildColor: true });
});

// 査定結果・一覧を消す
function clearResults() {
  lastResult = null;
  appraisalEl.hidden = true;
  listingsEl.hidden = true;
  document.getElementById("news").hidden = true;
  hideStatus();
}

// 選択中のブランド／車種の新着ニュース（新型・新作・発表）を読み込む。
// 貴金属は対象外。検索が切り替わったら破棄する（queryId判定）。
async function loadNews(query, queryId) {
  const newsEl = document.getElementById("news");
  newsEl.hidden = true;
  if (!query) return;
  try {
    const res = await fetch(`/api/news?q=${encodeURIComponent(query)}`, { cache: "no-store" });
    const data = await res.json();
    if (queryId !== currentQueryId) return; // 検索し直された
    const list = document.getElementById("news-list");
    const items = (data && data.items) || [];
    if (items.length === 0) return;
    document.getElementById("news-sub").textContent = `${query}（Google ニュース）`;
    list.innerHTML = "";
    for (const a of items) {
      const el = document.createElement("a");
      el.className = "news-item";
      el.href = a.url;
      el.target = "_blank";
      el.rel = "noopener noreferrer";
      el.innerHTML = `
        <span class="news-date">${escapeHtml(a.date || "")}</span>
        <span class="news-body">
          <span class="news-title">${escapeHtml(a.title)}</span>
          <span class="news-source">${escapeHtml(a.source || "")}</span>
        </span>`;
      list.appendChild(el);
    }
    newsEl.hidden = false;
  } catch {
    // ニュース取得失敗は査定本体に影響させない
  }
}

modelSelect.addEventListener("change", () => {
  g.ref = modelSelect.value;
  g.color = "";
  resetColorSelect();
  search({ rebuildColor: true });
});

colorSelect.addEventListener("change", () => {
  g.color = colorSelect.value;
  search({});
});

function populateModelLines(brand) {
  modelLineSelect.innerHTML = "";
  const head = document.createElement("option");
  head.value = "";
  head.textContent = brand ? "モデルを選択" : "—";
  modelLineSelect.appendChild(head);
  const models = BRAND_MODELS[brand] || [];
  for (const model of models) {
    const opt = document.createElement("option");
    opt.value = model;
    opt.textContent = model;
    modelLineSelect.appendChild(opt);
  }
  modelLineSelect.disabled = models.length === 0;
}

function resetRefSelect() {
  modelSelect.innerHTML = '<option value="">—</option>';
  modelSelect.disabled = true;
}

function resetColorSelect() {
  colorSelect.innerHTML = '<option value="">—</option>';
  colorSelect.disabled = true;
}

// 段階選択の状態から検索キーワードを組み立てて査定する
function search({ rebuildRef = false, rebuildColor = false } = {}) {
  const keyword = [g.base, g.model, g.ref].filter(Boolean).join(" ");
  runAppraisal(keyword, { color: g.color, exclude: g.exclude, rebuildRef, rebuildColor });
}

// ---------------------------------------------------------------- 査定

async function runAppraisal(keyword, { color = "", exclude = [], rebuildRef = false, rebuildColor = false, extra = null, onData = null, label = "", car = null } = {}) {
  if (!keyword) return;

  const display = label || keyword;
  const queryId = ++currentQueryId;
  lastResult = null;
  appraisalEl.hidden = true;
  listingsEl.hidden = true;
  nostockEl.hidden = true;
  const what = car ? "中古車相場" : "販売価格";
  showStatus(`<span class="spinner"></span>「${escapeHtml(display)}${color ? " / " + color : ""}」の${what}を調査しています…`);

  try {
    const data = car ? await fetchCars(car.maker, car.model) : await fetchAppraisal(keyword, color, exclude, extra);
    if (queryId !== currentQueryId) return;

    if (!data.stats || data.count === 0) {
      // 出品ゼロ：手入力でポートフォリオに登録できるパネルを出す。
      // 選択肢の件数は0件時も更新する（組み合わせを選び直せるように）
      hideStatus();
      showNoStock(display, color);
      if (rebuildRef) resetRefSelect();
      if (rebuildColor) resetColorSelect();
      if (onData) onData(data);
      return;
    }

    hideStatus();
    lastResult = data;
    lastResult.color = color;
    lastResult.car = car; // 車は時価更新もカーセンサーで再取得する
    lastResult.keyword = display; // 結果ヘッダーには選択中の条件を表示
    if (rebuildRef) renderRefSelect(data);
    if (rebuildColor) renderColorSelect(data);
    if (onData) onData(data);
    renderAppraisal(data);
    renderListings(data);
    // 選択中のブランド／車種の新着ニュースを併せて表示（貴金属は対象外）
    const newsQuery = car
      ? `${car.maker} ${car.model}`
      : selectedBrand || resolveBrand(display.split(/[\s　]+/)[0]) || display.split(/[\s　]+/)[0];
    loadNews(newsQuery, queryId);
  } catch (err) {
    if (queryId === currentQueryId) showStatus(escapeHtml(err.message), true);
  }
}

async function fetchAppraisal(keyword, color = "", exclude = [], extra = null) {
  let q = `q=${encodeURIComponent(keyword)}`;
  if (color) q += `&color=${encodeURIComponent(color)}`;
  if (exclude.length > 0) q += `&exclude=${encodeURIComponent(exclude.join(","))}`;
  if (extra) {
    if (extra.model) q += `&model=${encodeURIComponent(extra.model)}`;
    if (extra.size) q += `&size=${encodeURIComponent(extra.size)}`;
    if (extra.stamp) q += `&stamp=${encodeURIComponent(extra.stamp)}`;
    if (extra.jcolor) q += `&jcolor=${encodeURIComponent(extra.jcolor)}`;
    if (extra.mall) q += `&mall=${encodeURIComponent(extra.mall)}`;
  }
  // キャッシュを使わず常に最新の並び順・在庫を取得する
  const res = await fetch(`/api/search?${q}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `査定に失敗しました（HTTP ${res.status}）`);
  }
  return data;
}

// 中古車相場（カーセンサーのみ）
async function fetchCars(maker, model) {
  const q = `maker=${encodeURIComponent(maker)}&model=${encodeURIComponent(model)}`;
  const res = await fetch(`/api/cars?${q}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `中古車相場の取得に失敗しました（HTTP ${res.status}）`);
  }
  return data;
}

// ③ 型番ドロップダウン（現行モデルから順）。
// 型番が抽出できない検索（ブランド品等）では欄を無効のままにする。
function renderRefSelect(data) {
  const models = data.models || [];
  if (models.length === 0) {
    resetRefSelect();
    return;
  }
  modelSelect.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "すべての型番";
  modelSelect.appendChild(allOpt);
  for (const m of models) {
    const opt = document.createElement("option");
    opt.value = m.ref;
    opt.textContent = m.ref;
    modelSelect.appendChild(opt);
  }
  modelSelect.value = "";
  modelSelect.disabled = false;
}

// よくある文字盤色（サンプルに無くても選べるよう「他の色で探す」に出す）
const STANDARD_COLORS = ["ブラック", "ホワイト", "シルバー", "シャンパン", "サンダスト", "ブラックサンダスト", "ブルー", "グレー", "スレート", "スレートローマ", "グリーン", "オリーブ", "ブラウン", "ピンク", "メテオライト", "シェル"];

// ④ 文字盤ドロップダウン。
// 出品のある色（件数付き）を上に、その他のよくある色を「他の色で探す」に並べる。
// 色を選ぶとモール検索語にも色を付けて取得し直すので、サンプルに無い色も探せる
// （その色の出品が無ければ「見つかりません」と表示）。
function renderColorSelect(data) {
  const colors = data.colors || [];
  const detected = new Set(colors.map((c) => c.color));

  colorSelect.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "すべての文字盤";
  colorSelect.appendChild(allOpt);

  for (const c of colors) {
    const opt = document.createElement("option");
    opt.value = c.color;
    opt.textContent = c.color;
    colorSelect.appendChild(opt);
  }

  const others = STANDARD_COLORS.filter((c) => !detected.has(c));
  if (others.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "他の色で探す";
    for (const c of others) {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      group.appendChild(opt);
    }
    colorSelect.appendChild(group);
  }

  colorSelect.value = g.color || "";
  colorSelect.disabled = false;
}

function renderAppraisal(data) {
  const stats = data.stats;
  // 貴金属モードで書き換えた統計バーのラベルを通常表記へ戻す
  setStat("stat-min", yen(stats.min), "最安値");
  setStat("stat-median", yen(stats.median), "中央値");
  setStat("stat-avg", yen(stats.average), "平均値");
  setStat("stat-max", yen(stats.max), "最高値");
  setStat("stat-count", `${stats.sampleCount}件`, "参照件数");
  document.getElementById("market-value").textContent = yen(stats.median);
  document.getElementById("market-note").textContent =
    `${(data.sources || []).join("・")}の${stats.sampleCount}件を参照（外れ値除外後 ${stats.usedCount}件で算出）${data.color ? "／文字盤：" + data.color : ""}`;
  appraisalEl.hidden = false;
}

function renderListings(data) {
  document.getElementById("sources-label").textContent =
    `${data.count}件 ／ ${(data.sources || []).join("・")}（価格の高い順）`;
  listingGrid.innerHTML = "";
  for (const item of data.items) {
    const card = document.createElement("a");
    card.className = "listing-card";
    card.href = item.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    const img = item.image
      ? `<img class="listing-img" src="${escapeAttr(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=\\'listing-img placeholder\\'>画像なし</div>'">`
      : `<div class="listing-img placeholder">画像なし</div>`;
    const cond = extractCondition(item.name);
    const acc = extractAccessories(item.name);
    const year = extractYear(item.name);
    const badges = [
      item.dial ? `<span class="badge badge-dial">文字盤：${escapeHtml(item.dial)}</span>` : "",
      cond ? `<span class="badge badge-cond">${escapeHtml(cond)}</span>` : "",
      acc ? `<span class="badge badge-acc">${escapeHtml(acc)}</span>` : "",
      year ? `<span class="badge badge-year">${escapeHtml(year)}</span>` : "",
    ].join("");

    card.innerHTML = `
      ${img}
      <div class="listing-body">
        <p class="listing-name">${escapeHtml(item.name)}</p>
        ${badges ? `<div class="listing-badges">${badges}</div>` : ""}
        <p class="listing-price">${yen(item.price)}</p>
        <div class="listing-meta">
          <span class="listing-source">${escapeHtml(item.source)}${item.seller ? "／" + escapeHtml(item.seller) : ""}</span>
          <span class="listing-more">商品ページ →</span>
        </div>
        <div class="listing-btn-row">
          <button type="button" class="listing-add listing-wish">☆ 欲しい</button>
          <button type="button" class="listing-add">＋ ポートフォリオ</button>
        </div>
      </div>`;
    const itemLabel = () => {
      const label = (lastResult && lastResult.keyword) || data.keyword;
      const color = (lastResult && lastResult.color) || "";
      return label + (color ? `（${color}）` : "");
    };
    const itemBrand = () => {
      const label = (lastResult && lastResult.keyword) || data.keyword;
      return selectedBrand || resolveBrand(data.brand) || resolveBrand(label.split(/\s+/)[0]);
    };
    // この出品の価格・写真でそのままポートフォリオに登録する
    card.querySelector(".listing-add:not(.listing-wish)").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      addHolding({
        keyword: itemLabel(),
        brand: itemBrand(),
        median: item.price,
        sources: [item.source],
        photo: item.image || "",
        scroll: false, // 出品一覧の閲覧を妨げない
        car: (lastResult && lastResult.car) || null,
      });
      e.target.textContent = "✓ 追加済み";
      e.target.disabled = true;
    });
    // この出品の価格・写真で欲しいものリストに登録する
    card.querySelector(".listing-wish").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      addWish({
        keyword: itemLabel(),
        brand: itemBrand(),
        price: item.price,
        photo: item.image || "",
        scroll: false,
        car: (lastResult && lastResult.car) || null,
      });
      e.target.textContent = "✓ 追加済み";
      e.target.disabled = true;
    });
    listingGrid.appendChild(card);
  }
  listingsEl.hidden = false;
}

// 商品名から状態・付属品・製造年を抽出（Chrono24風の一覧表示用）
function extractCondition(name) {
  if (/新品同様|未使用に近い/.test(name)) return "新品同様";
  if (/未使用|新品未使用/.test(name)) return "未使用";
  if (/新品/.test(name)) return "新品";
  if (/美品/.test(name)) return "美品";
  if (/中古/.test(name)) return "中古";
  return "";
}

function extractAccessories(name) {
  if (/フルセット|付属品完品|箱・?保証書|箱保|ギャラ(ンティ)?|保証書/.test(name)) return "箱・保証書";
  if (/箱/.test(name)) return "箱あり";
  return "";
}

function extractYear(name) {
  const m = name.match(/(19|20)\d{2}年/);
  return m ? m[0] : "";
}

// ---------------------------------------------------------------- ロレックス参考買取相場（rolex-ringo）

async function loadRingo(queryId) {
  ringoEl.hidden = true;
  // ロレックスでモデルを選択しているときのみ表示
  if (selectedBrand !== "ロレックス" || !g.model) return;

  try {
    const params = `q=${encodeURIComponent(g.model)}${g.ref ? `&ref=${encodeURIComponent(g.ref)}` : ""}`;
    const res = await fetch(`/api/ringo?${params}`);
    const data = await res.json();
    if (queryId !== currentQueryId) return; // 検索し直された場合は破棄
    if (!res.ok || !data.found || !data.rows.length) return;

    ringoSource.textContent = data.article ? data.article.title : "";
    ringoRows.innerHTML = "";
    for (const r of data.rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(r.label)}</td>
        <td>${escapeHtml(r.ref)}</td>
        <td class="num">${r.retail ? yen(r.retail) : "—"}</td>
        <td class="num strong">${r.unused ? yen(r.unused) : "—"}</td>
        <td class="num">${r.used ? yen(r.used) : "—"}</td>`;
      ringoRows.appendChild(tr);
    }
    ringoEl.hidden = false;
  } catch {
    // 取得失敗時は何も表示しない（実売査定には影響させない）
  }
}

// ---------------------------------------------------------------- 注目3モデルの写真を背景に

function renderHeroBackground() {
  FEATURED.forEach((f, i) => {
    const cell = heroBgCells[i];
    if (!cell) return;
    fetchAppraisal(f.query, f.color, f.exclude, f.extra || null)
      .then((data) => {
        // ホットリンクで表示できるCDN（Yahoo/楽天/価格.com）の画像だけ使う。
        // Amazon等は他サイトからの表示がブロックされるため除外。
        const urls = (data.items || [])
          .map((it) => it.image)
          .filter((u) => u && /yimg\.jp|rakuten\.co\.jp|r10s\.jp|k-img\.com/.test(u))
          .slice(0, 8);
        setCellBackground(cell, urls);
      })
      .catch(() => {});
  });
}

// 候補画像を順に試し、最初に読み込めたものを背景にする
function setCellBackground(cell, urls, idx = 0) {
  if (idx >= urls.length) return;
  const pre = new Image();
  pre.referrerPolicy = "no-referrer";
  pre.onload = () => {
    cell.style.backgroundImage = `url("${urls[idx]}")`;
    cell.classList.add("loaded");
  };
  pre.onerror = () => setCellBackground(cell, urls, idx + 1);
  pre.src = urls[idx];
}

// ---------------------------------------------------------------- ポートフォリオ

addBtn.addEventListener("click", () => {
  if (!lastResult) return;
  const brand =
    selectedBrand ||
    resolveBrand(lastResult.brand) ||
    resolveBrand(lastResult.keyword.split(/\s+/)[0]);
  const photo = (lastResult.items || []).find((i) => i.image)?.image || "";
  addHolding({
    keyword: lastResult.keyword + (lastResult.color ? `（${lastResult.color}）` : ""),
    brand,
    median: lastResult.stats.median,
    sources: lastResult.sources || [],
    photo,
    metal: lastResult.metal || null, // 貴金属は単価×重量で更新できるよう保持
    car: lastResult.car || null, // 車はカーセンサーで時価更新する
  });
});

// 出品ゼロ時：手入力価格でポートフォリオに登録
function showNoStock(keyword, color) {
  nostockTarget.textContent = keyword + (color ? `（${color}）` : "");
  nostockPrice.value = "";
  nostockEl.hidden = false;
}

nostockAddBtn.addEventListener("click", () => {
  const keyword = [g.base, g.model, g.ref].filter(Boolean).join(" ");
  if (!keyword) return;
  const brand = selectedBrand || resolveBrand(keyword.split(/\s+/)[0]);
  const manual = Number(String(nostockPrice.value).replace(/[^\d]/g, "")) || 0;
  addHolding({
    keyword: keyword + (g.color ? `（${g.color}）` : ""),
    brand,
    median: manual,
    sources: [],
    photo: "",
    noStock: manual === 0, // 価格未取得（手入力なし）
  });
  nostockEl.hidden = true;
});

// 保有銘柄を1件追加する共通処理
function addHolding({ keyword, brand, median, sources, photo, noStock = false, scroll = true, metal = null, car = null }) {
  const holdings = loadHoldings();
  const today = new Date().toISOString().slice(0, 10);
  holdings.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    keyword,
    brand,
    median: median || 0,
    sources: sources || [],
    photo: photo || "",
    status: "owned",
    noStock,
    metal, // 貴金属（{metal,grams}）。時価更新は単価×重量で再計算する
    car, // 車（{maker,model}）。時価更新はカーセンサーで再取得する
    buyDate: today,
    updatedAt: median ? today : "",
  });
  saveHoldings(holdings);
  renderPortfolio();
  // 明示追加（scroll=true）のときはポートフォリオタブへ切り替えて結果を見せる。
  // 出品カードからの追加（scroll=false）は査定タブに留めて閲覧を続けられるようにする。
  if (scroll) showView("portfolio");
}

refreshBtn.addEventListener("click", refreshPortfolioPrices);

// 手動追加：品名と金額を入力してそのまま登録（検索せずに追加できる）
document.getElementById("manual-add-btn").addEventListener("click", () => {
  const name = window.prompt("品名を入力してください。\n例：ロレックス デイトナ 126500LN（ホワイト）");
  if (!name || !name.trim()) return;
  const priceInput = window.prompt("推定市場価値を入力してください（任意・円）。\n空欄の場合は「未取得」として登録します。", "");
  if (priceInput === null) return;
  const price = Number(String(priceInput).replace(/[^\d]/g, "")) || 0;
  const holdings = loadHoldings();
  const today = new Date().toISOString().slice(0, 10);
  holdings.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    keyword: name.trim(),
    brand: resolveBrand(name.trim().split(/[\s　]+/)[0]),
    median: price,
    sources: [],
    photo: "",
    status: "owned",
    noStock: price === 0,
    manualPrice: price > 0, // 手動入力した価格は自動更新で上書きしない
    buyDate: today,
    updatedAt: price ? today : "",
  });
  saveHoldings(holdings);
  renderPortfolio();
  showView("portfolio");
});

async function refreshPortfolioPrices() {
  const holdings = loadHoldings();
  if (holdings.length === 0) return;
  refreshBtn.disabled = true;
  refreshBtn.textContent = "更新中…";
  // 貴金属が含まれていれば最新のグラム単価を一度だけ取得
  const hasMetal = holdings.some((h) => h.metal && h.status !== "sold");
  const rates = hasMetal ? await fetchMetalRates().catch(() => null) : null;
  for (const h of holdings) {
    if (h.status === "sold") continue; // 売却済みは更新しない
    if (h.manualPrice) continue; // 手動設定の価格は上書きしない
    // 貴金属は市場検索ではなく単価×重量×純度で再計算する
    if (h.metal) {
      if (rates && rates[h.metal.metal]) {
        h.median = Math.round(rates[h.metal.metal].purchase * h.metal.grams);
        h.updatedAt = new Date().toISOString().slice(0, 10);
      }
      continue;
    }
    // 車はカーセンサーで再取得する
    if (h.car) {
      try {
        const data = await fetchCars(h.car.maker, h.car.model);
        if (data.stats) {
          h.median = data.stats.median;
          h.updatedAt = new Date().toISOString().slice(0, 10);
        }
      } catch {
        // 失敗時は据え置き
      }
      continue;
    }
    try {
      // 品名から色（…（色））を分離して、その色で再取得する
      const colorM = h.keyword.match(/（([^）]+)）\s*$/);
      const color = colorM ? colorM[1] : "";
      const kw = h.keyword.replace(/（[^）]*）\s*$/, "").trim();
      const data = await fetchAppraisal(kw, color);
      if (data.stats) {
        h.median = data.stats.median;
        h.brand = resolveBrand(data.brand) || h.brand;
        h.sources = data.sources || h.sources;
        h.noStock = false; // 出品が見つかったので未取得フラグを解除
        h.updatedAt = new Date().toISOString().slice(0, 10);
      }
    } catch {
      // 失敗した銘柄は据え置き
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

// 並び順の入れ替え（▲▼ボタン。スマホでも操作しやすいように）
function moveHolding(id, dir) {
  const holdings = loadHoldings();
  const idx = holdings.findIndex((h) => h.id === id);
  const j = idx + dir;
  if (idx < 0 || j < 0 || j >= holdings.length) return;
  [holdings[idx], holdings[j]] = [holdings[j], holdings[idx]];
  saveHoldings(holdings);
  renderPortfolio();
}

function toggleSold(id) {
  const holdings = loadHoldings();
  const h = holdings.find((x) => x.id === id);
  if (!h) return;
  if (h.status === "sold") {
    h.status = "owned";
    delete h.soldPrice;
    delete h.soldAt;
  } else {
    const input = window.prompt("売却価格を入力してください（任意・円）。空欄でも記録できます。", "");
    if (input === null) return; // キャンセル
    h.status = "sold";
    const price = Number(String(input).replace(/[^\d]/g, ""));
    h.soldPrice = price > 0 ? price : null;
    h.soldAt = h.soldAt || new Date().toISOString().slice(0, 10);
  }
  saveHoldings(holdings);
  renderPortfolio();
}

// 推定市場価値の手動修正。手動にした銘柄は「価格を更新」で上書きしない。
// 空欄で確定すると自動取得に戻す。
function editHoldingPrice(id) {
  const holdings = loadHoldings();
  const h = holdings.find((x) => x.id === id);
  if (!h) return;
  const input = window.prompt(
    "推定市場価値を入力してください（円）。\n空欄にすると自動取得（価格を更新で再取得）に戻ります。",
    h.median || ""
  );
  if (input === null) return; // キャンセル
  const v = Number(String(input).replace(/[^\d]/g, ""));
  if (v > 0) {
    h.median = v;
    h.manualPrice = true;
    h.noStock = false;
    h.updatedAt = new Date().toISOString().slice(0, 10);
  } else {
    h.manualPrice = false; // 自動追跡に戻す（次回「価格を更新」で再取得）
  }
  saveHoldings(holdings);
  renderPortfolio();
}

// 購入価格の入力・修正（含み益の計算に使う）
function editBuyPrice(id) {
  const holdings = loadHoldings();
  const h = holdings.find((x) => x.id === id);
  if (!h) return;
  const input = window.prompt(
    "購入価格を入力してください（円）。\n空欄にすると未入力に戻ります。",
    h.buyPrice || ""
  );
  if (input === null) return; // キャンセル
  const v = Number(String(input).replace(/[^\d]/g, ""));
  h.buyPrice = v > 0 ? v : 0;
  saveHoldings(holdings);
  renderPortfolio();
}

// 売却価格の入力・修正（実現損益の計算に使う）
function editSoldPrice(id) {
  const holdings = loadHoldings();
  const h = holdings.find((x) => x.id === id);
  if (!h) return;
  const input = window.prompt(
    "売却価格を入力してください（円）。\n空欄にすると未入力に戻ります。",
    h.soldPrice || ""
  );
  if (input === null) return; // キャンセル
  const v = Number(String(input).replace(/[^\d]/g, ""));
  h.soldPrice = v > 0 ? v : null;
  saveHoldings(holdings);
  renderPortfolio();
}

// 購入日・売却日の編集
function updateHoldingDate(id, field, value) {
  const holdings = loadHoldings();
  const h = holdings.find((x) => x.id === id);
  if (!h) return;
  h[field] = value;
  saveHoldings(holdings);
}

// 写真アップロード（端末内で縮小してdataURLで保存）
function requestPhoto(id) {
  photoTargetId = id;
  photoInput.value = "";
  photoInput.click();
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files && photoInput.files[0];
  if (!file || !photoTargetId) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 400;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const holdings = loadHoldings();
      const h = holdings.find((x) => x.id === photoTargetId);
      if (h) {
        h.photo = dataUrl;
        saveHoldings(holdings);
        renderPortfolio();
      }
      photoTargetId = null;
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

function renderPortfolio() {
  updateNavCount();
  const holdings = loadHoldings();
  if (holdings.length === 0) {
    // 空でもセクションは出す（「＋手動で追加」を使えるように）
    portfolioEl.hidden = false;
    document.getElementById("pf-total").textContent = "—";
    document.getElementById("pf-summary").textContent =
      "まだ登録がありません。査定結果・出品カード・「＋手動で追加」から登録できます。";
    document.getElementById("pf-brands").innerHTML = "";
    document.getElementById("pf-genres").innerHTML = "";
    document.getElementById("pf-rows").innerHTML = "";
    document.getElementById("pf-sold-rows").innerHTML = "";
    document.getElementById("pf-sold-block").hidden = true;
    return;
  }

  const owned = holdings.filter((h) => h.status !== "sold");
  const sold = holdings.filter((h) => h.status === "sold");
  const total = owned.reduce((s, h) => s + h.median, 0);

  document.getElementById("pf-total").textContent = yen(total);
  const untracked = owned.filter((h) => !h.median).length;
  let summary = `保有 ${owned.length}点（推定市場価値の合計`;
  summary += untracked > 0 ? `／うち価格未取得 ${untracked}点）` : "）";
  if (sold.length > 0) {
    const proceeds = sold.reduce((s, h) => s + (h.soldPrice || 0), 0);
    summary += ` ／ 売却済 ${sold.length}点`;
    if (proceeds > 0) summary += `（売却額合計 ${yen(proceeds)}）`;
  }
  // 含み益合計（購入価格が入力済みの保有銘柄のみ）
  const withCost = owned.filter((h) => h.buyPrice > 0 && h.median > 0);
  let gainHtml = "";
  if (withCost.length > 0) {
    const cost = withCost.reduce((s, h) => s + h.buyPrice, 0);
    const value = withCost.reduce((s, h) => s + h.median, 0);
    const gain = value - cost;
    const pct = ((gain / cost) * 100).toFixed(1);
    const cls = gain > 0 ? "delta-up" : gain < 0 ? "delta-down" : "";
    gainHtml = ` ／ 含み益 <span class="${cls}">${gain > 0 ? "+" : ""}${yen(gain)}（${gain > 0 ? "+" : ""}${pct}%）</span>`;
    if (withCost.length < owned.length) gainHtml += `<small>（購入価格入力済み ${withCost.length}点分）</small>`;
  }
  // 実現損益合計（売却済みで購入価格・売却価格が揃っている銘柄のみ）
  const soldWithCost = sold.filter((h) => h.buyPrice > 0 && h.soldPrice > 0);
  if (soldWithCost.length > 0) {
    const realized = soldWithCost.reduce((s, h) => s + (h.soldPrice - h.buyPrice), 0);
    const cls = realized > 0 ? "delta-up" : realized < 0 ? "delta-down" : "";
    gainHtml += ` ／ 実現損益 <span class="${cls}">${realized > 0 ? "+" : ""}${yen(realized)}</span>`;
  }
  document.getElementById("pf-summary").innerHTML = escapeHtml(summary) + gainHtml;

  // ブランド別内訳（保有のみ・表記ゆれを正規化）
  const byBrand = new Map();
  for (const h of owned) {
    const brand = resolveBrand(h.brand) || h.brand;
    byBrand.set(brand, (byBrand.get(brand) || 0) + h.median);
  }
  renderBreakdown("pf-brands", byBrand, total);

  // ジャンル別内訳（時計／バッグ／リング等）
  const byGenre = new Map();
  for (const h of owned) {
    const genre = detectGenre(h);
    byGenre.set(genre, (byGenre.get(genre) || 0) + h.median);
  }
  renderBreakdown("pf-genres", byGenre, total);

  // 写真セル（保有・売却済み共通）
  const buildPhotoCell = (h) => {
    const photoInner = h.photo
      ? `<img class="pf-photo" src="${escapeAttr(h.photo)}" alt="" onerror="this.outerHTML='<div class=\\'pf-photo placeholder\\'>+</div>'">`
      : `<div class="pf-photo placeholder">＋</div>`;
    return `<div class="pf-photo-wrap" title="クリックで写真を${h.photo ? "変更" : "追加"}">${photoInner}<span class="pf-photo-edit">${h.photo ? "変更" : "追加"}</span></div>`;
  };

  // 保有一覧（売却済みは下の別テーブルに分ける）
  const rowsEl = document.getElementById("pf-rows");
  rowsEl.innerHTML = "";
  for (const h of owned) {
    const tr = document.createElement("tr");

    const priceCell = h.median
      ? `${yen(h.median)}${h.manualPrice ? ' <span class="pf-manual">手動</span>' : ""}`
      : `<span class="pf-untracked">未取得</span>`;
    const buyPriceCell = h.buyPrice ? yen(h.buyPrice) : `<span class="pf-untracked">未入力</span>`;

    // 含み益 = 推定市場価値 − 購入価格
    let gainCell = "—";
    let gainCls = "";
    if (h.buyPrice > 0 && h.median > 0) {
      const gain = h.median - h.buyPrice;
      const pct = ((gain / h.buyPrice) * 100).toFixed(1);
      gainCls = gain > 0 ? "delta-up" : gain < 0 ? "delta-down" : "";
      gainCell = `${gain > 0 ? "+" : ""}${yen(gain)}<br><small>（${gain > 0 ? "+" : ""}${pct}%）</small>`;
    }

    tr.innerHTML = `
      <td class="pf-photo-cell"></td>
      <td>${escapeHtml(h.keyword)}</td>
      <td>${escapeHtml(resolveBrand(h.brand) || h.brand)}</td>
      <td class="num pf-buyprice-cell" title="クリックで購入価格を入力">${buyPriceCell} <span class="pf-price-pen">✎</span></td>
      <td class="num strong pf-price-cell" title="クリックで手動修正">${priceCell} <span class="pf-price-pen">✎</span></td>
      <td class="num ${gainCls}">${gainCell}</td>
      <td class="pf-updated">${escapeHtml(h.updatedAt || "—")}</td>
      <td><input type="date" class="pf-date pf-buy-date" value="${escapeAttr(h.buyDate || "")}"></td>
      <td><span class="pf-badge owned">保有中</span></td>
      <td class="pf-actions">
        <span class="pf-order">
          <button type="button" class="btn-order btn-up" aria-label="上へ">▲</button>
          <button type="button" class="btn-order btn-down" aria-label="下へ">▼</button>
        </span>
        <button type="button" class="btn-mini btn-sold">売却</button>
        <button type="button" class="btn-remove" aria-label="削除">×</button>
      </td>`;

    const photoTd = tr.querySelector(".pf-photo-cell");
    photoTd.innerHTML = buildPhotoCell(h);
    photoTd.firstElementChild.addEventListener("click", () => requestPhoto(h.id));
    tr.querySelector(".btn-sold").addEventListener("click", () => toggleSold(h.id));
    tr.querySelector(".btn-remove").addEventListener("click", () => removeHolding(h.id));
    tr.querySelector(".pf-price-cell").addEventListener("click", () => editHoldingPrice(h.id));
    tr.querySelector(".pf-buyprice-cell").addEventListener("click", () => editBuyPrice(h.id));
    tr.querySelector(".btn-up").addEventListener("click", () => moveHolding(h.id, -1));
    tr.querySelector(".btn-down").addEventListener("click", () => moveHolding(h.id, +1));
    tr.querySelector(".pf-buy-date").addEventListener("change", (e) =>
      updateHoldingDate(h.id, "buyDate", e.target.value)
    );
    rowsEl.appendChild(tr);
  }

  // 売却済み（別テーブル）
  const soldBlock = document.getElementById("pf-sold-block");
  const soldRowsEl = document.getElementById("pf-sold-rows");
  soldRowsEl.innerHTML = "";
  soldBlock.hidden = sold.length === 0;
  for (const h of sold) {
    const tr = document.createElement("tr");
    tr.className = "pf-row-sold";
    const soldMedianCell = h.median
      ? `${yen(h.median)}${h.manualPrice ? ' <span class="pf-manual">手動</span>' : ""}`
      : `<span class="pf-untracked">未取得</span>`;
    const soldBuyPriceCell = h.buyPrice ? yen(h.buyPrice) : `<span class="pf-untracked">未入力</span>`;

    // 損益 = 売却価格 − 購入価格（実現損益）
    let plCell = "—";
    let plCls = "";
    if (h.buyPrice > 0 && h.soldPrice > 0) {
      const pl = h.soldPrice - h.buyPrice;
      const pct = ((pl / h.buyPrice) * 100).toFixed(1);
      plCls = pl > 0 ? "delta-up" : pl < 0 ? "delta-down" : "";
      plCell = `${pl > 0 ? "+" : ""}${yen(pl)}<br><small>（${pl > 0 ? "+" : ""}${pct}%）</small>`;
    }

    tr.innerHTML = `
      <td class="pf-photo-cell"></td>
      <td>${escapeHtml(h.keyword)}</td>
      <td>${escapeHtml(resolveBrand(h.brand) || h.brand)}</td>
      <td class="num pf-buyprice-cell" title="クリックで購入価格を入力">${soldBuyPriceCell} <span class="pf-price-pen">✎</span></td>
      <td class="num pf-price-cell" title="クリックで手動修正">${soldMedianCell} <span class="pf-price-pen">✎</span></td>
      <td class="num strong pf-soldprice-cell" title="クリックで売却価格を入力">${h.soldPrice ? yen(h.soldPrice) : '<span class="pf-untracked">未入力</span>'} <span class="pf-price-pen">✎</span></td>
      <td class="num ${plCls}">${plCell}</td>
      <td><input type="date" class="pf-date pf-buy-date" value="${escapeAttr(h.buyDate || "")}"></td>
      <td><input type="date" class="pf-date pf-sold-date" value="${escapeAttr(h.soldAt || "")}"></td>
      <td class="pf-actions">
        <button type="button" class="btn-mini btn-sold">保有に戻す</button>
        <button type="button" class="btn-remove" aria-label="削除">×</button>
      </td>`;
    tr.querySelector(".pf-price-cell").addEventListener("click", () => editHoldingPrice(h.id));
    tr.querySelector(".pf-buyprice-cell").addEventListener("click", () => editBuyPrice(h.id));
    tr.querySelector(".pf-soldprice-cell").addEventListener("click", () => editSoldPrice(h.id));
    const photoTd = tr.querySelector(".pf-photo-cell");
    photoTd.innerHTML = buildPhotoCell(h);
    photoTd.firstElementChild.addEventListener("click", () => requestPhoto(h.id));
    tr.querySelector(".btn-sold").addEventListener("click", () => toggleSold(h.id));
    tr.querySelector(".btn-remove").addEventListener("click", () => removeHolding(h.id));
    tr.querySelector(".pf-buy-date").addEventListener("change", (e) =>
      updateHoldingDate(h.id, "buyDate", e.target.value)
    );
    tr.querySelector(".pf-sold-date").addEventListener("change", (e) =>
      updateHoldingDate(h.id, "soldAt", e.target.value)
    );
    soldRowsEl.appendChild(tr);
  }

  portfolioEl.hidden = false;
}

// 内訳（ブランド別・ジャンル別共通）のバー表示
function renderBreakdown(elementId, byKey, total) {
  const entries = [...byKey.entries()].sort((a, b) => b[1] - a[1]);
  const el = document.getElementById(elementId);
  el.innerHTML = "";
  for (const [key, value] of entries) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    const row = document.createElement("div");
    row.className = "pf-brand-row";
    row.innerHTML = `
      <div class="pf-brand-head">
        <span class="pf-brand-name">${escapeHtml(key)}</span>
        <span class="pf-brand-value">${yen(value)} <small>(${pct.toFixed(1)}%)</small></span>
      </div>
      <div class="pf-brand-bar"><div class="pf-brand-fill" style="width:${pct.toFixed(1)}%"></div></div>`;
    el.appendChild(row);
  }
}

// 品名からジャンル（時計／バッグ／リング等）を判定する。
// カテゴリ語を先に見る（カルティエ等は時計とジュエリー両方があるため、
// ブランドだけでは時計と確定できない）。
const GENRE_WORDS = ["バッグ", "ウォレット", "財布", "リング", "ネックレス", "ペンダント", "ブレスレット", "ピアス", "サングラス", "ベルト", "Tシャツ"];
function detectGenre(h) {
  if (h.metal) return "貴金属";
  if (h.keyword.includes("中古車") || CAR_BRANDS[resolveBrand(h.brand) || h.brand]) return "車";
  for (const w of GENRE_WORDS) {
    if (h.keyword.includes(w)) return w === "ウォレット" ? "財布" : w;
  }
  const brand = resolveBrand(h.brand) || h.brand;
  if (BRAND_MODELS[brand] !== undefined) return "時計";
  return "その他";
}

// ---------------------------------------------------------------- 欲しいものリスト

const WISH_KEY = "asset-wishlist.v1";

function loadWishlist() {
  try {
    const raw = localStorage.getItem(WISH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWishlist(list) {
  localStorage.setItem(WISH_KEY, JSON.stringify(list));
}

// 欲しいものリストへ1件追加する共通処理
function addWish({ keyword, brand, price, photo, scroll = true, car = null }) {
  const today = new Date().toISOString().slice(0, 10);
  const list = loadWishlist();
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    keyword,
    brand,
    basePrice: price, // 登録時の時価
    median: price, // 現在の時価（更新で変わる）
    photo: photo || "",
    car, // 車（{maker,model}）。時価更新はカーセンサーで再取得
    addedAt: today,
    updatedAt: today,
  });
  saveWishlist(list);
  renderWishlist();
  if (scroll) showView("portfolio"); // 欲しいものリストはポートフォリオタブ内にある
}

document.getElementById("add-wishlist-btn").addEventListener("click", () => {
  if (!lastResult) return;
  addWish({
    car: lastResult.car || null,
    keyword: lastResult.keyword + (lastResult.color ? `（${lastResult.color}）` : ""),
    brand:
      selectedBrand ||
      resolveBrand(lastResult.brand) ||
      resolveBrand(lastResult.keyword.split(/\s+/)[0]),
    price: lastResult.stats.median,
    photo: (lastResult.items || []).find((i) => i.image)?.image || "",
  });
});

document.getElementById("refresh-wishlist-btn").addEventListener("click", refreshWishlistPrices);

async function refreshWishlistPrices() {
  const list = loadWishlist();
  if (list.length === 0) return;
  const btn = document.getElementById("refresh-wishlist-btn");
  btn.disabled = true;
  btn.textContent = "更新中…";
  for (const w of list) {
    try {
      let data;
      if (w.car) {
        data = await fetchCars(w.car.maker, w.car.model);
      } else {
        const colorM = w.keyword.match(/（([^）]+)）\s*$/);
        const color = colorM ? colorM[1] : "";
        const kw = w.keyword.replace(/（[^）]*）\s*$/, "").trim();
        data = await fetchAppraisal(kw, color);
      }
      if (data.stats) {
        w.median = data.stats.median;
        w.updatedAt = new Date().toISOString().slice(0, 10);
      }
    } catch {
      // 失敗した銘柄は据え置き
    }
  }
  saveWishlist(list);
  renderWishlist();
  btn.disabled = false;
  btn.textContent = "⟳ 時価を更新";
}

// 購入 → ポートフォリオへ移動（確認あり）
function buyWish(id) {
  const list = loadWishlist();
  const w = list.find((x) => x.id === id);
  if (!w) return;
  if (!window.confirm(`「${w.keyword}」をポートフォリオへ移動します。よろしいですか？`)) return;
  addHolding({
    keyword: w.keyword,
    brand: w.brand,
    median: w.median,
    sources: [],
    photo: w.photo,
    car: w.car || null,
  });
  saveWishlist(list.filter((x) => x.id !== id));
  renderWishlist();
}

function removeWish(id) {
  saveWishlist(loadWishlist().filter((x) => x.id !== id));
  renderWishlist();
}

function renderWishlist() {
  const list = loadWishlist();
  const wishlistEl = document.getElementById("wishlist");
  const rowsEl = document.getElementById("wish-rows");
  wishlistEl.hidden = false; // 空でもセクションは出す（登録方法が分かるように）
  if (list.length === 0) {
    rowsEl.innerHTML =
      '<tr><td colspan="8" class="pf-untracked">まだ登録がありません。査定結果の「☆ 欲しいものに追加」から登録できます。</td></tr>';
    return;
  }
  rowsEl.innerHTML = "";
  for (const w of list) {
    const tr = document.createElement("tr");
    const photo = w.photo
      ? `<img class="pf-photo" src="${escapeAttr(w.photo)}" alt="" onerror="this.outerHTML='<div class=\\'pf-photo placeholder\\'>—</div>'">`
      : `<div class="pf-photo placeholder">—</div>`;
    const diff = w.median - w.basePrice;
    const pct = w.basePrice > 0 ? ((diff / w.basePrice) * 100).toFixed(1) : "0.0";
    const deltaCls = diff > 0 ? "delta-up" : diff < 0 ? "delta-down" : "";
    const deltaText = diff === 0 ? "±0" : `${diff > 0 ? "+" : ""}${yen(diff).replace("¥", "")}円（${diff > 0 ? "+" : ""}${pct}%）`;
    tr.innerHTML = `
      <td>${photo}</td>
      <td>${escapeHtml(w.keyword)}</td>
      <td>${escapeHtml(resolveBrand(w.brand) || w.brand)}</td>
      <td class="num">${yen(w.basePrice)}</td>
      <td class="num strong">${yen(w.median)}</td>
      <td class="num ${deltaCls}">${deltaText}</td>
      <td>${escapeHtml(w.addedAt || "—")}</td>
      <td class="pf-actions">
        <button type="button" class="btn-mini btn-buy">購入→ポートフォリオへ</button>
        <button type="button" class="btn-remove" aria-label="削除">×</button>
      </td>`;
    tr.querySelector(".btn-buy").addEventListener("click", () => buyWish(w.id));
    tr.querySelector(".btn-remove").addEventListener("click", () => removeWish(w.id));
    rowsEl.appendChild(tr);
  }
  wishlistEl.hidden = false;
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

// ---------------------------------------------------------------- ビュー切り替え（査定 ⇄ ポートフォリオ）

function showView(view) {
  document.body.dataset.view = view;
  document.querySelectorAll(".nav-tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view)
  );
  window.scrollTo(0, 0);
}

document.querySelectorAll(".nav-tab").forEach((b) =>
  b.addEventListener("click", () => showView(b.dataset.view))
);

// ポートフォリオタブの保有件数バッジを更新
function updateNavCount() {
  const owned = loadHoldings().filter((h) => h.status !== "sold").length;
  const el = document.getElementById("nav-pf-count");
  if (!el) return;
  el.textContent = owned;
  el.hidden = owned === 0;
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

// 起動時
showView("search");
renderPortfolio();
renderWishlist();
// 背景画像はいったん非表示（再開するときはコメントを外す）
// renderHeroBackground();
