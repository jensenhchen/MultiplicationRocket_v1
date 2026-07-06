(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};
  const TOTAL_QUESTIONS = 10;
  const POINTS_PER_CORRECT = 10;
  const ANSWER_DELAY_MS = 1000;

  const encouragements = [
    "Stars! Great Job!",
    "Rocket boost! Awesome!",
    "Fantastic!",
    "Rocket boost!",
    "Keep flying!",
    "Nice thinking!"
  ];

  const state = {
    groupName: "cxy",
    levelName: "easy",
    mode: "practice",
    questionNumber: 0,
    score: 0,
    correctCount: 0,
    currentQuestion: null,
    wrongAnswers: [],
    startTime: 0,
    timerId: null,
    acceptingAnswers: false,
    progress: null,
    competition: null
  };

  function init(progress) {
    state.progress = progress;
    RocketMath.ui.renderProgress(state.progress);
    RocketMath.ui.showScreen("start");
  }

  function start(options) {
    const mission = normalizeStartOptions(options);

    state.groupName = mission.groupName;
    state.levelName = mission.levelName;
    state.mode = mission.mode;
    state.questionNumber = 0;
    state.score = 0;
    state.correctCount = 0;
    state.wrongAnswers = [];
    state.currentQuestion = null;
    state.acceptingAnswers = false;
    state.startTime = Date.now();

    clearInterval(state.timerId);
    state.timerId = window.setInterval(updateTimer, 1000);
    updateTimer();
    RocketMath.ui.updateScore(state.score);
    RocketMath.animation.moveRocket(RocketMath.ui.elements.rocket, 0);
    RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "idle");
    RocketMath.ui.showScreen("game");
    nextQuestion();
  }

  function normalizeStartOptions(options) {
    if (typeof options === "string") {
      return {
        groupName: "cxy",
        levelName: RocketMath.questions.GROUPS.cxy.levels[options] ? options : "easy",
        mode: "practice"
      };
    }

    const groupName = RocketMath.questions.GROUPS[options.groupName] ? options.groupName : "cxy";
    const levelName = RocketMath.questions.GROUPS[groupName].levels[options.levelName] ? options.levelName : "easy";
    return {
      groupName,
      levelName,
      mode: options.mode === "competition" ? "competition" : "practice"
    };
  }

  function startCompetition(levelName) {
    state.competition = {
      levelName: RocketMath.questions.GROUPS.cxy.levels[levelName] ? levelName : "easy",
      cxy: null,
      cxr: null
    };

    start({
      groupName: "cxy",
      levelName: state.competition.levelName,
      mode: "competition"
    });
  }

  function startNextCompetitionTurn() {
    if (!state.competition || !state.competition.cxy) return;

    start({
      groupName: "cxr",
      levelName: state.competition.levelName,
      mode: "competition"
    });
  }

  function nextQuestion() {
    state.questionNumber += 1;

    if (state.questionNumber > TOTAL_QUESTIONS) {
      end();
      return;
    }

    state.currentQuestion = RocketMath.questions.createQuestion(state.groupName, state.levelName);
    state.acceptingAnswers = true;

    RocketMath.ui.renderQuestion(
      state.currentQuestion,
      state.questionNumber,
      TOTAL_QUESTIONS,
      state.score,
      getMissionLabel()
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

    if (isCorrect) {
      state.score += POINTS_PER_CORRECT;
      state.correctCount += 1;
      RocketMath.ui.updateScore(state.score);
      RocketMath.animation.moveRocket(
        RocketMath.ui.elements.rocket,
        state.score / (TOTAL_QUESTIONS * POINTS_PER_CORRECT)
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
        question: `${state.currentQuestion.first} x ${state.currentQuestion.second}`,
        correct: state.currentQuestion.answer,
        chosen: answerNumber,
        table: state.currentQuestion.table,
        group: state.groupName
      });
    }

    window.setTimeout(nextQuestion, ANSWER_DELAY_MS);
  }

  function showHint() {
    if (!state.currentQuestion) return;
    RocketMath.ui.showHint(state.currentQuestion.hint);
  }

  function end() {
    clearInterval(state.timerId);
    state.acceptingAnswers = false;

    const result = {
      score: state.score,
      groupName: state.groupName,
      groupLabel: RocketMath.questions.getGroup(state.groupName).name,
      levelName: state.levelName,
      levelLabel: RocketMath.questions.getLevel(state.groupName, state.levelName).label,
      correctCount: state.correctCount,
      totalQuestions: TOTAL_QUESTIONS,
      correctionRate: Math.round((state.correctCount / TOTAL_QUESTIONS) * 100),
      elapsedSeconds: getElapsedSeconds(),
      wrongAnswers: state.wrongAnswers,
      playedAt: RocketMath.utils.todayString(),
      message: getResultMessage()
    };

    state.progress = RocketMath.storage.recordGameResult(state.progress, result);
    RocketMath.animation.setRocketState(RocketMath.ui.elements.rocket, "complete");
    RocketMath.audio.play(state.score === TOTAL_QUESTIONS * POINTS_PER_CORRECT ? "applause" : "complete");
    RocketMath.ui.renderResult(result, state.progress);
    handleCompetitionResult(result);
    RocketMath.ui.renderProgress(state.progress);
    RocketMath.ui.showScreen("result");
  }

  function handleCompetitionResult(result) {
    if (state.mode !== "competition" || !state.competition) return;

    if (state.groupName === "cxy") {
      state.competition.cxy = result;
      RocketMath.ui.renderCompetitionPrompt(result);
      return;
    }

    state.competition.cxr = result;
    const comparison = compareCompetition(state.competition.cxy, state.competition.cxr);
    state.progress = RocketMath.storage.recordCompetition(state.progress, {
      playedAt: result.playedAt,
      levelName: state.competition.levelName,
      winner: comparison.winner,
      cxy: summarizeCompetitionResult(state.competition.cxy),
      cxr: summarizeCompetitionResult(state.competition.cxr)
    });
    RocketMath.ui.renderCompetitionResult(comparison);
  }

  function compareCompetition(cxy, cxr) {
    let winner = "Draw";

    if (cxy.correctCount > cxr.correctCount) {
      winner = "CXY wins by accuracy";
    } else if (cxr.correctCount > cxy.correctCount) {
      winner = "CXR wins by accuracy";
    } else if (cxy.elapsedSeconds < cxr.elapsedSeconds) {
      winner = "CXY wins by speed";
    } else if (cxr.elapsedSeconds < cxy.elapsedSeconds) {
      winner = "CXR wins by speed";
    }

    return { winner, cxy, cxr };
  }

  function summarizeCompetitionResult(result) {
    return {
      score: result.score,
      correctCount: result.correctCount,
      totalQuestions: result.totalQuestions,
      correctionRate: result.correctionRate,
      elapsedSeconds: result.elapsedSeconds
    };
  }

  function resetProgress() {
    state.progress = RocketMath.storage.resetProgress();
    RocketMath.ui.renderProgress(state.progress);
  }

  function showStart() {
    clearInterval(state.timerId);
    state.mode = "practice";
    state.competition = null;
    RocketMath.ui.updateTimer(0);
    RocketMath.ui.renderProgress(state.progress);
    RocketMath.ui.showScreen("start");
  }

  function updateTimer() {
    RocketMath.ui.updateTimer(getElapsedSeconds());
  }

  function getElapsedSeconds() {
    if (!state.startTime) return 0;
    return Math.floor((Date.now() - state.startTime) / 1000);
  }

  function getResultMessage() {
    if (state.score === TOTAL_QUESTIONS * POINTS_PER_CORRECT) {
      return "Amazing flight! You reached the brightest star.";
    }

    if (state.score >= 70) {
      return "Strong mission! A little practice will make it even smoother.";
    }

    return "Good effort! Try again and watch your rocket climb higher.";
  }

  function getMissionLabel() {
    const group = RocketMath.questions.getGroup(state.groupName);
    const level = RocketMath.questions.getLevel(state.groupName, state.levelName);
    const prefix = state.mode === "competition" ? "Compete" : "Practice";
    return `${prefix}: ${group.name} ${level.label}`;
  }

  RocketMath.game = {
    init,
    start,
    startCompetition,
    startNextCompetitionTurn,
    answer,
    showHint,
    resetProgress,
    showStart
  };

  window.RocketMath = RocketMath;
})();
