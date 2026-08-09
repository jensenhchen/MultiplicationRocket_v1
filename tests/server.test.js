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

    const sample = {
      version: 3,
      groupStats: { cxy: { totalQuestions: 20 }, challenger: { totalQuestions: 10 } },
      practiceHistory: []
    };
    const saveResponse = await fetch(`${baseUrl}/api/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sample)
    });
    assert.equal(saveResponse.status, 200);
    assert.deepEqual(JSON.parse(fs.readFileSync(dataFile, "utf8")), sample);

    const loadResponse = await fetch(`${baseUrl}/api/progress`);
    assert.equal(loadResponse.status, 200);
    assert.deepEqual(await loadResponse.json(), sample);

    const protectedResponse = await fetch(`${baseUrl}/data/progress.json`);
    assert.equal(protectedResponse.status, 404);
    console.log("Server persistence tests passed.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
