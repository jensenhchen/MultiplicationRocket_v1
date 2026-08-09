"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const memory = new Map();
const localStorage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
  removeItem(key) { memory.delete(key); }
};
const windowObject = {
  localStorage,
  setInterval,
  clearInterval,
  setTimeout,
  clearTimeout
};
const context = vm.createContext({
  window: windowObject,
  console,
  Math,
  Date,
  Set,
  Map
});

function load(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

load("js/utils.js");
load("js/storage.js");
load("js/questions.js");
load("js/game.js");

const RocketMath = windowObject.RocketMath;
const groups = Object.keys(RocketMath.questions.GROUPS);
const operationSets = Object.keys(RocketMath.questions.OPERATION_SETS);
const difficulties = Object.keys(RocketMath.questions.DIFFICULTIES);
let generatedCount = 0;

groups.forEach((groupName) => {
  RocketMath.questions.GROUPS[groupName].ranges.forEach((rangeMax) => {
    operationSets.forEach((operationSet) => {
      difficulties.forEach((difficulty) => {
        const config = { groupName, rangeMax, operationSet, difficulty };
        const questions = RocketMath.questions.createQuestionSet(config, 10);
        const signatures = new Set(questions.map((question) => question.signature));
        const seenOperators = new Set(questions.flatMap((question) => question.operators));
        const expectedOperators = RocketMath.questions.OPERATION_SETS[operationSet].operators;
        const resultLimit = RocketMath.questions.getResultLimit(config);

        assert.equal(questions.length, 10);
        assert.equal(signatures.size, 10, `duplicate question in ${JSON.stringify(config)}`);
        expectedOperators.forEach((operator) => {
          assert(seenOperators.has(operator), `missing ${operator} in ${JSON.stringify(config)}`);
        });

        questions.forEach((question) => {
          generatedCount += 1;
          const validation = RocketMath.questions.validateQuestion(question);
          assert(validation.valid, `${validation.errors.join(", ")} in ${question.text}`);
          assert(question.numbers.every((number) => number >= 1 && number <= rangeMax));
          assert.equal(new Set(question.choices).size, 4);
          assert(question.choices.includes(question.answer));

          let current = question.numbers[0];
          question.operators.forEach((operator, index) => {
            const next = question.numbers[index + 1];
            if (operator === "add") current += next;
            if (operator === "subtract") current -= next;
            if (operator === "multiply") current *= next;
            if (operator === "divide") {
              assert.notEqual(next, 0);
              assert.equal(current % next, 0, `non-exact division in ${question.text}`);
              current /= next;
            }
            assert(Number.isInteger(current));
            assert(current >= 0);
          });
          assert.equal(current, question.answer);
          assert(question.intermediateResults.every((value) => value <= resultLimit));

          question.operators.forEach((operator, operatorIndex) => {
            if (operator !== "multiply" && operator !== "divide") return;
            const expectedTable = RocketMath.questions.GENERATION_RULES
              .multiplicationTables[groupName][difficulty];
            assert(
              expectedTable.includes(question.numbers[operatorIndex + 1]),
              `age-inappropriate fact in ${question.text}`
            );
          });
        });

        if (groupName === "cxy" && operationSet === "add-sub") {
          const strategyQuestions = questions.filter((question) => (
            question.strategy === "make-ten" || question.strategy === "break-ten"
          ));
          assert(strategyQuestions.length >= 6, `not enough make/break-ten work in ${JSON.stringify(config)}`);
          strategyQuestions.forEach((question) => {
            assert(
              /Make|Break|Reach 10|Start at 10/.test(question.hint),
              `missing ten strategy hint in ${question.text}`
            );
            if (difficulty !== "easy") {
              const tenIsUsedFirst = question.strategy === "make-ten"
                ? question.intermediateResults[0] === 10
                : (question.numbers[0] === 10 || question.intermediateResults[0] === 10);
              assert(tenIsUsedFirst, `first step should use ten in ${question.text}`);
            }
          });
        }
      });
    });
  });
});

const storage = RocketMath.storage;
let progress = storage.createDefaultProgress();
assert.equal(progress.configs.cxy.difficulty, "easy");
assert.equal(progress.configs.challenger.rangeMax, 25);
assert.equal(RocketMath.questions.normalizeOptions({ groupName: "cxy" }).difficulty, "easy");
const result = {
  sessionId: "practice-one",
  mode: "practice",
  groupName: "cxy",
  operationSet: "add-sub",
  difficulty: "medium",
  rangeMax: 10,
  correctCount: 8,
  totalQuestions: 10,
  correctionRate: 80,
  elapsedSeconds: 42,
  baseStars: 80,
  wrongAnswers: [],
  playedAt: "2026-08-07"
};
let recorded = storage.recordGameResult(progress, result);
assert.equal(recorded.previous, null);
progress = recorded.progress;
recorded = storage.recordGameResult(progress, { ...result, sessionId: "practice-two", correctionRate: 90 });
assert.equal(recorded.previous.sessionId, "practice-one");
assert.equal(recorded.progress.totalStars, 160);

let retry = storage.recordRetryBonus(recorded.progress, {
  retryId: "practice-two-q1",
  groupName: "cxy",
  stars: 5,
  completedAt: "2026-08-07"
});
assert.equal(retry.awarded, 5);
retry = storage.recordRetryBonus(retry.progress, {
  retryId: "practice-two-q1",
  groupName: "cxy",
  stars: 5,
  completedAt: "2026-08-07"
});
assert.equal(retry.awarded, 0, "retry stars must only be awarded once");

const rewardResult = {
  correctCount: 9,
  correctionRate: 90,
  averageCorrectSeconds: 5,
  maxStreak: 5,
  difficultyMultiplier: 1.3
};
const rewards = RocketMath.game.computeRewards(rewardResult, {
  correctionRate: 80,
  averageCorrectSeconds: 6
});
assert.deepEqual(JSON.parse(JSON.stringify(rewards)), {
  completion: 2,
  correct: 9,
  accuracy: 2,
  accuracyImprovement: 2,
  speedImprovement: 1,
  streak: 1,
  difficulty: 3,
  total: 20
});
const accuracyFirst = RocketMath.game.computeRewards({
  ...rewardResult,
  correctCount: 8,
  correctionRate: 80,
  averageCorrectSeconds: 4
}, {
  correctionRate: 90,
  averageCorrectSeconds: 6
});
assert.equal(accuracyFirst.speedImprovement, 0, "speed bonus must not reward lower accuracy");
assert(accuracyFirst.difficulty <= 8, "difficulty bonus must not exceed correct-answer stars");

const draw = RocketMath.game.compareCompetition(
  { correctionRate: 80, elapsedSeconds: 30 },
  { correctionRate: 80, elapsedSeconds: 30 }
);
assert.equal(draw.winnerGroup, "draw");
assert.equal(draw.bonuses.cxy, RocketMath.game.RULES.drawBonus);

const challengerWin = RocketMath.game.compareCompetition(
  { baseStars: 10, correctionRate: 90, elapsedSeconds: 40 },
  { baseStars: 10, correctionRate: 90, elapsedSeconds: 35 }
);
assert.equal(challengerWin.winnerGroup, "challenger");

const difficultyAdjustedWin = RocketMath.game.compareCompetition(
  { baseStars: 15, correctionRate: 80, averageCorrectSeconds: 8 },
  { baseStars: 14, correctionRate: 100, averageCorrectSeconds: 4 }
);
assert.equal(difficultyAdjustedWin.winnerGroup, "cxy", "difficulty-adjusted stars should decide first");

progress = storage.recordConfig(recorded.progress, {
  groupName: "cxy",
  operationSet: "add-sub",
  difficulty: "hard",
  rangeMax: 20
});
assert.equal(progress.configs.cxy.difficulty, "hard");
assert.equal(progress.configs.cxy.rangeMax, 20);

memory.clear();
localStorage.setItem(storage.LEGACY_STORAGE_KEY, JSON.stringify({
  starsEarned: 77,
  groupStats: {
    cxy: { gamesPlayed: 2 },
    cxr: { gamesPlayed: 3, lastCorrect: 7, lastTotal: 10 }
  },
  wrongQuestions: [{ question: "12 x 4", correct: 48, chosen: 36, group: "cxr" }]
}));
const migrated = storage.loadProgress();
assert.equal(migrated.totalStars, 77);
assert.equal(migrated.groupStats.challenger.gamesPlayed, 3);
assert.equal(migrated.wrongQuestions[0].groupName, "challenger");
assert(localStorage.getItem(storage.STORAGE_KEY), "migration should save the new schema");
storage.resetProgress();
assert.equal(localStorage.getItem(storage.STORAGE_KEY), null);
assert.equal(localStorage.getItem(storage.LEGACY_STORAGE_KEY), null);

console.log(`Core tests passed: ${generatedCount} generated questions across every configuration.`);
