(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};
  const RULES = Object.freeze({
    totalQuestions: 10,
    starsPerCorrect: 10,
    starsPerRetry: 5,
    winnerBonus: 20,
    drawBonus: 10,
    answerDelayMs: 850
  });

  const encouragements = [
    "Star power! Great job!",
    "Rocket boost! Awesome thinking!",
    "Fantastic maths!",
    "You found it!",
    "Keep flying!",
    "Nice thinking!"
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
    wrongAnswers: [],
    startTime: 0,
    timerId: null,
    acceptingAnswers: false,
    progress: null,
    lastResult: null,
    competition: null,
    retry: null
  };

  function init(progress) {
    state.progress = RocketMath.storage.normalizeProgress(progress);
    RocketMath.ui.renderProgress(state.progress);
    RocketMath.ui.updateCompetitionSummaries();
    RocketMath.ui.showScreen("start");
  }

  function start(options) {
    const config = RocketMath.questions.normalizeOptions(options);
    const mode = options && options.mode === "competition" ? "competition" : "practice";
    startMainSession(config, mode);
  }

  function startMainSession(config, mode) {
    state.config = config;
    state.mode = mode;
    state.phase = "main";
    state.sessionId = createId(`${mode}-${config.groupName}`);
    state.questions = RocketMath.questions.createQuestionSet(config, RULES.totalQuestions);
    state.questionIndex = 0;
    state.currentQuestion = null;
    state.sessionStars = 0;
    state.correctCount = 0;
    state.wrongAnswers = [];
    state.acceptingAnswers = false;
    state.retry = null;
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
    if (state.questionIndex >= state.questions.length) {
      endMainSession();
      return;
    }

    state.currentQuestion = state.questions[state.questionIndex];
    state.acceptingAnswers = true;
    RocketMath.ui.renderQuestion(
      state.currentQuestion,
      state.questionIndex + 1,
      state.questions.length,
      state.sessionStars,
      getMissionLabel(),
      state.config,
      false
    );
    RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "idle");
  }

  function answer(chosenAnswer) {
    if (!state.acceptingAnswers || !state.currentQuestion) return;

    const answerNumber = Number(chosenAnswer);
    const isCorrect = answerNumber === state.currentQuestion.answer;
    state.acceptingAnswers = false;
    RocketMath.ui.setAnswerButtonsDisabled(true);
    RocketMath.ui.markAnswer(answerNumber, state.currentQuestion.answer);

    if (state.phase === "retry") {
      answerRetry(answerNumber, isCorrect);
      return;
    }

    answerMain(answerNumber, isCorrect);
  }

  function answerMain(answerNumber, isCorrect) {
    if (isCorrect) {
      state.sessionStars += RULES.starsPerCorrect;
      state.correctCount += 1;
      RocketMath.ui.updateScore(state.sessionStars);
      RocketMath.animation.moveRocket(
        RocketMath.ui.elements.rocket,
        state.correctCount / RULES.totalQuestions
      );
      RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "correct");
      RocketMath.audio.play("correct");
      RocketMath.audio.play("boost");
      RocketMath.ui.showMessage(encouragements[RocketMath.utils.randomNumber(0, encouragements.length - 1)]);
    } else {
      RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "wrong");
      RocketMath.audio.play("wrong");
      RocketMath.ui.showMessage(`Good try! The answer is ${state.currentQuestion.answer}.`);
      state.wrongAnswers.push({
        id: `${state.sessionId}-q${state.questionIndex + 1}`,
        expression: state.currentQuestion.expression,
        correct: state.currentQuestion.answer,
        chosen: answerNumber,
        groupName: state.config.groupName,
        questionData: copyQuestion(state.currentQuestion)
      });
    }

    state.questionIndex += 1;
    window.setTimeout(nextMainQuestion, RULES.answerDelayMs);
  }

  function endMainSession() {
    stopTimer();
    state.acceptingAnswers = false;
    const elapsedSeconds = getElapsedSeconds();
    const result = {
      sessionId: state.sessionId,
      mode: state.mode,
      groupName: state.config.groupName,
      groupLabel: RocketMath.questions.getGroup(state.config.groupName).name,
      operationSet: state.config.operationSet,
      difficulty: state.config.difficulty,
      rangeMax: state.config.rangeMax,
      correctCount: state.correctCount,
      totalQuestions: RULES.totalQuestions,
      correctionRate: Math.round((state.correctCount / RULES.totalQuestions) * 100),
      elapsedSeconds,
      baseStars: state.sessionStars,
      retryStars: 0,
      wrongAnswers: state.wrongAnswers.map((item) => ({ ...item })),
      playedAt: RocketMath.utils.todayString(),
      message: getResultMessage(state.correctCount)
    };

    const recorded = RocketMath.storage.recordGameResult(state.progress, result);
    state.progress = recorded.progress;
    result.previous = recorded.previous;
    state.lastResult = result;
    RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "complete");
    RocketMath.audio.play(state.correctCount === RULES.totalQuestions ? "applause" : "complete");
    RocketMath.ui.renderProgress(state.progress);
    RocketMath.ui.showScreen("result");

    if (state.mode === "competition") {
      handleCompetitionTurn(result);
    } else {
      RocketMath.ui.renderResult(result, state.progress, recorded.previous);
    }
  }

  function handleCompetitionTurn(result) {
    if (!state.competition) return;

    if (result.groupName === "cxy") {
      state.competition.cxy = result;
      RocketMath.ui.renderCompetitionPrompt(result, state.progress, result.previous);
      return;
    }

    state.competition.challenger = result;
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

    if (cxy.correctionRate > challenger.correctionRate) {
      winnerGroup = "cxy";
    } else if (challenger.correctionRate > cxy.correctionRate) {
      winnerGroup = "challenger";
    } else if (cxy.elapsedSeconds < challenger.elapsedSeconds) {
      winnerGroup = "cxy";
    } else if (challenger.elapsedSeconds < cxy.elapsedSeconds) {
      winnerGroup = "challenger";
    }

    if (winnerGroup === "draw") {
      return {
        winnerGroup,
        winner: "It’s a draw! 🏆",
        message: "Two brilliant rocket pilots! You both earn a draw bonus.",
        bonuses: { cxy: RULES.drawBonus, challenger: RULES.drawBonus },
        cxy,
        challenger
      };
    }

    const label = RocketMath.questions.getGroup(winnerGroup).name;
    return {
      winnerGroup,
      winner: `${label} wins! 🏆`,
      message: `Congratulations, ${label}! Both players built more math power today.`,
      bonuses: {
        cxy: winnerGroup === "cxy" ? RULES.winnerBonus : 0,
        challenger: winnerGroup === "challenger" ? RULES.winnerBonus : 0
      },
      cxy,
      challenger
    };
  }

  function startRetry(groupName) {
    const normalizedGroup = groupName === "challenger" ? "challenger" : "cxy";
    const sourceResult = state.competition
      ? state.competition[normalizedGroup]
      : state.lastResult;

    if (!sourceResult || sourceResult.groupName !== normalizedGroup) return;
    const pending = sourceResult.wrongAnswers
      .filter((item) => !state.progress.completedRetries.includes(item.id))
      .map((item) => ({ ...item, questionData: RocketMath.questions.refreshChoices(item.questionData) }));
    if (pending.length === 0) return;

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
    startTimer();
    RocketMath.ui.updateScore(0);
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
      `Retry: ${RocketMath.questions.getGroup(state.retry.groupName).name}`,
      state.config,
      true
    );
    RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "idle");
  }

  function answerRetry(answerNumber, isCorrect) {
    const item = state.retry.currentItem;
    if (isCorrect) {
      const recorded = RocketMath.storage.recordRetryBonus(state.progress, {
        retryId: item.id,
        groupName: state.retry.groupName,
        stars: RULES.starsPerRetry,
        completedAt: RocketMath.utils.todayString()
      });
      state.progress = recorded.progress;
      state.retry.earnedStars += recorded.awarded;
      state.retry.sourceResult.retryStars += recorded.awarded;
      state.retry.completed += 1;
      RocketMath.ui.updateScore(state.retry.earnedStars);
      RocketMath.animation.moveRocket(
        RocketMath.ui.elements.rocket,
        state.retry.completed / state.retry.total
      );
      RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "correct");
      RocketMath.audio.play("correct");
      RocketMath.audio.play("boost");
      RocketMath.ui.showMessage(`Fixed it! +${recorded.awarded} bonus stars.`);
    } else {
      state.retry.queue.push(item);
      RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "wrong");
      RocketMath.audio.play("wrong");
      RocketMath.ui.showMessage(`Almost! The answer is ${state.currentQuestion.answer}. This one will come back.`);
    }

    window.setTimeout(nextRetryQuestion, RULES.answerDelayMs);
  }

  function endRetry() {
    if (!state.retry) return;
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
        `Great comeback, ${RocketMath.questions.getGroup(completedRetry.groupName).name}! +${completedRetry.earnedStars} retry stars.`
      );
    } else {
      RocketMath.ui.renderResult(completedRetry.sourceResult, state.progress, completedRetry.sourceResult.previous, {
        title: "Retry mission complete! 🌟",
        message: `Great comeback! You earned ${completedRetry.earnedStars} retry stars.`
      });
    }
    state.retry = null;
  }

  function showHint() {
    if (state.currentQuestion) RocketMath.ui.showHint(state.currentQuestion.hint);
  }

  function resetProgress() {
    state.progress = RocketMath.storage.resetProgress();
    state.lastResult = null;
    state.competition = null;
    RocketMath.ui.renderProgress(state.progress);
  }

  function showStart() {
    stopTimer();
    state.mode = "practice";
    state.phase = "main";
    state.competition = null;
    state.retry = null;
    state.currentQuestion = null;
    RocketMath.ui.updateTimer(0);
    RocketMath.ui.renderProgress(state.progress);
    RocketMath.ui.updateCompetitionSummaries();
    RocketMath.ui.showScreen("start");
  }

  function startTimer() {
    stopTimer();
    state.startTime = Date.now();
    state.timerId = window.setInterval(updateTimer, 1000);
    updateTimer();
  }

  function stopTimer() {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }

  function updateTimer() {
    RocketMath.ui.updateTimer(getElapsedSeconds());
  }

  function getElapsedSeconds() {
    return state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0;
  }

  function getResultMessage(correctCount) {
    if (correctCount === RULES.totalQuestions) {
      return "Perfect flight! You reached the brightest star.";
    }
    if (correctCount >= 8) {
      return "Strong mission! Your maths rocket is flying high.";
    }
    if (correctCount >= 5) {
      return "Nice effort! A retry mission can earn more stars.";
    }
    return "Keep going—you are building your math power!";
  }

  function getMissionLabel() {
    const group = RocketMath.questions.getGroup(state.config.groupName).name;
    return `${state.mode === "competition" ? "Competition" : "Practice"}: ${group}`;
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
    resetProgress,
    showStart,
    compareCompetition
  };

  window.RocketMath = RocketMath;
})();
