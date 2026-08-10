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

let dailyProgress = storage.createDefaultProgress();
for (let mission = 1; mission <= 3; mission += 1) {
  const dailyRecorded = storage.recordGameResult(dailyProgress, {
    ...result,
    sessionId: `daily-${mission}`,
    baseStars: 0,
    playedAt: "2026-08-09"
  });
  assert.equal(dailyRecorded.dailyGoalBonus, 0, "the first 30 questions should not earn an extra star");
  dailyProgress = dailyRecorded.progress;
}
let dailyRecorded = storage.recordGameResult(dailyProgress, {
  ...result,
  sessionId: "daily-4",
  baseStars: 0,
  playedAt: "2026-08-09"
});
assert.equal(dailyRecorded.dailyGoalBonus, 1, "questions 31-40 should earn one extra star");
assert.equal(dailyRecorded.progress.totalStars, 1);
dailyRecorded = storage.recordGameResult(dailyRecorded.progress, {
  ...result,
  sessionId: "daily-5",
  baseStars: 0,
  playedAt: "2026-08-09"
});
assert.equal(dailyRecorded.dailyGoalBonus, 1, "questions 41-50 should earn another extra star");
assert.equal(dailyRecorded.progress.totalStars, 2);
const challengerDaily = storage.recordGameResult(dailyRecorded.progress, {
  ...result,
  sessionId: "challenger-daily-1",
  groupName: "challenger",
  baseStars: 0,
  playedAt: "2026-08-09"
});
assert.equal(challengerDaily.dailyGoalBonus, 0, "each group should have an independent daily goal");

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

const practiceBasis = RocketMath.game.computeRewards({
  mode: "practice",
  groupName: "cxy",
  operationSet: "add-sub",
  difficulty: "easy",
  rangeMax: 10,
  correctCount: 10,
  totalQuestions: 10
});
assert.deepEqual(JSON.parse(JSON.stringify(practiceBasis)), {
  completion: 0,
  perfect: 5,
  accuracy: 0,
  operations: 0,
  difficulty: 0,
  range: 0,
  total: 5
});
const practiceMaximum = RocketMath.game.computeRewards({
  mode: "practice",
  groupName: "cxy",
  operationSet: "all",
  difficulty: "hard",
  rangeMax: 20,
  correctCount: 10,
  totalQuestions: 10
});
assert.equal(practiceMaximum.total, 11, "perfect practice should add all three option levels to the 5-star basis");
const imperfectPractice = RocketMath.game.computeRewards({
  mode: "practice",
  groupName: "cxy",
  operationSet: "all",
  difficulty: "hard",
  rangeMax: 20,
  correctCount: 9,
  totalQuestions: 10
});
assert.equal(imperfectPractice.total, 0, "practice stars require a perfect first attempt");

const pausedPractice = RocketMath.game.computeRewards({
  mode: "practice",
  groupName: "cxy",
  operationSet: "all",
  difficulty: "hard",
  rangeMax: 20,
  correctCount: 3,
  totalQuestions: 3,
  partial: true
});
assert.equal(pausedPractice.total, 0, "a partial practice must not receive the full-mission perfect award");

const pausedSummary = storage.recordGameResult(storage.createDefaultProgress(), {
  ...result,
  sessionId: "paused-zero",
  totalQuestions: 0,
  correctCount: 0,
  baseStars: 0,
  partial: true
}).progress.practiceHistory[0];
assert.equal(pausedSummary.totalQuestions, 0, "a zero-answer partial mission must stay 0/0 in its summary");
assert.equal(pausedSummary.partial, true);

const competitionBasis = RocketMath.game.computeRewards({
  mode: "competition",
  groupName: "cxy",
  operationSet: "add-sub",
  difficulty: "easy",
  rangeMax: 10,
  correctCount: 10,
  totalQuestions: 10
});
assert.equal(competitionBasis.total, 13, "competition basis should be 10 plus 3 for a perfect score");
const competitionTwoWrongMaximum = RocketMath.game.computeRewards({
  mode: "competition",
  groupName: "challenger",
  operationSet: "all",
  difficulty: "hard",
  rangeMax: 30,
  correctCount: 8,
  totalQuestions: 10
});
assert.deepEqual(JSON.parse(JSON.stringify(competitionTwoWrongMaximum)), {
  completion: 10,
  perfect: 0,
  accuracy: 1,
  operations: 2,
  difficulty: 2,
  range: 2,
  total: 17
});

const draw = RocketMath.game.compareCompetition(
  { baseStars: 13, correctCount: 10, totalQuestions: 10, elapsedSeconds: 30 },
  { baseStars: 13, correctCount: 10, totalQuestions: 10, elapsedSeconds: 30 }
);
assert.equal(draw.winnerGroup, "draw");
assert.deepEqual(JSON.parse(JSON.stringify(draw.bonuses)), { cxy: 0, challenger: 0 });

const challengerWin = RocketMath.game.compareCompetition(
  { baseStars: 13, correctCount: 10, totalQuestions: 10, elapsedSeconds: 40 },
  { baseStars: 13, correctCount: 10, totalQuestions: 10, elapsedSeconds: 35 }
);
assert.equal(challengerWin.winnerGroup, "challenger");
assert.equal(challengerWin.bonuses.challenger, 2);

const perfectFirstWin = RocketMath.game.compareCompetition(
  { baseStars: 13, correctCount: 10, totalQuestions: 10, elapsedSeconds: 40 },
  { baseStars: 18, correctCount: 9, totalQuestions: 10, elapsedSeconds: 30 }
);
assert.equal(perfectFirstWin.winnerGroup, "cxy", "the only perfect pilot must win even with fewer stars");
const dailyBonusWin = RocketMath.game.compareCompetition(
  { baseStars: 10, dailyGoalBonus: 3, correctCount: 7, totalQuestions: 10, elapsedSeconds: 40 },
  { baseStars: 10, dailyGoalBonus: 0, correctCount: 7, totalQuestions: 10, elapsedSeconds: 30 }
);
assert.equal(dailyBonusWin.winnerGroup, "cxy", "all displayed competition stars should count when neither pilot is perfect");

let competitionProgress = storage.createDefaultProgress();
const competitionCxy = {
  ...result,
  sessionId: "competition-cxy",
  mode: "competition",
  correctCount: 10,
  totalQuestions: 10,
  baseStars: 13,
  elapsedSeconds: 30,
  rewards: competitionBasis
};
const competitionChallenger = {
  ...competitionCxy,
  sessionId: "competition-challenger",
  groupName: "challenger",
  rangeMax: 15,
  elapsedSeconds: 40
};
competitionProgress = storage.recordGameResult(competitionProgress, competitionCxy).progress;
competitionProgress = storage.recordGameResult(competitionProgress, competitionChallenger).progress;
const storedComparison = RocketMath.game.compareCompetition(competitionCxy, competitionChallenger);
competitionProgress = storage.recordCompetition(competitionProgress, {
  id: "competition-one",
  playedAt: result.playedAt,
  winner: storedComparison.winner,
  winnerGroup: storedComparison.winnerGroup,
  bonuses: storedComparison.bonuses,
  cxy: competitionCxy,
  challenger: competitionChallenger
});
assert.equal(competitionProgress.totalStars, 28, "competition totals should include the faster pilot's 2 stars");
assert.equal(competitionProgress.groupStars.cxy, 15);
assert.equal(competitionProgress.competitionTurnHistory.find((item) => item.groupName === "cxy").speedStars, 2);

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
