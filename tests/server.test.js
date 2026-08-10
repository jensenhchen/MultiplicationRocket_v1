"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createMathRocketServer, aggregateProgressRecords } = require("../server.js");

async function run() {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "math-rocket-server-"));
  const dataFile = path.join(temporaryDirectory, "progress.json");
  const recordsDirectory = path.join(temporaryDirectory, "records");
  const server = createMathRocketServer({ root: path.resolve(__dirname, ".."), dataFile, recordsDirectory });
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
    const accessIds = samples.map((sample, index) => `access-17863212345${index}-device${index}`);
    const saveResponses = await Promise.all(samples.map((sample, index) => fetch(`${baseUrl}/api/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: accessIds[index], progress: sample })
    })));
    saveResponses.forEach((response) => assert.equal(response.status, 201));

    const recordFiles = fs.readdirSync(recordsDirectory).filter((name) => name.endsWith(".json"));
    assert.equal(recordFiles.length, 5, "each access session should have its own record file");
    accessIds.forEach((accessId) => {
      assert(recordFiles.includes(`record-${accessId}.json`), `missing record file for ${accessId}`);
    });

    const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    assert.equal(saved.practiceHistory.length, 5, "concurrent sessions should be merged");
    assert.equal(saved.groupStars.cxy, 22, "40 questions earn one daily-volume star after the four session awards");
    assert.equal(saved.groupStars.challenger, 7);
    assert.equal(saved.totalStars, 29);

    const duplicateResponse = await fetch(`${baseUrl}/api/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: accessIds[0], progress: samples[0] })
    });
    assert.equal(duplicateResponse.status, 200);
    const duplicatePayload = await duplicateResponse.json();
    assert.equal(duplicatePayload.progress.practiceHistory.length, 5, "retries must not duplicate a session");
    assert.equal(duplicatePayload.progress.totalStars, 29);
    assert.equal(fs.readdirSync(recordsDirectory).filter((name) => name.endsWith(".json")).length, 5,
      "updates from one access session must reuse its record file");

    const loadResponse = await fetch(`${baseUrl}/api/progress`);
    assert.equal(loadResponse.status, 200);
    const loaded = await loadResponse.json();
    assert.equal(loaded.practiceHistory.length, 5);
    assert.equal(loaded.totalStars, 29);

    fs.writeFileSync(path.join(recordsDirectory, "record-corrupt-file.json"), "not-json", "utf8");
    const restartedAggregate = await aggregateProgressRecords(dataFile, recordsDirectory);
    assert.equal(restartedAggregate.totalStars, 29, "restart aggregation should retain all valid session records");
    assert.equal(restartedAggregate.practiceHistory.length, 5);

    const protectedResponse = await fetch(`${baseUrl}/data/progress.json`);
    assert.equal(protectedResponse.status, 404);
    const protectedRecord = await fetch(`${baseUrl}/data/records/${recordFiles[0]}`);
    assert.equal(protectedRecord.status, 404);
    console.log("Per-session record persistence, restart aggregation, and concurrent merge tests passed.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
