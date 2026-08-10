(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};
  const STORAGE_KEY = "mathRocket.progress.v2";
  const LEGACY_STORAGE_KEY = "multiplicationRocket.progress.v1";
  const HISTORY_LIMIT = 2000;
  const COMPETITION_LIMIT = 500;
  const WRONG_QUESTION_LIMIT = 60;
  let pendingServerProgress = null;
  let serverSaveTimer = null;
  let progressMergeListener = null;
  let progressSyncPromise = null;
  let serverPersistenceAvailable = null;

  function createEmptyStats() {
    return {
      gamesPlayed: 0,
      totalTime: 0,
      totalCorrect: 0,
      totalQuestions: 0,
      bestScore: 0,
      bestRate: 0,
      lastTime: 0,
      lastCorrect: 0,
      lastTotal: 0,
      lastRate: 0,
      lastPlayedDate: ""
    };
  }

  function createDefaultProgress() {
    return {
      version: 4,
      revision: 0,
      updatedAt: "",
      totalStars: 0,
      groupStars: { cxy: 0, challenger: 0 },
      configs: {
        cxy: { groupName: "cxy", operationSet: "add-sub", difficulty: "easy", rangeMax: 10 },
        challenger: { groupName: "challenger", operationSet: "add-sub", difficulty: "medium", rangeMax: 25 }
      },
      bestScore: 0,
      groupStats: { cxy: createEmptyStats(), challenger: createEmptyStats() },
      practiceHistory: [],
      competitionTurnHistory: [],
      competitionHistory: [],
      lastResults: {},
      wrongQuestions: [],
      completedRetries: [],
      retryHistory: [],
      lastPlayedDate: "",
      gamesPlayed: 0,
      legacyWeakTables: {}
    };
  }

  function loadProgress() {
    try {
      const current = window.localStorage.getItem(STORAGE_KEY);
      if (current) return normalizeProgress(JSON.parse(current));

      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const migrated = migrateLegacyProgress(JSON.parse(legacy));
        saveLocalProgress(migrated);
        return migrated;
      }
    } catch (error) {
      // Corrupt or unavailable local storage must never prevent play.
    }

    return createDefaultProgress();
  }

  function saveProgress(progress) {
    const normalized = normalizeProgress(progress);
    saveLocalProgress(normalized);
    scheduleServerSave(normalized);
    return normalized;
  }

  function saveLocalProgress(progress) {
    const normalized = normalizeProgress(progress);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      // Private browsing or full storage should not stop the child from playing.
    }
    return normalized;
  }

  async function loadServerProgress(fallbackProgress) {
    const fallback = normalizeProgress(fallbackProgress);
    if (!canUseProgressServer()) return fallback;

    const response = await window.fetch(getProgressApiUrl(), {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (response.status === 404) {
      serverPersistenceAvailable = false;
      throw new Error("Shared progress server is not available on this host.");
    }
    if (response.status === 204) {
      serverPersistenceAvailable = true;
      return (await saveProgressToServer(fallback)) || fallback;
    }
    if (!response.ok) throw new Error(`Progress server returned ${response.status}.`);
    serverPersistenceAvailable = true;
    const remote = normalizeProgress(await response.json());
    // Upload the device snapshot too: it may contain missions completed while offline.
    try {
      const combined = await saveProgressToServer(fallback);
      return combined && typeof combined === "object" ? combined : saveLocalProgress(remote);
    } catch (error) {
      return saveLocalProgress(remote);
    }
  }

  function scheduleServerSave(progress) {
    if (!canUseProgressServer()) return;
    pendingServerProgress = normalizeProgress(progress);
    if (serverSaveTimer) window.clearTimeout(serverSaveTimer);
    serverSaveTimer = window.setTimeout(() => {
      const queued = pendingServerProgress;
      pendingServerProgress = null;
      serverSaveTimer = null;
      saveProgressToServer(queued).catch(() => {
        // Local storage remains the offline fallback when the server is unavailable.
      });
    }, 180);
  }

  async function saveProgressToServer(progress) {
    if (!progress || !canUseProgressServer()) return false;
    const response = await window.fetch(getProgressApiUrl(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizeProgress(progress))
    });
    if (response.status === 404) {
      serverPersistenceAvailable = false;
      throw new Error("Shared progress server is not available on this host.");
    }
    if (!response.ok) throw new Error(`Progress server returned ${response.status}.`);
    serverPersistenceAvailable = true;
    const payload = await response.json().catch(() => null);
    if (!payload || !payload.progress) return true;
    const merged = normalizeProgress(payload.progress);
    // Do not replace a newer unsent local snapshot with an older server response.
    if (!pendingServerProgress) {
      saveLocalProgress(merged);
      if (typeof progressMergeListener === "function") progressMergeListener(merged);
    }
    return merged;
  }

  function syncServerProgress() {
    if (!canUseProgressServer()) return Promise.resolve(loadProgress());
    if (progressSyncPromise) return progressSyncPromise;
    progressSyncPromise = (async () => {
      await flushServerSave();
      const local = loadProgress();
      const merged = await saveProgressToServer(local);
      return merged && typeof merged === "object" ? merged : local;
    })().finally(() => {
      progressSyncPromise = null;
    });
    return progressSyncPromise;
  }

  function canUseProgressServer() {
    return serverPersistenceAvailable !== false
      && typeof window.fetch === "function"
      && /^https?:$/.test(window.location.protocol);
  }

  function getProgressApiUrl() {
    const configured = typeof window.MATH_ROCKET_API_URL === "string"
      ? window.MATH_ROCKET_API_URL.trim()
      : "";
    return configured || "./api/progress";
  }

  function setProgressMergeListener(listener) {
    progressMergeListener = typeof listener === "function" ? listener : null;
  }

  async function flushServerSave() {
    if (!pendingServerProgress) return true;
    if (serverSaveTimer) window.clearTimeout(serverSaveTimer);
    const queued = pendingServerProgress;
    pendingServerProgress = null;
    serverSaveTimer = null;
    return saveProgressToServer(queued);
  }

  function resetProgress() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      // Ignore storage errors and keep the game playable.
    }

    return createDefaultProgress();
  }

  function missionKey(result) {
    return [
      result.mode === "competition" ? "competition" : "practice",
      normalizeGroupName(result.groupName),
      result.operationSet || "add-sub",
      result.difficulty || "medium",
      Number(result.rangeMax) || 10
    ].join("|");
  }

  function getPreviousResult(progress, result) {
    const normalized = normalizeProgress(progress);
    return normalized.lastResults[missionKey(result)] || null;
  }

  function recordGameResult(currentProgress, result) {
    const progress = normalizeProgress(currentProgress);
    const key = missionKey(result);
    const previous = progress.lastResults[key] || null;
    const groupName = normalizeGroupName(result.groupName);
    const historyName = result.mode === "competition" ? "competitionTurnHistory" : "practiceHistory";
    const baseStars = Number(result.baseStars) || 0;
    const dailyGoalBonus = calculateDailyGoalBonus(progress, {
      groupName,
      playedAt: result.playedAt,
      totalQuestions: result.totalQuestions
    });
    const summary = summarizeResult({ ...result, dailyGoalBonus });

    progress[historyName] = [summary, ...progress[historyName]].slice(0, HISTORY_LIMIT);
    progress.lastResults[key] = summary;
    progress.totalStars += baseStars + dailyGoalBonus;
    progress.groupStars[groupName] += baseStars + dailyGoalBonus;
    progress.bestScore = Math.max(progress.bestScore, baseStars + dailyGoalBonus);
    progress.lastPlayedDate = result.playedAt || "";
    progress.gamesPlayed += 1;
    progress.wrongQuestions = [
      ...(Array.isArray(result.wrongAnswers) ? result.wrongAnswers.map((item) => normalizeWrongQuestion(item, summary)) : []),
      ...progress.wrongQuestions
    ].slice(0, WRONG_QUESTION_LIMIT);

    updateGroupStats(progress, result);
    saveProgress(progress);
    return { progress, previous, dailyGoalBonus };
  }

  function calculateDailyGoalBonus(progress, result) {
    const groupName = normalizeGroupName(result.groupName);
    const playedAt = result.playedAt || "";
    const questions = Math.max(0, Number(result.totalQuestions) || 0);
    if (!playedAt || !questions) return 0;
    const history = [...progress.practiceHistory, ...progress.competitionTurnHistory];
    const questionsBefore = history
      .filter((item) => item.groupName === groupName && item.playedAt === playedAt)
      .reduce((sum, item) => sum + Math.max(0, Number(item.totalQuestions) || 0), 0);
    const bonusBefore = extraQuestionStars(questionsBefore);
    const bonusAfter = extraQuestionStars(questionsBefore + questions);
    return Math.max(0, bonusAfter - bonusBefore);
  }

  function extraQuestionStars(questionCount) {
    return Math.ceil(Math.max(0, Number(questionCount) - 30) / 10);
  }

  function recordRetryBonus(currentProgress, retry) {
    const progress = normalizeProgress(currentProgress);
    const retryId = String(retry.retryId || "");
    const groupName = normalizeGroupName(retry.groupName);
    const requestedStars = Math.max(0, Number(retry.stars) || 0);

    if (!retryId || progress.completedRetries.includes(retryId)) {
      return { progress, awarded: 0 };
    }

    progress.completedRetries = [retryId, ...progress.completedRetries].slice(0, 4000);
    progress.totalStars += requestedStars;
    progress.groupStars[groupName] += requestedStars;
    progress.retryHistory = [{
      retryId,
      groupName,
      mode: retry.mode === "competition" ? "competition" : "practice",
      stars: requestedStars,
      completedAt: retry.completedAt || ""
    }, ...progress.retryHistory].slice(0, HISTORY_LIMIT);
    progress.wrongQuestions = progress.wrongQuestions.map((item) => (
      item.id === retryId ? { ...item, reviewed: true } : item
    ));

    saveProgress(progress);
    return { progress, awarded: requestedStars };
  }

  function recordCompetition(currentProgress, competitionResult) {
    const progress = normalizeProgress(currentProgress);
    const competitionId = String(competitionResult.id || "");
    const alreadyRecorded = progress.competitionHistory.some((item) => item.id === competitionId);
    if (competitionId && alreadyRecorded) return progress;

    const bonuses = competitionResult.bonuses || {};
    ["cxy", "challenger"].forEach((groupName) => {
      const bonus = Math.max(0, Number(bonuses[groupName]) || 0);
      progress.groupStars[groupName] += bonus;
      progress.totalStars += bonus;
    });

    progress.competitionTurnHistory = progress.competitionTurnHistory.map((turn) => {
      const result = competitionResult[turn.groupName];
      if (!result || turn.sessionId !== result.sessionId) return turn;
      return { ...turn, speedStars: Math.max(0, Number(bonuses[turn.groupName]) || 0) };
    });

    progress.competitionHistory = [
      normalizeCompetition(competitionResult),
      ...progress.competitionHistory
    ].slice(0, COMPETITION_LIMIT);
    saveProgress(progress);
    return progress;
  }

  function recordConfig(currentProgress, config) {
    const progress = normalizeProgress(currentProgress);
    const groupName = normalizeGroupName(config && config.groupName);
    progress.configs[groupName] = normalizeConfig(config, groupName);
    return saveProgress(progress);
  }

  function updateGroupStats(progress, result) {
    const groupName = normalizeGroupName(result.groupName);
    const stats = progress.groupStats[groupName] || createEmptyStats();

    stats.gamesPlayed += 1;
    stats.totalTime += Number(result.elapsedSeconds) || 0;
    stats.totalCorrect += Number(result.correctCount) || 0;
    stats.totalQuestions += Number(result.totalQuestions) || 0;
    stats.bestScore = Math.max(stats.bestScore, Number(result.baseStars) || 0);
    stats.bestRate = Math.max(stats.bestRate, Number(result.correctionRate) || 0);
    stats.lastTime = Number(result.elapsedSeconds) || 0;
    stats.lastCorrect = Number(result.correctCount) || 0;
    stats.lastTotal = Number(result.totalQuestions) || 0;
    stats.lastRate = Number(result.correctionRate) || 0;
    stats.lastPlayedDate = result.playedAt || "";
    progress.groupStats[groupName] = stats;
  }

  function summarizeResult(result) {
    const totalQuestions = Number(result.totalQuestions);
    return {
      sessionId: String(result.sessionId || ""),
      mode: result.mode === "competition" ? "competition" : "practice",
      groupName: normalizeGroupName(result.groupName),
      operationSet: result.operationSet || "add-sub",
      difficulty: result.difficulty || "medium",
      rangeMax: Number(result.rangeMax) || 10,
      correctCount: Number(result.correctCount) || 0,
      totalQuestions: Number.isFinite(totalQuestions) && totalQuestions >= 0 ? totalQuestions : 10,
      correctionRate: Number(result.correctionRate) || 0,
      elapsedSeconds: Number(result.elapsedSeconds) || 0,
      averageCorrectSeconds: Number(result.averageCorrectSeconds) || 0,
      maxStreak: Math.max(0, Number(result.maxStreak) || 0),
      difficultyMultiplier: Math.max(1, Number(result.difficultyMultiplier) || 1),
      rewards: normalizeRewards(result.rewards),
      baseStars: Number(result.baseStars) || 0,
      retryStars: Number(result.retryStars) || 0,
      speedStars: Math.max(0, Number(result.speedStars) || 0),
      dailyGoalBonus: Math.max(0, Number(result.dailyGoalBonus) || 0),
      playedAt: result.playedAt || "",
      partial: Boolean(result.partial),
      forfeited: Boolean(result.forfeited),
      forfeitAward: Boolean(result.forfeitAward)
    };
  }

  function normalizeWrongQuestion(item, summary) {
    const question = item.questionData || {};
    return {
      id: String(item.id || ""),
      expression: item.expression || item.question || "",
      correct: Number(item.correct),
      chosen: Number(item.chosen),
      groupName: normalizeGroupName(item.groupName || item.group || summary.groupName),
      operators: Array.isArray(question.operators) ? question.operators : [],
      operationSet: summary.operationSet,
      difficulty: summary.difficulty,
      rangeMax: summary.rangeMax,
      playedAt: summary.playedAt,
      reviewed: Boolean(item.reviewed)
    };
  }

  function normalizeCompetition(item) {
    return {
      id: String(item.id || ""),
      playedAt: item.playedAt || "",
      winner: item.winner || "Draw",
      winnerGroup: item.winnerGroup || "draw",
      bonuses: {
        cxy: Math.max(0, Number(item.bonuses && item.bonuses.cxy) || 0),
        challenger: Math.max(0, Number(item.bonuses && item.bonuses.challenger) || 0)
      },
      cxy: item.cxy ? summarizeResult(item.cxy) : null,
      challenger: item.challenger ? summarizeResult(item.challenger) : null
    };
  }

  function getFocusAreas(progress, maxItems) {
    const counts = {};
    const names = { add: "addition", subtract: "subtraction", multiply: "multiplication", divide: "division" };

    normalizeProgress(progress).wrongQuestions.forEach((item) => {
      item.operators.forEach((operator) => {
        counts[operator] = (counts[operator] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, Number(maxItems) || 3)
      .map(([operator, count]) => ({ operator, label: names[operator] || operator, count }));
  }

  function normalizeProgress(value) {
    const source = value && typeof value === "object" ? value : {};
    const defaults = createDefaultProgress();
    const oldGroups = source.groupStats && typeof source.groupStats === "object" ? source.groupStats : {};
    const challengerStats = oldGroups.challenger || oldGroups.cxr || {};
    const sourceGroupStars = source.groupStars && typeof source.groupStars === "object" ? source.groupStars : {};

    return {
      version: 4,
      revision: Math.max(0, Number(source.revision) || 0),
      updatedAt: source.updatedAt || "",
      totalStars: Math.max(0, Number(source.totalStars != null ? source.totalStars : source.starsEarned) || 0),
      groupStars: {
        cxy: Math.max(0, Number(sourceGroupStars.cxy) || 0),
        challenger: Math.max(0, Number(sourceGroupStars.challenger != null ? sourceGroupStars.challenger : sourceGroupStars.cxr) || 0)
      },
      bestScore: Math.max(0, Number(source.bestScore) || 0),
      groupStats: {
        cxy: { ...createEmptyStats(), ...(oldGroups.cxy || {}) },
        challenger: { ...createEmptyStats(), ...challengerStats }
      },
      configs: {
        cxy: normalizeConfig(source.configs && source.configs.cxy, "cxy"),
        challenger: normalizeConfig(source.configs && (source.configs.challenger || source.configs.cxr), "challenger")
      },
      practiceHistory: normalizeArray(source.practiceHistory, HISTORY_LIMIT),
      competitionTurnHistory: normalizeArray(source.competitionTurnHistory, HISTORY_LIMIT),
      competitionHistory: normalizeArray(source.competitionHistory, COMPETITION_LIMIT),
      lastResults: source.lastResults && typeof source.lastResults === "object" ? { ...source.lastResults } : {},
      wrongQuestions: normalizeArray(source.wrongQuestions, WRONG_QUESTION_LIMIT).map((item) => ({
        ...item,
        id: String(item.id || ""),
        groupName: normalizeGroupName(item.groupName || item.group),
        operators: Array.isArray(item.operators) ? item.operators : [],
        reviewed: Boolean(item.reviewed)
      })),
      completedRetries: normalizeArray(source.completedRetries, 4000).map(String),
      retryHistory: normalizeArray(source.retryHistory, HISTORY_LIMIT),
      lastPlayedDate: source.lastPlayedDate || "",
      gamesPlayed: Math.max(0, Number(source.gamesPlayed) || 0),
      legacyWeakTables: source.legacyWeakTables && typeof source.legacyWeakTables === "object"
        ? { ...source.legacyWeakTables }
        : (source.weakTables && typeof source.weakTables === "object" ? { ...source.weakTables } : defaults.legacyWeakTables)
    };
  }

  function migrateLegacyProgress(legacy) {
    const migrated = normalizeProgress(legacy);
    migrated.version = 4;
    migrated.wrongQuestions = migrated.wrongQuestions.map((item, index) => ({
      ...item,
      id: item.id || `legacy-${index}-${item.playedAt || "unknown"}`,
      expression: item.expression || item.question || "",
      groupName: normalizeGroupName(item.groupName || item.group)
    }));
    return migrated;
  }

  function normalizeGroupName(groupName) {
    return groupName === "challenger" || groupName === "cxr" ? "challenger" : "cxy";
  }

  function normalizeConfig(config, groupName) {
    const source = config && typeof config === "object" ? config : {};
    const normalizedGroup = normalizeGroupName(groupName || source.groupName);
    const validDifficulties = ["easy", "medium", "hard"];
    const validOperations = ["add-sub", "mul-div", "all"];
    const ranges = normalizedGroup === "challenger" ? [15, 25, 30] : [10, 15, 20];
    const defaultDifficulty = normalizedGroup === "challenger" ? "medium" : "easy";
    const defaultRange = normalizedGroup === "challenger" ? 25 : 10;
    const rangeMax = Number(source.rangeMax);

    return {
      groupName: normalizedGroup,
      operationSet: validOperations.includes(source.operationSet) ? source.operationSet : "add-sub",
      difficulty: validDifficulties.includes(source.difficulty) ? source.difficulty : defaultDifficulty,
      rangeMax: ranges.includes(rangeMax) ? rangeMax : defaultRange
    };
  }

  function normalizeRewards(rewards) {
    const source = rewards && typeof rewards === "object" ? rewards : {};
    return {
      completion: Math.max(0, Number(source.completion) || 0),
      perfect: Math.max(0, Number(source.perfect) || 0),
      correct: Math.max(0, Number(source.correct) || 0),
      accuracy: Math.max(0, Number(source.accuracy) || 0),
      operations: Math.max(0, Number(source.operations) || 0),
      range: Math.max(0, Number(source.range) || 0),
      accuracyImprovement: Math.max(0, Number(source.accuracyImprovement) || 0),
      speedImprovement: Math.max(0, Number(source.speedImprovement) || 0),
      streak: Math.max(0, Number(source.streak) || 0),
      difficulty: Math.max(0, Number(source.difficulty) || 0),
      total: Math.max(0, Number(source.total) || 0)
    };
  }

  function normalizeArray(value, limit) {
    return Array.isArray(value) ? value.slice(0, limit) : [];
  }

  RocketMath.storage = {
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    createDefaultProgress,
    loadProgress,
    loadServerProgress,
    saveProgress,
    flushServerSave,
    syncServerProgress,
    setProgressMergeListener,
    resetProgress,
    missionKey,
    getPreviousResult,
    recordGameResult,
    recordRetryBonus,
    recordCompetition,
    recordConfig,
    getFocusAreas,
    normalizeProgress
  };

  window.RocketMath = RocketMath;
})();
