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
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    assert.equal((await fetch(`${baseUrl}/api/progress`)).status, 204);

    const makeProgress = (sessionId, groupName, baseStars) => ({
      version: 4,
      totalStars: baseStars,
      groupStars: { cxy: groupName === "cxy" ? baseStars : 0, challenger: groupName === "challenger" ? baseStars : 0 },
      practiceHistory: [{
        sessionId, mode: "practice", groupName, correctCount: 10, totalQuestions: 10,
        correctionRate: 100, baseStars, playedAt: "2026-08-10"
      }]
    });
    const samples = [
      makeProgress("session-a", "cxy", 5), makeProgress("session-b", "cxy", 6),
      makeProgress("session-c", "cxy", 5), makeProgress("session-d", "cxy", 5),
      makeProgress("session-parent", "challenger", 7)
    ];

    for (let index = 0; index < samples.length; index += 1) {
      const response = await fetch(`${baseUrl}/api/progress`, {
        method: index ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: `device-test-${index}`, progress: samples[index] })
      });
      assert.equal(response.status, index ? 200 : 201);
    }

    const files = fs.readdirSync(temporaryDirectory).filter((name) => name.endsWith(".json"));
    assert.deepEqual(files, ["progress.json"], "local development must use one progress file only");
    const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    assert.equal(saved.practiceHistory.length, 5);
    assert.equal(saved.groupStars.cxy, 22);
    assert.equal(saved.groupStars.challenger, 7);
    assert.equal(saved.totalStars, 29);

    const duplicate = await fetch(`${baseUrl}/api/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "device-test-0", progress: samples[0] })
    });
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).progress.practiceHistory.length, 5);

    const loaded = await (await fetch(`${baseUrl}/api/progress`)).json();
    assert.equal(loaded.totalStars, 29);
    assert.equal((await fetch(`${baseUrl}/data/progress.json`)).status, 404);
    console.log("Single-file local persistence and de-duplicating merge tests passed.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
