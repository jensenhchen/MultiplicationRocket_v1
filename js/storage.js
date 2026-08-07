(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};
  const STORAGE_KEY = "mathRocket.progress.v2";
  const LEGACY_STORAGE_KEY = "multiplicationRocket.progress.v1";
  const HISTORY_LIMIT = 60;
  const COMPETITION_LIMIT = 24;
  const WRONG_QUESTION_LIMIT = 60;

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
      version: 2,
      totalStars: 0,
      groupStars: { cxy: 0, challenger: 0 },
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
        saveProgress(migrated);
        return migrated;
      }
    } catch (error) {
      // Corrupt or unavailable local storage must never prevent play.
    }

    return createDefaultProgress();
  }

  function saveProgress(progress) {
    const normalized = normalizeProgress(progress);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      // Private browsing or full storage should not stop the child from playing.
    }
    return normalized;
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
    const summary = summarizeResult(result);
    const groupName = normalizeGroupName(result.groupName);
    const historyName = result.mode === "competition" ? "competitionTurnHistory" : "practiceHistory";
    const baseStars = Number(result.baseStars) || 0;

    progress[historyName] = [summary, ...progress[historyName]].slice(0, HISTORY_LIMIT);
    progress.lastResults[key] = summary;
    progress.totalStars += baseStars;
    progress.groupStars[groupName] += baseStars;
    progress.bestScore = Math.max(progress.bestScore, baseStars);
    progress.lastPlayedDate = result.playedAt || "";
    progress.gamesPlayed += 1;
    progress.wrongQuestions = [
      ...(Array.isArray(result.wrongAnswers) ? result.wrongAnswers.map((item) => normalizeWrongQuestion(item, summary)) : []),
      ...progress.wrongQuestions
    ].slice(0, WRONG_QUESTION_LIMIT);

    updateGroupStats(progress, result);
    saveProgress(progress);
    return { progress, previous };
  }

  function recordRetryBonus(currentProgress, retry) {
    const progress = normalizeProgress(currentProgress);
    const retryId = String(retry.retryId || "");
    const groupName = normalizeGroupName(retry.groupName);
    const requestedStars = Math.max(0, Number(retry.stars) || 0);

    if (!retryId || progress.completedRetries.includes(retryId)) {
      return { progress, awarded: 0 };
    }

    progress.completedRetries = [retryId, ...progress.completedRetries].slice(0, 200);
    progress.totalStars += requestedStars;
    progress.groupStars[groupName] += requestedStars;
    progress.retryHistory = [{
      retryId,
      groupName,
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

    progress.competitionHistory = [
      normalizeCompetition(competitionResult),
      ...progress.competitionHistory
    ].slice(0, COMPETITION_LIMIT);
    saveProgress(progress);
    return progress;
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
    return {
      sessionId: String(result.sessionId || ""),
      mode: result.mode === "competition" ? "competition" : "practice",
      groupName: normalizeGroupName(result.groupName),
      operationSet: result.operationSet || "add-sub",
      difficulty: result.difficulty || "medium",
      rangeMax: Number(result.rangeMax) || 10,
      correctCount: Number(result.correctCount) || 0,
      totalQuestions: Number(result.totalQuestions) || 10,
      correctionRate: Number(result.correctionRate) || 0,
      elapsedSeconds: Number(result.elapsedSeconds) || 0,
      baseStars: Number(result.baseStars) || 0,
      retryStars: Number(result.retryStars) || 0,
      playedAt: result.playedAt || ""
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
      version: 2,
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
      completedRetries: normalizeArray(source.completedRetries, 200).map(String),
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
    migrated.version = 2;
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

  function normalizeArray(value, limit) {
    return Array.isArray(value) ? value.slice(0, limit) : [];
  }

  RocketMath.storage = {
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    createDefaultProgress,
    loadProgress,
    saveProgress,
    resetProgress,
    missionKey,
    getPreviousResult,
    recordGameResult,
    recordRetryBonus,
    recordCompetition,
    getFocusAreas,
    normalizeProgress
  };

  window.RocketMath = RocketMath;
})();
