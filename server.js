"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const DEFAULT_ROOT = __dirname;
const DEFAULT_PORT = Number(process.env.PORT || process.argv[2]) || 8765;
const DEFAULT_HOST = process.env.HOST || "0.0.0.0";
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

function createMathRocketServer(options) {
  const settings = options || {};
  const root = path.resolve(settings.root || DEFAULT_ROOT);
  const dataFile = path.resolve(settings.dataFile || process.env.MATH_ROCKET_DATA_FILE || path.join(root, "data", "progress.json"));
  let writeQueue = Promise.resolve();

  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (url.pathname === "/api/progress") {
      if (request.method === "GET") {
        await handleProgressRead(response, dataFile);
        return;
      }

      if (request.method === "PUT") {
        try {
          const progress = await readJsonBody(request, 2 * 1024 * 1024);
          if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
            sendJson(response, 400, { error: "Progress must be a JSON object." });
            return;
          }
          writeQueue = writeQueue.then(() => writeJsonAtomically(dataFile, progress));
          await writeQueue;
          sendJson(response, 200, { saved: true, savedAt: new Date().toISOString() });
        } catch (error) {
          const status = error && error.code === "BODY_TOO_LARGE" ? 413 : 400;
          sendJson(response, status, { error: status === 413 ? "Progress data is too large." : "Invalid progress data." });
        }
        return;
      }

      response.writeHead(405, { Allow: "GET, PUT" });
      response.end();
      return;
    }

    serveStaticFile(request, response, root, url.pathname);
  });
}

async function handleProgressRead(response, dataFile) {
  try {
    const text = await fs.promises.readFile(dataFile, "utf8");
    const progress = JSON.parse(text);
    sendJson(response, 200, progress);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      response.writeHead(204, { "Cache-Control": "no-store" });
      response.end();
      return;
    }
    sendJson(response, 500, { error: "The progress file could not be read." });
  }
}

async function writeJsonAtomically(dataFile, progress) {
  const directory = path.dirname(dataFile);
  const temporaryFile = `${dataFile}.${process.pid}.tmp`;
  await fs.promises.mkdir(directory, { recursive: true });
  await fs.promises.writeFile(temporaryFile, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
  await fs.promises.rename(temporaryFile, dataFile);
}

function readJsonBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) {
        const error = new Error("Request body too large");
        error.code = "BODY_TOO_LARGE";
        reject(error);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function serveStaticFile(request, response, root, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  const requestPath = decodeURIComponent(pathname);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const blocked = relativePath === "server.js"
    || relativePath.startsWith("data/")
    || relativePath.startsWith(".git/")
    || relativePath.startsWith("tests/");
  const filePath = path.resolve(root, relativePath);

  if (blocked || !filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    const notFound = path.join(root, "404.html");
    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    response.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : "Not found");
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream"
  });
  if (request.method === "HEAD") response.end();
  else fs.createReadStream(filePath).pipe(response);
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(value));
}

if (require.main === module) {
  createMathRocketServer().listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log(`Math Rocket server: http://${DEFAULT_HOST}:${DEFAULT_PORT}/`);
    console.log(`Progress file: ${process.env.MATH_ROCKET_DATA_FILE || path.join(DEFAULT_ROOT, "data", "progress.json")}`);
  });
}

module.exports = { createMathRocketServer };
