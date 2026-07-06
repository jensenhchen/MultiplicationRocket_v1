(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};
  const STORAGE_KEY = "multiplicationRocket.progress.v1";

  const defaultProgress = {
    bestScore: 0,
    starsEarned: 0,
    wrongQuestions: [],
    weakTables: {},
    groupStats: createDefaultGroupStats(),
    competitionHistory: [],
    lastPlayedDate: "",
    gamesPlayed: 0
  };

  function createDefaultGroupStats() {
    return {
      cxy: createEmptyStats(),
      cxr: createEmptyStats()
    };
  }

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

  function loadProgress() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return { ...defaultProgress };

      return normalizeProgress(JSON.parse(saved));
    } catch (error) {
      return { ...defaultProgress };
    }
  }

  function saveProgress(progress) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeProgress(progress)));
    } catch (error) {
      // Private browsing or full storage should not stop the child from playing.
    }
  }

  function resetProgress() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Ignore storage errors and keep the game playable.
    }

    return { ...defaultProgress };
  }

  function recordGameResult(currentProgress, result) {
    const progress = normalizeProgress(currentProgress);
    const wrongQuestions = result.wrongAnswers.map((item) => ({
      question: item.question,
      correct: item.correct,
      chosen: item.chosen,
      table: item.table,
      group: result.groupName || "cxy",
      playedAt: result.playedAt
    }));

    wrongQuestions.forEach((item) => {
      progress.weakTables[item.table] = (progress.weakTables[item.table] || 0) + 1;
    });

    progress.bestScore = Math.max(progress.bestScore, result.score);
    progress.starsEarned += result.score;
    progress.wrongQuestions = [...wrongQuestions, ...progress.wrongQuestions].slice(0, 20);
    progress.lastPlayedDate = result.playedAt;
    progress.gamesPlayed += 1;
    updateGroupStats(progress, result);

    saveProgress(progress);
    return progress;
  }

  function updateGroupStats(progress, result) {
    const groupName = result.groupName || "cxy";
    const stats = progress.groupStats[groupName] || createEmptyStats();

    stats.gamesPlayed += 1;
    stats.totalTime += result.elapsedSeconds;
    stats.totalCorrect += result.correctCount;
    stats.totalQuestions += result.totalQuestions;
    stats.bestScore = Math.max(stats.bestScore, result.score);
    stats.bestRate = Math.max(stats.bestRate, result.correctionRate);
    stats.lastTime = result.elapsedSeconds;
    stats.lastCorrect = result.correctCount;
    stats.lastTotal = result.totalQuestions;
    stats.lastRate = result.correctionRate;
    stats.lastPlayedDate = result.playedAt;
    progress.groupStats[groupName] = stats;
  }

  function recordCompetition(currentProgress, competitionResult) {
    const progress = normalizeProgress(currentProgress);
    progress.competitionHistory = [competitionResult, ...progress.competitionHistory].slice(0, 10);
    saveProgress(progress);
    return progress;
  }

  function getWeakTables(progress, maxItems) {
    return Object.entries(normalizeProgress(progress).weakTables)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxItems)
      .map(([table, count]) => ({ table: Number(table), count }));
  }

  function normalizeProgress(progress) {
    const groupStats = {
      cxy: { ...createEmptyStats(), ...(progress.groupStats && progress.groupStats.cxy ? progress.groupStats.cxy : {}) },
      cxr: { ...createEmptyStats(), ...(progress.groupStats && progress.groupStats.cxr ? progress.groupStats.cxr : {}) }
    };

    return {
      bestScore: Number(progress.bestScore) || 0,
      starsEarned: Number(progress.starsEarned) || 0,
      wrongQuestions: Array.isArray(progress.wrongQuestions) ? progress.wrongQuestions : [],
      weakTables: progress.weakTables && typeof progress.weakTables === "object" ? progress.weakTables : {},
      groupStats,
      competitionHistory: Array.isArray(progress.competitionHistory) ? progress.competitionHistory : [],
      lastPlayedDate: progress.lastPlayedDate || "",
      gamesPlayed: Number(progress.gamesPlayed) || 0
    };
  }

  RocketMath.storage = {
    loadProgress,
    saveProgress,
    resetProgress,
    recordGameResult,
    recordCompetition,
    getWeakTables
  };

  window.RocketMath = RocketMath;
})();
