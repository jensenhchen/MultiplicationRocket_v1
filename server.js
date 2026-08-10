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
        await writeQueue.catch(() => undefined);
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
          writeQueue = writeQueue.catch(() => undefined).then(async () => {
            const existing = await readProgressFile(dataFile);
            const merged = mergeProgressRecords(existing, progress);
            await writeJsonAtomically(dataFile, merged);
            return merged;
          });
          const merged = await writeQueue;
          sendJson(response, 200, { saved: true, savedAt: new Date().toISOString(), progress: merged });
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

async function readProgressFile(dataFile) {
  try {
    return JSON.parse(await fs.promises.readFile(dataFile, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function mergeProgressRecords(existingValue, incomingValue) {
  const existing = objectValue(existingValue);
  const incoming = objectValue(incomingValue);
  const practiceHistory = mergeEvents(existing.practiceHistory, incoming.practiceHistory, "sessionId", 2000);
  const competitionTurnHistory = mergeEvents(existing.competitionTurnHistory, incoming.competitionTurnHistory, "sessionId", 2000);
  const retryHistory = mergeEvents(existing.retryHistory, incoming.retryHistory, "retryId", 2000);
  const competitionHistory = mergeEvents(existing.competitionHistory, incoming.competitionHistory, "id", 1000);
  const wrongQuestions = mergeEvents(existing.wrongQuestions, incoming.wrongQuestions, "id", 2000, true);
  normalizeDailyGoalBonuses([...practiceHistory, ...competitionTurnHistory]);

  const eventStars = calculateEventStars(practiceHistory, competitionTurnHistory, retryHistory);
  const existingEventStars = calculateEventStars(
    arrayValue(existing.practiceHistory),
    arrayValue(existing.competitionTurnHistory),
    arrayValue(existing.retryHistory)
  );
  const incomingEventStars = calculateEventStars(
    arrayValue(incoming.practiceHistory),
    arrayValue(incoming.competitionTurnHistory),
    arrayValue(incoming.retryHistory)
  );
  const legacyStars = {
    cxy: Math.max(
      unexplainedGroupStars(existing, existingEventStars, "cxy"),
      unexplainedGroupStars(incoming, incomingEventStars, "cxy")
    ),
    challenger: Math.max(
      unexplainedGroupStars(existing, existingEventStars, "challenger"),
      unexplainedGroupStars(incoming, incomingEventStars, "challenger")
    )
  };
  const groupStars = {
    cxy: legacyStars.cxy + eventStars.cxy,
    challenger: legacyStars.challenger + eventStars.challenger
  };
  const mergedTurns = [...practiceHistory, ...competitionTurnHistory];
  const lastResults = mergeLastResults(existing.lastResults, incoming.lastResults, mergedTurns);

  return {
    ...existing,
    ...incoming,
    version: 4,
    revision: Math.max(numberValue(existing.revision), numberValue(incoming.revision)) + 1,
    updatedAt: new Date().toISOString(),
    totalStars: groupStars.cxy + groupStars.challenger,
    groupStars,
    configs: {
      ...objectValue(existing.configs),
      ...objectValue(incoming.configs)
    },
    bestScore: mergedTurns.reduce((best, item) => Math.max(best, eventValue(item)), 0),
    groupStats: {
      cxy: buildGroupStats(mergedTurns, "cxy"),
      challenger: buildGroupStats(mergedTurns, "challenger")
    },
    practiceHistory,
    competitionTurnHistory,
    competitionHistory,
    lastResults,
    wrongQuestions,
    completedRetries: [...new Set([
      ...arrayValue(existing.completedRetries).map(String),
      ...arrayValue(incoming.completedRetries).map(String)
    ])].slice(0, 4000),
    retryHistory,
    lastPlayedDate: latestText(existing.lastPlayedDate, incoming.lastPlayedDate, ...mergedTurns.map((item) => item.playedAt)),
    gamesPlayed: mergedTurns.length
  };
}

function mergeEvents(existingValue, incomingValue, keyName, limit, mergeReviewed) {
  const records = new Map();
  [...arrayValue(existingValue), ...arrayValue(incomingValue)].forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const key = String(item[keyName] || `${keyName}-legacy-${item.playedAt || item.completedAt || ""}-${index}`);
    const previous = records.get(key) || {};
    const next = { ...previous, ...item, [keyName]: String(item[keyName] || previous[keyName] || key) };
    ["baseStars", "speedStars", "dailyGoalBonus", "retryStars", "stars"].forEach((field) => {
      next[field] = Math.max(numberValue(previous[field]), numberValue(item[field]));
    });
    if (mergeReviewed) next.reviewed = Boolean(previous.reviewed || item.reviewed);
    records.set(key, next);
  });
  return [...records.values()]
    .sort((left, right) => eventDate(right).localeCompare(eventDate(left)))
    .slice(0, limit);
}

function normalizeDailyGoalBonuses(turns) {
  const daily = new Map();
  turns.forEach((turn) => {
    turn.dailyGoalBonus = 0;
    const questions = Math.max(0, numberValue(turn.totalQuestions));
    if (!questions || !turn.playedAt) return;
    const key = `${normalizeGroupName(turn.groupName)}|${turn.playedAt}`;
    const record = daily.get(key) || { questions: 0, turns: [] };
    record.questions += questions;
    record.turns.push(turn);
    daily.set(key, record);
  });
  daily.forEach((record) => {
    if (record.turns.length) record.turns[0].dailyGoalBonus = extraQuestionStars(record.questions);
  });
}

function calculateEventStars(practiceHistory, competitionTurnHistory, retryHistory) {
  const totals = { cxy: 0, challenger: 0 };
  [...practiceHistory, ...competitionTurnHistory].forEach((item) => {
    totals[normalizeGroupName(item.groupName)] += eventValue(item);
  });
  retryHistory.forEach((item) => {
    totals[normalizeGroupName(item.groupName)] += Math.max(0, numberValue(item.stars));
  });
  return totals;
}

function eventValue(item) {
  return Math.max(0, numberValue(item.baseStars))
    + Math.max(0, numberValue(item.speedStars))
    + Math.max(0, numberValue(item.dailyGoalBonus));
}

function unexplainedGroupStars(progress, eventStars, groupName) {
  const stored = objectValue(progress.groupStars);
  const legacyName = groupName === "challenger" ? "cxr" : groupName;
  return Math.max(0, numberValue(stored[groupName] != null ? stored[groupName] : stored[legacyName]) - eventStars[groupName]);
}

function buildGroupStats(turns, groupName) {
  const records = turns.filter((item) => normalizeGroupName(item.groupName) === groupName);
  const latest = [...records].sort((left, right) => eventDate(right).localeCompare(eventDate(left)))[0] || {};
  return {
    gamesPlayed: records.length,
    totalTime: records.reduce((sum, item) => sum + Math.max(0, numberValue(item.elapsedSeconds)), 0),
    totalCorrect: records.reduce((sum, item) => sum + Math.max(0, numberValue(item.correctCount)), 0),
    totalQuestions: records.reduce((sum, item) => sum + Math.max(0, numberValue(item.totalQuestions)), 0),
    bestScore: records.reduce((best, item) => Math.max(best, eventValue(item)), 0),
    bestRate: records.reduce((best, item) => Math.max(best, numberValue(item.correctionRate)), 0),
    lastTime: numberValue(latest.elapsedSeconds),
    lastCorrect: numberValue(latest.correctCount),
    lastTotal: numberValue(latest.totalQuestions),
    lastRate: numberValue(latest.correctionRate),
    lastPlayedDate: latest.playedAt || ""
  };
}

function mergeLastResults(existingValue, incomingValue, turns) {
  const results = { ...objectValue(existingValue), ...objectValue(incomingValue) };
  turns.forEach((turn) => {
    const key = [
      turn.mode === "competition" ? "competition" : "practice",
      normalizeGroupName(turn.groupName),
      turn.operationSet || "add-sub",
      turn.difficulty || "medium",
      numberValue(turn.rangeMax) || 10
    ].join("|");
    if (!results[key] || eventDate(turn) >= eventDate(results[key])) results[key] = turn;
  });
  return results;
}

function extraQuestionStars(questionCount) {
  return Math.ceil(Math.max(0, numberValue(questionCount) - 30) / 10);
}

function normalizeGroupName(value) {
  return value === "challenger" || value === "cxr" ? "challenger" : "cxy";
}

function eventDate(item) {
  return String((item && (item.updatedAt || item.completedAt || item.playedAt)) || "");
}

function latestText(...values) {
  return values.filter(Boolean).map(String).sort().pop() || "";
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
    console.log(`Math Rocket (JJCC) server: http://${DEFAULT_HOST}:${DEFAULT_PORT}/`);
    console.log(`Progress file: ${process.env.MATH_ROCKET_DATA_FILE || path.join(DEFAULT_ROOT, "data", "progress.json")}`);
  });
}

module.exports = { createMathRocketServer, mergeProgressRecords };
