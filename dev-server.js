// ローカル確認用の簡易サーバー（Netlify CLI 不要）
// public/ を静的配信し、/api/search を Netlify Function のハンドラに中継する。
// 使い方: node dev-server.js → http://localhost:8888

const http = require("http");
const fs = require("fs");
const path = require("path");
const { handler: searchHandler } = require("./netlify/functions/search.js");
const { handler: ringoHandler } = require("./netlify/functions/ringo.js");
const { handler: metalsHandler } = require("./netlify/functions/metals.js");
const { handler: carsHandler } = require("./netlify/functions/cars.js");

const PORT = 8888;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Netlify の /api/* リダイレクトを再現
  const routes = {
    "/api/search": searchHandler,
    "/.netlify/functions/search": searchHandler,
    "/api/ringo": ringoHandler,
    "/.netlify/functions/ringo": ringoHandler,
    "/api/metals": metalsHandler,
    "/.netlify/functions/metals": metalsHandler,
    "/api/cars": carsHandler,
    "/.netlify/functions/cars": carsHandler,
  };
  const fnHandler = routes[url.pathname];
  if (fnHandler) {
    const result = await fnHandler({
      queryStringParameters: Object.fromEntries(url.searchParams),
    });
    res.writeHead(result.statusCode, result.headers);
    res.end(result.body);
    return;
  }

  // 静的ファイル配信
  let filePath = path.join(PUBLIC_DIR, decodeURIComponent(url.pathname));
  if (url.pathname === "/") filePath = path.join(PUBLIC_DIR, "index.html");
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`資産価値査定アプリ: http://localhost:${PORT} で起動しました`);
});
