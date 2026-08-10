(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};
  const RULES = Object.freeze({
    totalQuestions: 10,
    practicePerfectStars: 5,
    competitionCompletionStars: 10,
    competitionPerfectStars: 3,
    competitionOneWrongStars: 2,
    competitionTwoWrongStars: 1,
    competitionSpeedStars: 2,
    starsPerRetry: 1,
    answerDelayMs: 720
  });

  const encouragements = [
    "Star power! Great thinking!",
    "Rocket boost!",
    "You found it!",
    "Nice number work!",
    "Keep flying!",
    "Brilliant step!"
  ];
  const competitionProgressMessages = [
    "Fantastic progress — your competition rocket is climbing!",
    "Brilliant answer — you are building a strong lead!",
    "Great focus — another point for your mission!",
    "Congratulations on that step — keep the momentum going!"
  ];
  const competitionRecoveryMessages = [
    "Brave try! Use the hint and get ready for a strong comeback!",
    "Keep going — one tricky question cannot stop your rocket!",
    "Good effort! Reset, make ten, and come back even stronger!",
    "Almost there — every mistake is training for the next win!"
  ];

  const state = {
    config: null,
    mode: "practice",
    phase: "main",
    sessionId: "",
    questions: [],
    questionIndex: 0,
    currentQuestion: null,
    sessionStars: 0,
    correctCount: 0,
    currentStreak: 0,
    maxStreak: 0,
    streakStarEarned: false,
    correctResponseTimes: [],
    questionStartedAt: 0,
    wrongAnswers: [],
    startTime: 0,
    timerId: null,
    transitionTimerId: null,
    pausedElapsed: 0,
    pausedTransitionPending: false,
    pendingExitDestination: "",
    acceptingAnswers: false,
    progress: null,
    lastResult: null,
    competition: null,
    retry: null
  };

  function init(progress) {
    state.progress = RocketMath.storage.normalizeProgress(progress);
    RocketMath.storage.setProgressMergeListener((mergedProgress) => {
      state.progress = RocketMath.storage.normalizeProgress(mergedProgress);
      RocketMath.ui.renderProgress(state.progress);
    });
    RocketMath.ui.applyConfigs(state.progress.configs);
    RocketMath.ui.renderProgress(state.progress);
    RocketMath.ui.updateCompetitionSummaries();
    RocketMath.ui.showScreen("start");
  }

  function start(options) {
    state.competition = null;
    const config = RocketMath.questions.normalizeOptions(options);
    startMainSession(config, "practice");
  }

  function startMainSession(config, mode) {
    clearTransitionTimer();
    state.config = config;
    state.mode = mode;
    state.phase = "main";
    state.sessionId = createId(`${mode}-${config.groupName}`);
    state.questions = RocketMath.questions.createQuestionSet(config, RULES.totalQuestions);
    state.questionIndex = 0;
    state.currentQuestion = null;
    state.sessionStars = 0;
    state.correctCount = 0;
    state.currentStreak = 0;
    state.maxStreak = 0;
    state.streakStarEarned = false;
    state.correctResponseTimes = [];
    state.wrongAnswers = [];
    state.acceptingAnswers = false;
    state.retry = null;
    state.pendingExitDestination = "";
    startTimer();

    RocketMath.ui.updateScore(0);
    RocketMath.animation.moveRocket(RocketMath.ui.elements.rocket, 0);
    RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "idle");
    RocketMath.ui.showScreen("game");
    nextMainQuestion();
  }

  function startCompetition(configs) {
    const cxy = RocketMath.questions.normalizeOptions(configs && configs.cxy);
    const challenger = RocketMath.questions.normalizeOptions(configs && configs.challenger);
    state.competition = {
      id: createId("competition"),
      configs: { cxy, challenger },
      cxy: null,
      challenger: null,
      comparison: null
    };
    startMainSession(cxy, "competition");
  }

  function startNextCompetitionTurn() {
    if (!state.competition || !state.competition.cxy || state.competition.challenger) return;
    startMainSession(state.competition.configs.challenger, "competition");
  }

  function nextMainQuestion() {
    state.transitionTimerId = null;
    if (state.questionIndex >= state.questions.length) {
      endMainSession();
      return;
    }

    state.currentQuestion = state.questions[state.questionIndex];
    state.acceptingAnswers = true;
    state.questionStartedAt = Date.now();
    RocketMath.ui.renderQuestion(
      state.currentQuestion,
      state.questionIndex + 1,
      state.questions.length,
      state.sessionStars,
      getMissionLabel(),
      state.config,
      false,
      getHudState()
    );
    RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "idle");
  }

  function answer(chosenAnswer) {
    if (!state.acceptingAnswers || !state.currentQuestion) return;

    const answerNumber = Number(chosenAnswer);
    const isCorrect = answerNumber === state.currentQuestion.answer;
    state.acceptingAnswers = false;
    RocketMath.ui.setAnswerButtonsDisabled(true);
    RocketMath.ui.markAnswer(answerNumber, state.currentQuestion.answer, isCorrect);

    if (state.phase === "retry") {
      answerRetry(answerNumber, isCorrect);
      return;
    }
    answerMain(answerNumber, isCorrect);
  }

  function answerMain(answerNumber, isCorrect) {
    if (isCorrect) {
      state.correctCount += 1;
      state.currentStreak += 1;
      state.maxStreak = Math.max(state.maxStreak, state.currentStreak);
      state.correctResponseTimes.push(Math.max(100, Date.now() - state.questionStartedAt));
      RocketMath.ui.updateScore(state.sessionStars);
      RocketMath.ui.updateStreak(state.currentStreak);
      RocketMath.ui.updateCompetitionHud(getHudState());
      RocketMath.animation.moveRocket(RocketMath.ui.elements.rocket, state.correctCount / RULES.totalQuestions);
      RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "correct");
      RocketMath.audio.play("correct");
      RocketMath.audio.play("boost");
      const successMessage = state.mode === "competition"
        ? `${RocketMath.questions.getGroup(state.config.groupName).name}: ${competitionProgressMessages[randomIndex(competitionProgressMessages)]}`
        : encouragements[randomIndex(encouragements)];
      RocketMath.ui.showMessage(successMessage, state.mode === "competition" ? "success" : "neutral");
    } else {
      state.currentStreak = 0;
      RocketMath.ui.updateStreak(0);
      RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "wrong");
      RocketMath.audio.play("wrong");
      RocketMath.ui.showHint(state.currentQuestion.hint);
      const recoveryMessage = state.mode === "competition"
        ? `${RocketMath.questions.getGroup(state.config.groupName).name}: ${competitionRecoveryMessages[randomIndex(competitionRecoveryMessages)]}`
        : "Good try — use the hint. This one will come back!";
      RocketMath.ui.showMessage(recoveryMessage, state.mode === "competition" ? "encourage" : "neutral");
      state.wrongAnswers.push({
        id: `${state.sessionId}-q${state.questionIndex + 1}`,
        expression: state.currentQuestion.expression,
        correct: state.currentQuestion.answer,
        chosen: answerNumber,
        hint: state.currentQuestion.hint,
        strategy: state.currentQuestion.strategy,
        groupName: state.config.groupName,
        questionData: copyQuestion(state.currentQuestion)
      });
    }

    state.questionIndex += 1;
    state.transitionTimerId = window.setTimeout(nextMainQuestion, RULES.answerDelayMs);
  }

  function endMainSession() {
    clearTransitionTimer();
    stopTimer();
    state.acceptingAnswers = false;
    state.phase = "result";
    const result = createCurrentResult(RULES.totalQuestions, false);
    const previous = RocketMath.storage.getPreviousResult(state.progress, result);
    result.previous = previous;
    result.rewards = computeRewards(result);
    result.baseStars = result.rewards.total;
    state.lastResult = result;
    RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "complete");
    RocketMath.audio.play(state.correctCount === RULES.totalQuestions ? "applause" : "complete");
    RocketMath.ui.showScreen("result");

    if (state.mode === "competition") {
      handleCompetitionTurn(result);
      return;
    }

    const recorded = RocketMath.storage.recordGameResult(state.progress, result);
    state.progress = recorded.progress;
    result.previous = recorded.previous;
    result.dailyGoalBonus = recorded.dailyGoalBonus;
    RocketMath.ui.renderProgress(state.progress);
    RocketMath.ui.renderResult(result, state.progress, recorded.previous);
  }

  function createCurrentResult(totalQuestions, partial) {
    const elapsedSeconds = getElapsedSeconds();
    const averageCorrectSeconds = state.correctResponseTimes.length
      ? Number((state.correctResponseTimes.reduce((sum, value) => sum + value, 0)
        / state.correctResponseTimes.length / 1000).toFixed(1))
      : 0;
    const completed = Math.max(0, Number(totalQuestions) || 0);
    return {
      sessionId: state.sessionId,
      mode: state.mode,
      groupName: state.config.groupName,
      groupLabel: RocketMath.questions.getGroup(state.config.groupName).name,
      operationSet: state.config.operationSet,
      difficulty: state.config.difficulty,
      rangeMax: state.config.rangeMax,
      difficultyMultiplier: RocketMath.questions.getDifficultyMultiplier(state.config),
      correctCount: state.correctCount,
      totalQuestions: completed,
      correctionRate: completed ? Math.round((state.correctCount / completed) * 100) : 0,
      elapsedSeconds,
      averageCorrectSeconds,
      maxStreak: state.maxStreak,
      baseStars: 0,
      retryStars: 0,
      wrongAnswers: state.wrongAnswers.map((item) => ({ ...item })),
      playedAt: RocketMath.utils.todayString(),
      message: partial
        ? `Mission paused after ${completed} ${completed === 1 ? "question" : "questions"}. Every step still counts!`
        : getResultMessage(state.correctCount),
      partial: Boolean(partial)
    };
  }

  function computeRewards(result) {
    const options = getOptionStars(result);
    const isCompetition = result.mode === "competition";
    const wrongCount = Math.max(0, Number(result.totalQuestions) - Number(result.correctCount));
    const completedFullMission = Number(result.totalQuestions) >= RULES.totalQuestions;
    const accuracy = isCompetition && completedFullMission
      ? (wrongCount === 0
        ? RULES.competitionPerfectStars
        : (wrongCount === 1
          ? RULES.competitionOneWrongStars
          : (wrongCount === 2 ? RULES.competitionTwoWrongStars : 0)))
      : 0;
    const perfect = !isCompetition && completedFullMission && wrongCount === 0 ? RULES.practicePerfectStars : 0;
    const optionMultiplier = isCompetition || perfect > 0 ? 1 : 0;
    const rewards = {
      completion: isCompetition && completedFullMission ? RULES.competitionCompletionStars : 0,
      perfect,
      accuracy,
      operations: options.operations * optionMultiplier,
      difficulty: options.difficulty * optionMultiplier,
      range: options.range * optionMultiplier
    };
    rewards.total = Object.values(rewards).reduce((sum, value) => sum + value, 0);
    return rewards;
  }

  function getOptionStars(result) {
    const operationIndex = ["add-sub", "mul-div", "all"].indexOf(result.operationSet);
    const difficultyIndex = ["easy", "medium", "hard"].indexOf(result.difficulty);
    const ranges = result.groupName === "challenger" ? [15, 25, 30] : [10, 15, 20];
    const rangeIndex = ranges.indexOf(Number(result.rangeMax));
    return {
      operations: Math.max(0, operationIndex),
      difficulty: Math.max(0, difficultyIndex),
      range: Math.max(0, rangeIndex)
    };
  }

  function handleCompetitionTurn(result) {
    if (!state.competition) return;

    if (result.groupName === "cxy") {
      state.competition.cxy = result;
      RocketMath.ui.renderCompetitionPrompt(result, state.progress, result.previous);
      return;
    }

    state.competition.challenger = result;
    const cxyRecorded = RocketMath.storage.recordGameResult(state.progress, state.competition.cxy);
    state.progress = cxyRecorded.progress;
    state.competition.cxy.previous = cxyRecorded.previous;
    state.competition.cxy.dailyGoalBonus = cxyRecorded.dailyGoalBonus;
    const challengerRecorded = RocketMath.storage.recordGameResult(state.progress, state.competition.challenger);
    state.progress = challengerRecorded.progress;
    state.competition.challenger.previous = challengerRecorded.previous;
    state.competition.challenger.dailyGoalBonus = challengerRecorded.dailyGoalBonus;
    const comparison = compareCompetition(state.competition.cxy, state.competition.challenger);
    state.competition.comparison = comparison;
    state.progress = RocketMath.storage.recordCompetition(state.progress, {
      id: state.competition.id,
      playedAt: result.playedAt,
      winner: comparison.winner,
      winnerGroup: comparison.winnerGroup,
      bonuses: comparison.bonuses,
      cxy: state.competition.cxy,
      challenger: state.competition.challenger
    });
    RocketMath.ui.renderProgress(state.progress);
    RocketMath.ui.renderCompetitionResult(comparison, state.progress, state.competition);
    RocketMath.audio.play("winner");
  }

  function compareCompetition(cxy, challenger) {
    let winnerGroup = "draw";
    const cxyTime = Number(cxy.elapsedSeconds) || Infinity;
    const challengerTime = Number(challenger.elapsedSeconds) || Infinity;
    const bonuses = { cxy: 0, challenger: 0 };
    if (cxyTime < challengerTime) bonuses.cxy = RULES.competitionSpeedStars;
    else if (challengerTime < cxyTime) bonuses.challenger = RULES.competitionSpeedStars;
    cxy.speedStars = bonuses.cxy;
    challenger.speedStars = bonuses.challenger;

    const cxyPerfect = Number(cxy.correctCount) === Number(cxy.totalQuestions);
    const challengerPerfect = Number(challenger.correctCount) === Number(challenger.totalQuestions);
    const cxyStars = (Number(cxy.baseStars) || 0) + bonuses.cxy + (Number(cxy.dailyGoalBonus) || 0);
    const challengerStars = (Number(challenger.baseStars) || 0) + bonuses.challenger + (Number(challenger.dailyGoalBonus) || 0);

    if (cxyPerfect !== challengerPerfect) winnerGroup = cxyPerfect ? "cxy" : "challenger";
    else if (cxyStars > challengerStars) winnerGroup = "cxy";
    else if (challengerStars > cxyStars) winnerGroup = "challenger";
    else if (Number(cxy.correctCount) > Number(challenger.correctCount)) winnerGroup = "cxy";
    else if (Number(challenger.correctCount) > Number(cxy.correctCount)) winnerGroup = "challenger";
    else if (cxyTime < challengerTime) winnerGroup = "cxy";
    else if (challengerTime < cxyTime) winnerGroup = "challenger";

    if (winnerGroup === "draw") {
      return {
        winnerGroup,
        winner: "It’s a draw! 🏆",
        message: "Congratulations to both pilots — your teamwork, courage and progress made this a brilliant race!",
        bonuses,
        cxy,
        challenger
      };
    }

    const label = RocketMath.questions.getGroup(winnerGroup).name;
    const runnerUp = RocketMath.questions.getGroup(winnerGroup === "cxy" ? "challenger" : "cxy").name;
    return {
      winnerGroup,
      winner: `${label} wins! 🏆`,
      message: `Congratulations, ${label}! Your progress earned the win! ${runnerUp}, fantastic effort — every answer has made you stronger for the next race.`,
      bonuses,
      cxy,
      challenger
    };
  }

  function startRetry(groupName) {
    const normalizedGroup = groupName === "challenger" ? "challenger" : "cxy";
    const sourceResult = state.competition ? state.competition[normalizedGroup] : state.lastResult;
    if (!sourceResult || sourceResult.groupName !== normalizedGroup) return;
    const pending = sourceResult.wrongAnswers
      .filter((item) => !state.progress.completedRetries.includes(item.id))
      .map((item) => ({ ...item, questionData: RocketMath.questions.refreshChoices(item.questionData) }));
    if (!pending.length) return;

    state.phase = "retry";
    state.mode = sourceResult.mode;
    state.config = RocketMath.questions.normalizeOptions(sourceResult);
    state.retry = {
      groupName: normalizedGroup,
      sourceResult,
      queue: pending,
      total: pending.length,
      completed: 0,
      earnedStars: 0,
      currentItem: null
    };
    state.currentQuestion = null;
    state.acceptingAnswers = false;
    state.currentStreak = 0;
    startTimer();
    RocketMath.ui.updateScore(0);
    RocketMath.ui.updateStreak(0);
    RocketMath.animation.moveRocket(RocketMath.ui.elements.rocket, 0);
    RocketMath.ui.showScreen("game");
    nextRetryQuestion();
  }

  function nextRetryQuestion() {
    if (!state.retry || state.retry.queue.length === 0) {
      endRetry();
      return;
    }

    const item = state.retry.queue.shift();
    item.questionData = RocketMath.questions.refreshChoices(item.questionData);
    state.retry.currentItem = item;
    state.currentQuestion = item.questionData;
    state.acceptingAnswers = true;
    RocketMath.ui.renderQuestion(
      state.currentQuestion,
      state.retry.completed + 1,
      state.retry.total,
      state.retry.earnedStars,
      `Review: ${RocketMath.questions.getGroup(state.retry.groupName).name}`,
      state.config,
      true,
      getHudState()
    );
    RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "idle");
  }

  function answerRetry(answerNumber, isCorrect) {
    const item = state.retry.currentItem;
    if (isCorrect) {
      const recorded = RocketMath.storage.recordRetryBonus(state.progress, {
        retryId: item.id,
        groupName: state.retry.groupName,
        mode: state.retry.sourceResult.mode,
        stars: RULES.starsPerRetry,
        completedAt: RocketMath.utils.todayString()
      });
      state.progress = recorded.progress;
      state.retry.earnedStars += recorded.awarded;
      state.retry.sourceResult.retryStars += recorded.awarded;
      state.retry.completed += 1;
      RocketMath.ui.updateScore(state.retry.earnedStars);
      RocketMath.animation.moveRocket(RocketMath.ui.elements.rocket, state.retry.completed / state.retry.total);
      RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "correct");
      RocketMath.audio.play("correct");
      RocketMath.audio.play("boost");
      RocketMath.ui.showMessage(`Fixed it! +${recorded.awarded} star.`);
    } else {
      state.retry.queue.push(item);
      RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "wrong");
      RocketMath.audio.play("wrong");
      RocketMath.ui.showHint(state.currentQuestion.hint);
      RocketMath.ui.showMessage("Almost! Try the make-ten step, then this one will return.");
    }
    state.transitionTimerId = window.setTimeout(nextRetryQuestion, RULES.answerDelayMs);
  }

  function endRetry() {
    if (!state.retry) return;
    clearTransitionTimer();
    stopTimer();
    state.acceptingAnswers = false;
    const completedRetry = state.retry;
    state.phase = "main";
    RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "complete");
    RocketMath.audio.play("applause");
    RocketMath.ui.renderProgress(state.progress);
    RocketMath.ui.showScreen("result");

    if (state.competition && state.competition.comparison) {
      RocketMath.ui.renderCompetitionResult(
        state.competition.comparison,
        state.progress,
        state.competition,
        `Great comeback, ${RocketMath.questions.getGroup(completedRetry.groupName).name}! +${completedRetry.earnedStars} review stars.`
      );
    } else {
      RocketMath.ui.renderResult(completedRetry.sourceResult, state.progress, completedRetry.sourceResult.previous, {
        title: "Review complete! 🌟",
        message: `Great comeback! You earned ${completedRetry.earnedStars} review stars.`
      });
    }
    state.retry = null;
  }

  function showHint() {
    if (state.currentQuestion) RocketMath.ui.showHint(state.currentQuestion.hint);
  }

  function saveConfig(config) {
    state.progress = RocketMath.storage.recordConfig(state.progress, config);
    RocketMath.ui.renderProgress(state.progress);
  }

  function adjustChallengerPracticeStars(amount) {
    const adjusted = RocketMath.storage.adjustChallengerPracticeStars(
      state.progress,
      amount,
      RocketMath.utils.todayString()
    );
    state.progress = adjusted.progress;
    RocketMath.ui.renderProgress(state.progress);
    return adjusted.applied;
  }

  function resetProgress() {
    state.progress = RocketMath.storage.resetProgress();
    state.lastResult = null;
    state.competition = null;
    RocketMath.ui.applyConfigs(state.progress.configs);
    RocketMath.ui.renderProgress(state.progress);
    RocketMath.ui.updateCompetitionSummaries();
  }

  function showStart() {
    clearTransitionTimer();
    stopTimer();
    RocketMath.ui.closeRaceExitDialog();
    state.mode = "practice";
    state.phase = "main";
    state.competition = null;
    state.retry = null;
    state.currentQuestion = null;
    state.acceptingAnswers = false;
    RocketMath.ui.updateTimer(0);
    RocketMath.ui.renderProgress(state.progress);
    RocketMath.ui.updateCompetitionSummaries();
    RocketMath.ui.showScreen("start");
  }

  function leaveMission(destination) {
    if (state.competition && !state.competition.comparison) {
      state.pendingExitDestination = destination;
      state.pausedElapsed = getElapsedSeconds();
      state.pausedTransitionPending = Boolean(state.transitionTimerId);
      clearTransitionTimer();
      stopTimer();
      const activeGroup = getActiveCompetitionGroup();
      const completed = activeGroup === state.config.groupName ? state.questionIndex : 0;
      const correct = activeGroup === state.config.groupName ? state.correctCount : 0;
      RocketMath.ui.showRaceExitDialog({
        groupLabel: RocketMath.questions.getGroup(activeGroup).name,
        completed,
        total: RULES.totalQuestions,
        correct,
        otherLabel: RocketMath.questions.getGroup(activeGroup === "cxy" ? "challenger" : "cxy").name
      });
      return;
    }

    if (state.mode === "practice" && state.phase === "main" && state.config && state.questionIndex < RULES.totalQuestions) {
      finishPartialPractice(destination);
      return;
    }

    const previousMode = state.mode;
    const previousGroup = state.config && state.config.groupName;
    showStart();
    RocketMath.ui.focusStartArea(destination === "home" ? "home" : previousMode, previousGroup);
  }

  function finishPartialPractice(destination) {
    clearTransitionTimer();
    stopTimer();
    state.acceptingAnswers = false;
    state.phase = "result";
    const result = createCurrentResult(state.questionIndex, true);
    result.rewards = computeRewards(result);
    result.baseStars = 0;
    const recorded = RocketMath.storage.recordGameResult(state.progress, result);
    state.progress = recorded.progress;
    result.previous = recorded.previous;
    result.dailyGoalBonus = recorded.dailyGoalBonus;
    state.lastResult = result;
    state.pendingExitDestination = destination;
    RocketMath.ui.renderProgress(state.progress);
    RocketMath.ui.showScreen("result");
    RocketMath.ui.renderResult(result, state.progress, recorded.previous, {
      title: "Practice paused",
      message: result.message,
      exitDestination: destination
    });
    RocketMath.audio.play("complete");
  }

  function continueRace() {
    RocketMath.ui.closeRaceExitDialog();
    if (state.phase === "main") resumeTimer(state.pausedElapsed);
    if (state.phase === "main" && state.pausedTransitionPending) {
      state.transitionTimerId = window.setTimeout(nextMainQuestion, 80);
    }
    state.pausedTransitionPending = false;
    state.pendingExitDestination = "";
  }

  function exitRace() {
    if (!state.competition || state.competition.comparison) {
      showStart();
      RocketMath.ui.focusStartArea("home");
      return;
    }

    clearTransitionTimer();
    stopTimer();
    state.acceptingAnswers = false;
    const exitingGroup = getActiveCompetitionGroup();
    const otherGroup = exitingGroup === "cxy" ? "challenger" : "cxy";
    const exitingConfig = state.competition.configs[exitingGroup];
    const otherConfig = state.competition.configs[otherGroup];
    const activeHasProgress = state.config && state.config.groupName === exitingGroup;
    const exitingResult = createForfeitResult(
      exitingConfig,
      exitingGroup,
      activeHasProgress ? state.questionIndex : 0,
      activeHasProgress ? state.correctCount : 0,
      activeHasProgress ? state.wrongAnswers : [],
      0,
      true
    );
    const winnerResult = createForfeitResult(otherConfig, otherGroup, 0, 0, [], 10, false);
    state.competition.cxy = exitingGroup === "cxy" ? exitingResult : winnerResult;
    state.competition.challenger = exitingGroup === "challenger" ? exitingResult : winnerResult;

    const cxyRecorded = RocketMath.storage.recordGameResult(state.progress, state.competition.cxy);
    state.progress = cxyRecorded.progress;
    state.competition.cxy.dailyGoalBonus = cxyRecorded.dailyGoalBonus;
    const challengerRecorded = RocketMath.storage.recordGameResult(state.progress, state.competition.challenger);
    state.progress = challengerRecorded.progress;
    state.competition.challenger.dailyGoalBonus = challengerRecorded.dailyGoalBonus;
    const winnerLabel = RocketMath.questions.getGroup(otherGroup).name;
    const comparison = {
      winnerGroup: otherGroup,
      winner: `${winnerLabel} wins by forfeit!`,
      message: `${winnerLabel} receives 10 stars. ${RocketMath.questions.getGroup(exitingGroup).name} can launch a fresh race any time.`,
      bonuses: { cxy: 0, challenger: 0 },
      cxy: state.competition.cxy,
      challenger: state.competition.challenger
    };
    state.competition.comparison = comparison;
    state.progress = RocketMath.storage.recordCompetition(state.progress, {
      id: state.competition.id,
      playedAt: RocketMath.utils.todayString(),
      winner: comparison.winner,
      winnerGroup: otherGroup,
      bonuses: comparison.bonuses,
      cxy: state.competition.cxy,
      challenger: state.competition.challenger
    });
    RocketMath.ui.closeRaceExitDialog();
    showStart();
    RocketMath.ui.focusStartArea("home");
  }

  function createForfeitResult(config, groupName, totalQuestions, correctCount, wrongAnswers, stars, forfeited) {
    const total = Math.max(0, Number(totalQuestions) || 0);
    const rewards = {
      completion: Math.max(0, Number(stars) || 0), perfect: 0, accuracy: 0,
      operations: 0, difficulty: 0, range: 0, total: Math.max(0, Number(stars) || 0)
    };
    return {
      sessionId: createId(`competition-${groupName}-${forfeited ? "exit" : "award"}`),
      mode: "competition",
      groupName,
      groupLabel: RocketMath.questions.getGroup(groupName).name,
      operationSet: config.operationSet,
      difficulty: config.difficulty,
      rangeMax: config.rangeMax,
      difficultyMultiplier: RocketMath.questions.getDifficultyMultiplier(config),
      correctCount: Math.max(0, Number(correctCount) || 0),
      totalQuestions: total,
      correctionRate: total ? Math.round((Number(correctCount) / total) * 100) : 0,
      elapsedSeconds: forfeited ? state.pausedElapsed : 0,
      averageCorrectSeconds: 0,
      maxStreak: 0,
      baseStars: rewards.total,
      retryStars: 0,
      wrongAnswers: Array.isArray(wrongAnswers) ? wrongAnswers.map((item) => ({ ...item })) : [],
      playedAt: RocketMath.utils.todayString(),
      message: forfeited ? "Race exited before completion." : "10 stars awarded after the other pilot exited.",
      rewards,
      partial: true,
      forfeited: Boolean(forfeited),
      forfeitAward: !forfeited
    };
  }

  function getActiveCompetitionGroup() {
    if (state.competition && state.competition.cxy && !state.competition.challenger
      && (!state.config || state.config.groupName === "cxy" || state.questionIndex >= RULES.totalQuestions)) {
      return "challenger";
    }
    return state.config && state.config.groupName === "challenger" ? "challenger" : "cxy";
  }

  function startTimer() {
    stopTimer();
    state.startTime = Date.now();
    state.timerId = window.setInterval(() => RocketMath.ui.updateTimer(getElapsedSeconds()), 1000);
    RocketMath.ui.updateTimer(0);
  }

  function resumeTimer(elapsedSeconds) {
    stopTimer();
    state.startTime = Date.now() - (Math.max(0, Number(elapsedSeconds) || 0) * 1000);
    state.timerId = window.setInterval(() => RocketMath.ui.updateTimer(getElapsedSeconds()), 1000);
    RocketMath.ui.updateTimer(getElapsedSeconds());
  }

  function stopTimer() {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }

  function clearTransitionTimer() {
    if (state.transitionTimerId) window.clearTimeout(state.transitionTimerId);
    state.transitionTimerId = null;
  }

  function getElapsedSeconds() {
    return state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0;
  }

  function getResultMessage(correctCount) {
    if (correctCount === RULES.totalQuestions) return "Perfect flight! Your number skills are shining.";
    if (correctCount >= 8) return "Strong mission! Your math rocket is flying high.";
    if (correctCount >= 5) return "Nice thinking! Review the tricky ones for more stars.";
    return "Every mission builds math power — let’s review together!";
  }

  function getMissionLabel() {
    const group = RocketMath.questions.getGroup(state.config.groupName).name;
    return `${state.mode === "competition" ? "Competition" : "Practice"}: ${group}`;
  }

  function getHudState() {
    const activeGroup = state.retry ? state.retry.groupName : (state.config && state.config.groupName);
    const activeStars = state.retry ? state.retry.earnedStars : state.sessionStars;
    const cxyStars = state.competition && state.competition.cxy
      ? state.competition.cxy.baseStars
      : (state.mode === "competition" && activeGroup === "cxy" ? activeStars : 0);
    const challengerStars = state.competition && state.competition.challenger
      ? state.competition.challenger.baseStars
      : (state.mode === "competition" && activeGroup === "challenger" ? activeStars : 0);
    return {
      mode: state.mode,
      isRetry: state.phase === "retry",
      activeGroup,
      currentStreak: state.currentStreak,
      cxyStars,
      challengerStars
    };
  }

  function copyQuestion(question) {
    return {
      ...question,
      numbers: [...question.numbers],
      operators: [...question.operators],
      intermediateResults: [...question.intermediateResults],
      choices: [...question.choices]
    };
  }

  function randomIndex(items) {
    return RocketMath.utils.randomNumber(0, items.length - 1);
  }

  function createId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  RocketMath.game = {
    RULES,
    init,
    start,
    startCompetition,
    startNextCompetitionTurn,
    startRetry,
    answer,
    showHint,
    saveConfig,
    adjustChallengerPracticeStars,
    resetProgress,
    showStart,
    leaveMission,
    continueRace,
    exitRace,
    compareCompetition,
    computeRewards
  };

  window.RocketMath = RocketMath;
})();
