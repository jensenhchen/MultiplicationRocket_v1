const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,119}$/;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN || "https://jensenhchen.github.io");
    if (origin && !cors) return json({ error: "Origin is not allowed." }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors || {} });

    const url = new URL(request.url);
    if (url.pathname !== "/api/progress") return json({ error: "Not found." }, 404, cors);
    if (!env.DB) return json({ error: "D1 database binding is missing." }, 503, cors);

    try {
      if (request.method === "GET") {
        const aggregate = await readAggregate(env.DB);
        return aggregate ? json(aggregate, 200, cors) : new Response(null, { status: 204, headers: cors || {} });
      }

      if (request.method === "POST" || request.method === "PUT") {
        const body = await readBody(request);
        const deviceId = String(body.deviceId || "").trim();
        if (!DEVICE_ID_PATTERN.test(deviceId)) return json({ error: "A valid deviceId is required." }, 400, cors);
        const progress = body.progress;
        if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
          return json({ error: "Progress must be a JSON object." }, 400, cors);
        }

        const now = new Date().toISOString();
        await env.DB.prepare(`
          INSERT INTO device_snapshots (device_id, progress_json, updated_at)
          VALUES (?1, ?2, ?3)
          ON CONFLICT(device_id) DO UPDATE SET
            progress_json = excluded.progress_json,
            updated_at = excluded.updated_at
        `).bind(deviceId, JSON.stringify(progress), now).run();

        const rows = await readRows(env.DB);
        return json({
          saved: true,
          savedAt: now,
          deviceId,
          deviceCount: rows.length,
          progress: aggregateRows(rows)
        }, request.method === "POST" ? 201 : 200, cors);
      }

      return new Response(null, { status: 405, headers: { ...(cors || {}), Allow: "GET, POST, PUT, OPTIONS" } });
    } catch (error) {
      const message = error && error.code === "BODY_TOO_LARGE"
        ? "Progress data is too large."
        : "Progress service could not complete the request.";
      return json({ error: message }, error && error.code === "BODY_TOO_LARGE" ? 413 : 500, cors);
    }
  }
};

async function readBody(request) {
  const text = await request.text();
  if (text.length > 2 * 1024 * 1024) {
    const error = new Error("Body too large");
    error.code = "BODY_TOO_LARGE";
    throw error;
  }
  return JSON.parse(text);
}

async function readRows(database) {
  const result = await database.prepare("SELECT progress_json FROM device_snapshots ORDER BY device_id").all();
  return Array.isArray(result.results) ? result.results : [];
}

async function readAggregate(database) {
  const rows = await readRows(database);
  return rows.length ? aggregateRows(rows) : null;
}

export function aggregateRows(rows) {
  return rows.reduce((aggregate, row) => {
    try {
      return mergeProgressRecords(aggregate, JSON.parse(row.progress_json));
    } catch (error) {
      return aggregate;
    }
  }, null);
}

function corsHeaders(origin, configuredOrigin) {
  const allowed = String(configuredOrigin || "").split(",").map((item) => item.trim()).filter(Boolean);
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (origin && !local && !allowed.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin || allowed[0] || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(value, status, extraHeaders) {
  return new Response(JSON.stringify(value), { status, headers: { ...JSON_HEADERS, ...(extraHeaders || {}) } });
}

export function mergeProgressRecords(existingValue, incomingValue) {
  const existing = objectValue(existingValue);
  const incoming = objectValue(incomingValue);
  const practiceHistory = mergeEvents(existing.practiceHistory, incoming.practiceHistory, "sessionId", 2000);
  const competitionTurnHistory = mergeEvents(existing.competitionTurnHistory, incoming.competitionTurnHistory, "sessionId", 2000);
  const retryHistory = mergeEvents(existing.retryHistory, incoming.retryHistory, "retryId", 2000);
  const competitionHistory = mergeEvents(existing.competitionHistory, incoming.competitionHistory, "id", 1000);
  const wrongQuestions = mergeEvents(existing.wrongQuestions, incoming.wrongQuestions, "id", 2000, true);
  const starAdjustments = mergeEvents(existing.starAdjustments, incoming.starAdjustments, "id", 4000);
  normalizeDailyGoalBonuses([...practiceHistory, ...competitionTurnHistory]);

  const eventStars = calculateEventStars(practiceHistory, competitionTurnHistory, retryHistory);
  const adjustmentStars = calculateAdjustmentStars(starAdjustments);
  const legacyStars = {
    cxy: Math.max(legacyGroupStars(existing, "cxy"), legacyGroupStars(incoming, "cxy")),
    challenger: Math.max(legacyGroupStars(existing, "challenger"), legacyGroupStars(incoming, "challenger"))
  };
  const groupStars = {
    cxy: Math.max(0, legacyStars.cxy + eventStars.cxy + adjustmentStars.cxy),
    challenger: Math.max(0, legacyStars.challenger + eventStars.challenger + adjustmentStars.challenger)
  };
  const mergedTurns = [...practiceHistory, ...competitionTurnHistory];

  return {
    ...existing,
    ...incoming,
    version: 4,
    revision: Math.max(numberValue(existing.revision), numberValue(incoming.revision)) + 1,
    updatedAt: new Date().toISOString(),
    totalStars: groupStars.cxy + groupStars.challenger,
    groupStars,
    legacyGroupStars: legacyStars,
    configs: { ...objectValue(existing.configs), ...objectValue(incoming.configs) },
    bestScore: mergedTurns.reduce((best, item) => Math.max(best, eventValue(item)), 0),
    groupStats: {
      cxy: buildGroupStats(mergedTurns, "cxy"),
      challenger: buildGroupStats(mergedTurns, "challenger")
    },
    practiceHistory,
    competitionTurnHistory,
    competitionHistory,
    lastResults: mergeLastResults(existing.lastResults, incoming.lastResults, mergedTurns),
    wrongQuestions,
    completedRetries: [...new Set([
      ...arrayValue(existing.completedRetries).map(String),
      ...arrayValue(incoming.completedRetries).map(String)
    ])].slice(0, 4000),
    retryHistory,
    starAdjustments,
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

function calculateAdjustmentStars(adjustments) {
  const totals = { cxy: 0, challenger: 0 };
  adjustments.forEach((item) => {
    if (normalizeGroupName(item && item.groupName) !== "challenger") return;
    totals.challenger += Math.max(-20, Math.min(20, numberValue(item.amount)));
  });
  return totals;
}

function eventValue(item) {
  return Math.max(0, numberValue(item.baseStars))
    + Math.max(0, numberValue(item.speedStars))
    + Math.max(0, numberValue(item.dailyGoalBonus));
}

function legacyGroupStars(progress, groupName) {
  const explicit = objectValue(progress.legacyGroupStars);
  const legacyName = groupName === "challenger" ? "cxr" : groupName;
  if (explicit[groupName] != null || explicit[legacyName] != null) {
    return Math.max(0, numberValue(explicit[groupName] != null ? explicit[groupName] : explicit[legacyName]));
  }

  // Version 4 totals are derived snapshots, not independent earning events. Treating
  // their unexplained balance as legacy credit causes cross-device snapshots to feed
  // the aggregate back into itself and inflate stars on every synchronization.
  if (numberValue(progress.version) >= 4) return 0;

  const stored = objectValue(progress.groupStars);
  return Math.max(0, numberValue(stored[groupName] != null ? stored[groupName] : stored[legacyName]));
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
      normalizeGroupName(turn.groupName), turn.operationSet || "add-sub",
      turn.difficulty || "medium", numberValue(turn.rangeMax) || 10
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
