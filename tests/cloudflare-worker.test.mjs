import assert from "node:assert/strict";
import worker from "../cloudflare/worker.mjs";

class FakeD1 {
  constructor() {
    this.rows = new Map();
  }

  prepare(sql) {
    const database = this;
    return {
      values: [],
      bind(...values) {
        this.values = values;
        return this;
      },
      async run() {
        assert.match(sql, /INSERT INTO device_snapshots/);
        const [deviceId, progressJson, updatedAt] = this.values;
        database.rows.set(deviceId, { device_id: deviceId, progress_json: progressJson, updated_at: updatedAt });
        return { success: true };
      },
      async all() {
        assert.match(sql, /SELECT progress_json FROM device_snapshots/);
        return { results: [...database.rows.values()].sort((a, b) => a.device_id.localeCompare(b.device_id)) };
      }
    };
  }
}

function progress(sessionId, stars) {
  return {
    version: 4,
    groupStars: { cxy: stars, challenger: 0 },
    totalStars: stars,
    practiceHistory: [{
      sessionId, mode: "practice", groupName: "cxy", correctCount: 10,
      totalQuestions: 10, baseStars: stars, correctionRate: 100, playedAt: "2026-08-10"
    }]
  };
}

async function call(database, method, body, origin = "https://jensenhchen.github.io") {
  const request = new Request("https://math-rocket-jjcc-sync.example.workers.dev/api/progress", {
    method,
    headers: { Origin: origin, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return worker.fetch(request, { DB: database, ALLOWED_ORIGIN: "https://jensenhchen.github.io" });
}

const database = new FakeD1();
const devices = [
  ["device-edge-0001", progress("edge-mission", 5)],
  ["device-chrome-01", progress("chrome-mission", 6)],
  ["device-android-1", progress("android-mission", 7)]
];

const responses = await Promise.all(devices.map(([deviceId, snapshot]) =>
  call(database, "POST", { deviceId, progress: snapshot })
));
responses.forEach((response) => assert.equal(response.status, 201));

const combinedResponse = await call(database, "GET");
assert.equal(combinedResponse.status, 200);
assert.equal(combinedResponse.headers.get("Access-Control-Allow-Origin"), "https://jensenhchen.github.io");
const combined = await combinedResponse.json();
assert.equal(combined.practiceHistory.length, 3);
assert.equal(combined.totalStars, 18);

const updateResponse = await call(database, "PUT", {
  deviceId: "device-edge-0001",
  progress: progress("edge-mission", 5)
});
const update = await updateResponse.json();
assert.equal(update.deviceCount, 3, "one stable device row must be reused");
assert.equal(update.progress.totalStars, 18, "re-uploading one snapshot must not duplicate stars");

const addAdjustment = {
  id: "hidden-adjustment-add",
  groupName: "challenger",
  mode: "practice",
  amount: 20,
  adjustedAt: "2026-08-10",
  createdAt: "2026-08-10T12:00:00.000Z"
};
const subtractAdjustment = {
  id: "hidden-adjustment-subtract",
  groupName: "challenger",
  mode: "practice",
  amount: -20,
  adjustedAt: "2026-08-10",
  createdAt: "2026-08-10T12:01:00.000Z"
};
const addedResponse = await call(database, "POST", {
  deviceId: "device-parent-adjust",
  progress: {
    version: 4,
    totalStars: 20,
    groupStars: { cxy: 0, challenger: 20 },
    starAdjustments: [addAdjustment]
  }
});
const added = await addedResponse.json();
assert.equal(added.progress.groupStars.challenger, 20);
assert.equal(added.progress.totalStars, 38);

const subtractedResponse = await call(database, "PUT", {
  deviceId: "device-parent-adjust",
  progress: {
    version: 4,
    totalStars: 0,
    groupStars: { cxy: 0, challenger: 0 },
    starAdjustments: [addAdjustment, subtractAdjustment]
  }
});
const subtracted = await subtractedResponse.json();
assert.equal(subtracted.progress.groupStars.challenger, 0, "a synchronized negative adjustment must be retained");
assert.equal(subtracted.progress.totalStars, 18);
assert.equal(subtracted.progress.starAdjustments.length, 2);
assert.equal((await call(database, "GET", null, "https://malicious.example")).status, 403);

console.log("Cloudflare D1 device snapshot, aggregation, concurrency, and CORS tests passed.");
