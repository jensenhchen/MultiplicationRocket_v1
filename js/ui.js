(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};
  const { safeText } = RocketMath.utils;

  const elements = {
    app: document.querySelector("#app"),
    startScreen: document.querySelector("#start-screen"),
    gameScreen: document.querySelector("#game-screen"),
    resultScreen: document.querySelector("#result-screen"),
    levelButtons: document.querySelectorAll("[data-mode='practice']"),
    competitionButtons: document.querySelectorAll("[data-mode='competition']"),
    soundToggle: document.querySelector("#sound-toggle"),
    musicToggle: document.querySelector("#music-toggle"),
    resetProgressButton: document.querySelector("#reset-progress-button"),
    savedProgress: document.querySelector("#saved-progress"),
    groupStats: document.querySelector("#group-stats"),
    weakTables: document.querySelector("#weak-tables"),
    missionLabel: document.querySelector("#mission-label"),
    questionNumber: document.querySelector("#question-number"),
    score: document.querySelector("#score"),
    timer: document.querySelector("#timer"),
    rocket: document.querySelector("#rocket"),
    questionText: document.querySelector("#question-text"),
    answerButtons: document.querySelector("#answer-buttons"),
    hintButton: document.querySelector("#hint-button"),
    hintText: document.querySelector("#hint-text"),
    message: document.querySelector("#message"),
    resultMessage: document.querySelector("#result-message"),
    finalScore: document.querySelector("#final-score"),
    bestScore: document.querySelector("#best-score"),
    finalCorrect: document.querySelector("#final-correct"),
    finalRate: document.querySelector("#final-rate"),
    finalTime: document.querySelector("#final-time"),
    competitionResult: document.querySelector("#competition-result"),
    wrongReview: document.querySelector("#wrong-review"),
    competitionNextButton: document.querySelector("#competition-next-button"),
    playAgainButton: document.querySelector("#play-again-button")
  };

  function showScreen(screenName) {
    elements.startScreen.classList.toggle("hidden", screenName !== "start");
    elements.gameScreen.classList.toggle("hidden", screenName !== "game");
    elements.resultScreen.classList.toggle("hidden", screenName !== "result");
    document.body.classList.toggle("is-playing", screenName === "game");
  }

  function renderProgress(progress) {
    const playedText = progress.lastPlayedDate
      ? `Last played: ${progress.lastPlayedDate}`
      : "Ready for your first launch.";

    elements.savedProgress.textContent = `Best: ${progress.bestScore} stars. Total stars: ${progress.starsEarned}. ${playedText}`;
    renderGroupStats(progress);
    renderWeakTables(progress);
  }

  function renderGroupStats(progress) {
    elements.groupStats.innerHTML = "";
    ["cxy", "cxr"].forEach((groupName) => {
      const stats = progress.groupStats[groupName];
      const label = groupName.toUpperCase();
      const averageRate = stats.totalQuestions
        ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
        : 0;
      const card = document.createElement("div");
      card.className = "group-stat-card";
      card.innerHTML = `<span>${label}</span>${stats.lastCorrect}/${stats.lastTotal || 0} last, ${stats.lastTime || 0}s, ${averageRate}% overall`;
      elements.groupStats.appendChild(card);
    });
  }

  function renderWeakTables(progress) {
    const weakTables = RocketMath.storage.getWeakTables(progress, 3);
    elements.weakTables.innerHTML = "";

    if (weakTables.length === 0) {
      elements.weakTables.textContent = "Tip: use hints when a table feels tricky.";
      return;
    }

    const label = document.createElement("p");
    label.textContent = "Practice these tables next:";
    elements.weakTables.appendChild(label);

    weakTables.forEach((item) => {
      const badge = document.createElement("span");
      badge.className = "table-badge";
      badge.textContent = `${item.table}x`;
      elements.weakTables.appendChild(badge);
    });
  }

  function renderQuestion(question, questionNumber, totalQuestions, score, missionLabel) {
    elements.missionLabel.textContent = missionLabel;
    elements.questionNumber.textContent = questionNumber;
    elements.questionText.textContent = question.text;
    elements.score.textContent = score;
    elements.hintText.textContent = "";
    elements.message.textContent = "";
    elements.answerButtons.innerHTML = "";

    question.choices.forEach((answer) => {
      const button = document.createElement("button");
      button.className = "answer-button";
      button.type = "button";
      button.textContent = answer;
      button.setAttribute("aria-label", `Answer ${answer}`);
      elements.answerButtons.appendChild(button);
    });

    elements.questionText.setAttribute("aria-label", `Question ${questionNumber} of ${totalQuestions}: ${question.text}`);
  }

  function updateTimer(seconds) {
    elements.timer.textContent = seconds;
  }

  function updateScore(score) {
    elements.score.textContent = score;
    RocketMath.animation.pulse(elements.score);
  }

  function setAnswerButtonsDisabled(disabled) {
    elements.answerButtons.querySelectorAll("button").forEach((button) => {
      button.disabled = disabled;
    });
  }

  function markAnswer(chosenAnswer, correctAnswer) {
    elements.answerButtons.querySelectorAll("button").forEach((button) => {
      const value = Number(button.textContent);
      button.classList.toggle("correct", value === correctAnswer);
      button.classList.toggle("wrong", value === chosenAnswer && chosenAnswer !== correctAnswer);
    });
  }

  function showHint(hint) {
    elements.hintText.textContent = `Hint: ${safeText(hint)}.`;
  }

  function showMessage(message) {
    elements.message.textContent = safeText(message);
    elements.message.classList.remove("message-pop");
    window.requestAnimationFrame(() => elements.message.classList.add("message-pop"));
  }

  function updateAudioButtons(settings) {
    elements.soundToggle.textContent = settings.soundEnabled ? "Sound On" : "Sound Off";
    elements.soundToggle.setAttribute("aria-pressed", String(settings.soundEnabled));
    elements.musicToggle.textContent = settings.musicEnabled ? "Music On" : "Music Off";
    elements.musicToggle.setAttribute("aria-pressed", String(settings.musicEnabled));
  }

  function renderResult(result, progress) {
    elements.finalScore.textContent = result.score;
    elements.bestScore.textContent = progress.bestScore;
    elements.finalCorrect.textContent = `${result.correctCount}/${result.totalQuestions}`;
    elements.finalRate.textContent = `${result.correctionRate}%`;
    elements.finalTime.textContent = result.elapsedSeconds;
    elements.resultMessage.textContent = result.message;
    elements.competitionResult.classList.add("hidden");
    elements.competitionNextButton.classList.add("hidden");
    elements.wrongReview.innerHTML = "";

    if (result.wrongAnswers.length === 0) {
      const perfect = document.createElement("p");
      perfect.className = "perfect-message";
      perfect.textContent = "Perfect score! Every answer was correct.";
      elements.wrongReview.appendChild(perfect);
      return;
    }

    result.wrongAnswers.forEach((item) => {
      const reviewItem = document.createElement("div");
      reviewItem.className = "review-item";
      reviewItem.textContent = `${item.question} = ${item.correct}. You chose ${item.chosen}.`;
      elements.wrongReview.appendChild(reviewItem);
    });
  }

  function renderCompetitionPrompt(currentResult) {
    elements.competitionResult.classList.remove("hidden");
    elements.competitionResult.innerHTML = `<p>CXY finished: ${currentResult.correctCount}/${currentResult.totalQuestions}, ${currentResult.correctionRate}%, ${currentResult.elapsedSeconds}s.</p><p>Now let CXR take a turn.</p>`;
    elements.competitionNextButton.classList.remove("hidden");
    elements.competitionNextButton.textContent = "Start CXR turn";
  }

  function renderCompetitionResult(comparison) {
    elements.competitionResult.classList.remove("hidden");
    elements.competitionNextButton.classList.add("hidden");
    elements.competitionResult.innerHTML = [
      `<p><strong>Competition result:</strong> ${comparison.winner}</p>`,
      `<p>CXY: ${comparison.cxy.correctCount}/${comparison.cxy.totalQuestions}, ${comparison.cxy.correctionRate}%, ${comparison.cxy.elapsedSeconds}s</p>`,
      `<p>CXR: ${comparison.cxr.correctCount}/${comparison.cxr.totalQuestions}, ${comparison.cxr.correctionRate}%, ${comparison.cxr.elapsedSeconds}s</p>`
    ].join("");
  }

  RocketMath.ui = {
    elements,
    showScreen,
    renderProgress,
    renderQuestion,
    updateTimer,
    updateScore,
    setAnswerButtonsDisabled,
    markAnswer,
    showHint,
    showMessage,
    updateAudioButtons,
    renderResult,
    renderCompetitionPrompt,
    renderCompetitionResult
  };

  window.RocketMath = RocketMath;
})();
