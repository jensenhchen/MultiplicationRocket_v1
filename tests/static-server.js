"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = Number(process.argv[2]) || 8765;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);

  if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    response.end(fs.readFileSync(path.join(root, "404.html")));
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
  });
  fs.createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Math JJCC Rocket test server: http://127.0.0.1:${port}/`);
});
