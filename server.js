const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const ROOT = __dirname;
const PORT = process.env.PORT || 5500;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  let filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT" && !path.extname(filePath)) {
        filePath = path.join(ROOT, "index.html");
        fs.readFile(filePath, (e2, d2) => {
          if (e2) {
            res.writeHead(404);
            res.end("Not found");
            return;
          }
          res.writeHead(200, { "Content-Type": MIME[".html"] });
          res.end(d2);
        });
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} sedang dipakai. Tutup program yang memakainya, atau jalankan: PORT=8080 node server.js`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`LP Tani berjalan di ${url}`);
  if (process.platform === "win32") exec(`start "" ${url}`);
  else if (process.platform === "darwin") exec(`open ${url}`);
  else exec(`xdg-open ${url}`);
});
