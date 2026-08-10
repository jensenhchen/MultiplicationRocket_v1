"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createMathRocketServer } = require("../server.js");

async function run() {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "math-rocket-server-"));
  const dataFile = path.join(temporaryDirectory, "progress.json");
  const server = createMathRocketServer({ root: path.resolve(__dirname, ".."), dataFile });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const emptyResponse = await fetch(`${baseUrl}/api/progress`);
    assert.equal(emptyResponse.status, 204);

    const makeProgress = (sessionId, groupName, baseStars) => ({
      version: 4,
      totalStars: baseStars,
      groupStars: { cxy: groupName === "cxy" ? baseStars : 0, challenger: groupName === "challenger" ? baseStars : 0 },
      practiceHistory: [{
        sessionId,
        mode: "practice",
        groupName,
        correctCount: 10,
        totalQuestions: 10,
        correctionRate: 100,
        baseStars,
        playedAt: "2026-08-10"
      }]
    });
    const samples = [
      makeProgress("session-a", "cxy", 5),
      makeProgress("session-b", "cxy", 6),
      makeProgress("session-c", "cxy", 5),
      makeProgress("session-d", "cxy", 5),
      makeProgress("session-parent", "challenger", 7)
    ];
    const saveResponses = await Promise.all(samples.map((sample) => fetch(`${baseUrl}/api/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sample)
    })));
    saveResponses.forEach((response) => assert.equal(response.status, 200));

    const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    assert.equal(saved.practiceHistory.length, 5, "concurrent sessions should be merged");
    assert.equal(saved.groupStars.cxy, 22, "40 questions earn one daily-volume star after the four session awards");
    assert.equal(saved.groupStars.challenger, 7);
    assert.equal(saved.totalStars, 29);

    const duplicateResponse = await fetch(`${baseUrl}/api/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(samples[0])
    });
    assert.equal(duplicateResponse.status, 200);
    const duplicatePayload = await duplicateResponse.json();
    assert.equal(duplicatePayload.progress.practiceHistory.length, 5, "retries must not duplicate a session");
    assert.equal(duplicatePayload.progress.totalStars, 29);

    const loadResponse = await fetch(`${baseUrl}/api/progress`);
    assert.equal(loadResponse.status, 200);
    const loaded = await loadResponse.json();
    assert.equal(loaded.practiceHistory.length, 5);
    assert.equal(loaded.totalStars, 29);

    const protectedResponse = await fetch(`${baseUrl}/data/progress.json`);
    assert.equal(protectedResponse.status, 404);
    console.log("Server persistence and concurrent merge tests passed.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
