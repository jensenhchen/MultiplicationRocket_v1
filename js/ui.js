(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};
  const { safeText } = RocketMath.utils;

  const elements = {
    app: document.querySelector("#app"),
    startScreen: document.querySelector("#start-screen"),
    gameScreen: document.querySelector("#game-screen"),
    resultScreen: document.querySelector("#result-screen"),
    configSelects: document.querySelectorAll("[data-config-group]"),
    startPracticeButtons: document.querySelectorAll(".start-practice-button"),
    startCompetitionButton: document.querySelector("#start-competition-button"),
    competitionCxySummary: document.querySelector("#competition-cxy-summary"),
    competitionChallengerSummary: document.querySelector("#competition-challenger-summary"),
    soundToggle: document.querySelector("#sound-toggle"),
    musicToggle: document.querySelector("#music-toggle"),
    resetProgressButton: document.querySelector("#reset-progress-button"),
    savedProgress: document.querySelector("#saved-progress"),
    groupStats: document.querySelector("#group-stats"),
    focusArea: document.querySelector("#focus-area"),
    missionLabel: document.querySelector("#mission-label"),
    missionConfig: document.querySelector("#mission-config"),
    questionNumber: document.querySelector("#question-number"),
    questionTotal: document.querySelector("#question-total"),
    score: document.querySelector("#score"),
    timer: document.querySelector("#timer"),
    rocket: document.querySelector("#rocket"),
    questionText: document.querySelector("#question-text"),
    answerButtons: document.querySelector("#answer-buttons"),
    hintButton: document.querySelector("#hint-button"),
    hintText: document.querySelector("#hint-text"),
    message: document.querySelector("#message"),
    resultTitle: document.querySelector("#result-title"),
    resultMessage: document.querySelector("#result-message"),
    finalScore: document.querySelector("#final-score"),
    totalStars: document.querySelector("#total-stars"),
    finalCorrect: document.querySelector("#final-correct"),
    finalRate: document.querySelector("#final-rate"),
    finalTime: document.querySelector("#final-time"),
    comparisonMessage: document.querySelector("#comparison-message"),
    competitionResult: document.querySelector("#competition-result"),
    reviewSection: document.querySelector("#review-section"),
    reviewTitle: document.querySelector("#review-title"),
    wrongReview: document.querySelector("#wrong-review"),
    retryActions: document.querySelector("#retry-actions"),
    competitionNextButton: document.querySelector("#competition-next-button"),
    playAgainButton: document.querySelector("#play-again-button")
  };

  function showScreen(screenName) {
    elements.startScreen.classList.toggle("hidden", screenName !== "start");
    elements.gameScreen.classList.toggle("hidden", screenName !== "game");
    elements.resultScreen.classList.toggle("hidden", screenName !== "result");
    document.body.classList.toggle("is-playing", screenName === "game");
    document.body.classList.toggle("is-celebrating", false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getConfig(groupName) {
    const group = groupName === "challenger" ? "challenger" : "cxy";
    const values = {};
    elements.configSelects.forEach((select) => {
      if (select.dataset.configGroup === group) values[select.dataset.configField] = select.value;
    });

    return RocketMath.questions.normalizeOptions({
      groupName: group,
      operationSet: values.operationSet,
      difficulty: values.difficulty,
      rangeMax: Number(values.rangeMax)
    });
  }

  function formatConfig(config) {
    const operation = RocketMath.questions.getOperationSet(config.operationSet).label;
    const difficulty = RocketMath.questions.getDifficulty(config.difficulty);
    return `${operation} · ${difficulty.label}, ${difficulty.operandCount} numbers · 1–${config.rangeMax}`;
  }

  function updateCompetitionSummaries() {
    elements.competitionCxySummary.textContent = formatConfig(getConfig("cxy"));
    elements.competitionChallengerSummary.textContent = formatConfig(getConfig("challenger"));
  }

  function renderProgress(progress) {
    const playedText = progress.lastPlayedDate
      ? `Last played: ${progress.lastPlayedDate}.`
      : "Ready for your first launch!";

    elements.savedProgress.textContent = `Total stars: ${progress.totalStars}. ${playedText}`;
    renderGroupStats(progress);
    renderFocusAreas(progress);
  }

  function renderGroupStats(progress) {
    elements.groupStats.innerHTML = "";
    ["cxy", "challenger"].forEach((groupName) => {
      const stats = progress.groupStats[groupName];
      const averageRate = stats.totalQuestions
        ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
        : 0;
      const card = document.createElement("div");
      const heading = document.createElement("span");
      const detail = document.createElement("strong");
      const extra = document.createElement("small");

      card.className = "group-stat-card";
      heading.textContent = RocketMath.questions.getGroup(groupName).name;
      detail.textContent = `${progress.groupStars[groupName]} stars`;
      extra.textContent = stats.gamesPlayed
        ? `${stats.lastCorrect}/${stats.lastTotal} last · ${averageRate}% overall`
        : "Ready for a first mission";
      card.append(heading, detail, extra);
      elements.groupStats.appendChild(card);
    });
  }

  function renderFocusAreas(progress) {
    const focusAreas = RocketMath.storage.getFocusAreas(progress, 3);
    elements.focusArea.innerHTML = "";

    if (focusAreas.length === 0) {
      elements.focusArea.textContent = "Rocket tip: use a hint whenever a step feels tricky.";
      return;
    }

    const label = document.createElement("p");
    label.textContent = "Power-up ideas:";
    elements.focusArea.appendChild(label);
    focusAreas.forEach((item) => {
      const badge = document.createElement("span");
      badge.className = "table-badge";
      badge.textContent = item.label;
      elements.focusArea.appendChild(badge);
    });
  }

  function renderQuestion(question, questionNumber, totalQuestions, score, missionLabel, config, isRetry) {
    elements.missionLabel.textContent = missionLabel;
    elements.missionConfig.textContent = isRetry ? `Retry mission · ${formatConfig(config)}` : formatConfig(config);
    elements.questionNumber.textContent = questionNumber;
    elements.questionTotal.textContent = totalQuestions;
    elements.questionText.textContent = question.text;
    elements.score.textContent = score;
    elements.hintText.textContent = "";
    elements.message.textContent = "";
    elements.answerButtons.innerHTML = "";

    question.choices.forEach((answer, index) => {
      const button = document.createElement("button");
      const shortcut = document.createElement("span");
      const value = document.createElement("strong");
      button.className = "answer-button";
      button.type = "button";
      button.dataset.answer = answer;
      button.setAttribute("aria-label", `Option ${index + 1}: ${answer}`);
      shortcut.className = "answer-shortcut";
      shortcut.textContent = index + 1;
      value.textContent = answer;
      button.append(shortcut, value);
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
      const value = Number(button.dataset.answer);
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

  function renderResult(result, progress, previous, options) {
    const view = options || {};
    const retryComplete = allWrongQuestionsReviewed(result, progress);
    elements.resultTitle.textContent = view.title || "Mission complete! ⭐";
    elements.resultMessage.textContent = view.message || result.message;
    elements.finalScore.textContent = result.baseStars + (result.retryStars || 0);
    elements.totalStars.textContent = progress.totalStars;
    elements.finalCorrect.textContent = `${result.correctCount}/${result.totalQuestions}`;
    elements.finalRate.textContent = `${result.correctionRate}%`;
    elements.finalTime.textContent = result.elapsedSeconds;
    elements.comparisonMessage.textContent = buildComparisonText(previous, result);
    elements.competitionResult.classList.add("hidden");
    elements.competitionResult.classList.remove("winner-celebration");
    elements.competitionNextButton.classList.add("hidden");
    elements.reviewSection.classList.remove("hidden");
    elements.reviewTitle.textContent = "Mission review";
    renderWrongItems(elements.wrongReview, result.wrongAnswers, progress);
    elements.retryActions.innerHTML = "";

    if (result.wrongAnswers.length > 0 && !retryComplete && !view.hideRetry) {
      elements.retryActions.appendChild(createRetryButton(result.groupName));
    }

    if (retryComplete && result.wrongAnswers.length > 0) {
      const complete = document.createElement("p");
      complete.className = "retry-complete-message";
      complete.textContent = `Great comeback! You earned ${result.retryStars || 0} retry stars.`;
      elements.retryActions.appendChild(complete);
    }

    if (result.wrongAnswers.length === 0) celebrate();
  }

  function renderCompetitionPrompt(result, progress, previous) {
    renderResult(result, progress, previous, { hideRetry: true });
    elements.resultTitle.textContent = "CXY turn complete! 🚀";
    elements.resultMessage.textContent = "Nice flying, CXY! Pass the controls to Challenger.";
    elements.competitionResult.classList.remove("hidden");
    elements.competitionResult.textContent = "The final winner is revealed after Challenger completes 10 questions.";
    elements.reviewSection.classList.add("hidden");
    elements.competitionNextButton.classList.remove("hidden");
    elements.competitionNextButton.textContent = "Start Challenger turn";
  }

  function renderCompetitionResult(comparison, progress, competition, completionMessage) {
    const cxy = competition.cxy;
    const challenger = competition.challenger;
    const combinedCorrect = cxy.correctCount + challenger.correctCount;
    const combinedTotal = cxy.totalQuestions + challenger.totalQuestions;
    const combinedStars = cxy.baseStars + challenger.baseStars
      + (cxy.retryStars || 0) + (challenger.retryStars || 0)
      + comparison.bonuses.cxy + comparison.bonuses.challenger;

    elements.resultTitle.textContent = comparison.winner;
    elements.resultMessage.textContent = completionMessage || comparison.message;
    elements.finalScore.textContent = combinedStars;
    elements.totalStars.textContent = progress.totalStars;
    elements.finalCorrect.textContent = `${combinedCorrect}/${combinedTotal}`;
    elements.finalRate.textContent = `${Math.round((combinedCorrect / combinedTotal) * 100)}%`;
    elements.finalTime.textContent = cxy.elapsedSeconds + challenger.elapsedSeconds;
    elements.comparisonMessage.textContent = "The winner is based only on the first 10 questions for each player.";
    elements.competitionNextButton.classList.add("hidden");
    elements.competitionResult.classList.remove("hidden");
    elements.competitionResult.classList.add("winner-celebration");
    elements.competitionResult.innerHTML = "";
    elements.competitionResult.append(
      createCompetitionCard("CXY", cxy, comparison.bonuses.cxy),
      createCompetitionCard("Challenger", challenger, comparison.bonuses.challenger)
    );

    elements.reviewSection.classList.remove("hidden");
    elements.reviewTitle.textContent = "Competition review";
    elements.wrongReview.innerHTML = "";
    elements.retryActions.innerHTML = "";
    renderCompetitionReviewGroup("CXY", cxy, progress);
    renderCompetitionReviewGroup("Challenger", challenger, progress);
    celebrate();
  }

  function createCompetitionCard(label, result, winnerBonus) {
    const card = document.createElement("div");
    const title = document.createElement("h3");
    const config = document.createElement("p");
    const stats = document.createElement("p");
    const comparison = document.createElement("p");
    card.className = "competition-score-card";
    title.textContent = label;
    config.textContent = formatConfig(result);
    stats.textContent = `${result.correctCount}/${result.totalQuestions} · ${result.correctionRate}% · ${result.elapsedSeconds}s · ${result.baseStars + (result.retryStars || 0)} mission stars`;
    comparison.textContent = `${buildComparisonText(result.previous, result)} Bonus: +${winnerBonus} stars.`;
    card.append(title, config, stats, comparison);
    return card;
  }

  function renderCompetitionReviewGroup(label, result, progress) {
    const section = document.createElement("section");
    const heading = document.createElement("h4");
    const list = document.createElement("div");
    section.className = "competition-review-group";
    heading.textContent = `${label} missed questions`;
    list.className = "review-list";
    renderWrongItems(list, result.wrongAnswers, progress);
    section.append(heading, list);

    if (result.wrongAnswers.length > 0 && !allWrongQuestionsReviewed(result, progress)) {
      section.appendChild(createRetryButton(result.groupName));
    } else if (result.wrongAnswers.length > 0) {
      const complete = document.createElement("p");
      complete.className = "retry-complete-message";
      complete.textContent = `Retry complete · +${result.retryStars || 0} stars`;
      section.appendChild(complete);
    }

    elements.wrongReview.appendChild(section);
  }

  function renderWrongItems(container, wrongAnswers, progress) {
    container.innerHTML = "";
    if (!wrongAnswers || wrongAnswers.length === 0) {
      const perfect = document.createElement("p");
      perfect.className = "perfect-message";
      perfect.textContent = "Perfect score! Every answer was correct.";
      container.appendChild(perfect);
      return;
    }

    wrongAnswers.forEach((item) => {
      const reviewItem = document.createElement("div");
      const reviewed = progress.completedRetries.includes(item.id);
      reviewItem.className = `review-item${reviewed ? " reviewed" : ""}`;
      reviewItem.textContent = `${item.expression} = ${item.correct}. You chose ${item.chosen}.${reviewed ? " Retried ✓" : ""}`;
      container.appendChild(reviewItem);
    });
  }

  function createRetryButton(groupName) {
    const button = document.createElement("button");
    button.className = "retry-button";
    button.type = "button";
    button.dataset.retryGroup = groupName;
    button.textContent = `Retry ${RocketMath.questions.getGroup(groupName).name} missed questions`;
    return button;
  }

  function allWrongQuestionsReviewed(result, progress) {
    return result.wrongAnswers.length > 0
      && result.wrongAnswers.every((item) => progress.completedRetries.includes(item.id));
  }

  function buildComparisonText(previous, result) {
    if (!previous) return "First result for this mission. Your rocket journey starts here!";

    const rateChange = result.correctionRate - previous.correctionRate;
    const timeChange = previous.elapsedSeconds - result.elapsedSeconds;
    const rateText = rateChange > 0
      ? `Accuracy improved by ${rateChange} percentage points.`
      : (rateChange < 0
        ? `Accuracy changed by ${Math.abs(rateChange)} percentage points—keep building your math power!`
        : "Accuracy matched your last mission.");
    const timeText = timeChange > 0
      ? `You were ${timeChange}s faster.`
      : (timeChange < 0 ? `You took ${Math.abs(timeChange)}s more—careful thinking is valuable.` : "Your time matched exactly.");
    return `${rateText} ${timeText}`;
  }

  function celebrate() {
    document.body.classList.add("is-celebrating");
    window.setTimeout(() => document.body.classList.remove("is-celebrating"), 2400);
  }

  RocketMath.ui = {
    elements,
    showScreen,
    getConfig,
    formatConfig,
    updateCompetitionSummaries,
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
    renderCompetitionResult,
    celebrate
  };

  window.RocketMath = RocketMath;
})();
