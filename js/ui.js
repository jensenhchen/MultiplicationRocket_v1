(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};
  const { safeText } = RocketMath.utils;

  const elements = {
    app: document.querySelector("#app"),
    startScreen: document.querySelector("#start-screen"),
    gameScreen: document.querySelector("#game-screen"),
    resultScreen: document.querySelector("#result-screen"),
    modeTabs: document.querySelectorAll("[data-setup-mode]"),
    setupViews: document.querySelectorAll("[data-setup-view]"),
    groupTabs: document.querySelectorAll("[data-group-tab]"),
    configSelects: document.querySelectorAll("[data-config-group]"),
    startPracticeButtons: document.querySelectorAll(".start-practice-button"),
    startCompetitionButton: document.querySelector("#start-competition-button"),
    competitionCxySummary: document.querySelector("#competition-cxy-summary"),
    competitionChallengerSummary: document.querySelector("#competition-challenger-summary"),
    soundToggle: document.querySelector("#sound-toggle"),
    musicToggle: document.querySelector("#music-toggle"),
    resetProgressButton: document.querySelector("#reset-progress-button"),
    savedProgress: document.querySelector("#saved-progress"),
    progressCards: document.querySelector("#progress-cards"),
    groupStats: document.querySelector("#group-stats"),
    focusArea: document.querySelector("#focus-area"),
    missionLabel: document.querySelector("#mission-label"),
    missionConfig: document.querySelector("#mission-config"),
    questionNumber: document.querySelector("#question-number"),
    questionTotal: document.querySelector("#question-total"),
    questionProgress: document.querySelector("#question-progress"),
    progressTrack: document.querySelector(".progress-track"),
    score: document.querySelector("#score"),
    streak: document.querySelector("#streak"),
    timer: document.querySelector("#timer"),
    competitionHud: document.querySelector("#competition-hud"),
    liveCxyStars: document.querySelector("#live-cxy-stars"),
    liveChallengerStars: document.querySelector("#live-challenger-stars"),
    rocket: document.querySelector("#rocket"),
    questionText: document.querySelector("#question-text"),
    answerButtons: document.querySelector("#answer-buttons"),
    hintButton: document.querySelector("#hint-button"),
    hintText: document.querySelector("#hint-text"),
    message: document.querySelector("#message"),
    resultTitle: document.querySelector("#result-title"),
    resultCelebrationIcon: document.querySelector("#result-celebration-icon"),
    resultMessage: document.querySelector("#result-message"),
    finalScore: document.querySelector("#final-score"),
    totalStars: document.querySelector("#total-stars"),
    finalCorrect: document.querySelector("#final-correct"),
    finalRate: document.querySelector("#final-rate"),
    finalAverage: document.querySelector("#final-average"),
    finalTime: document.querySelector("#final-time"),
    rewardBreakdown: document.querySelector("#reward-breakdown"),
    comparisonMessage: document.querySelector("#comparison-message"),
    competitionResult: document.querySelector("#competition-result"),
    reviewSection: document.querySelector("#review-section"),
    reviewTitle: document.querySelector("#review-title"),
    reviewSummary: document.querySelector("#review-summary"),
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
    document.body.classList.toggle("is-result", screenName === "result");
    document.body.classList.remove("is-celebrating");
  }

  function showSetupMode(modeName) {
    const mode = modeName === "competition" ? "competition" : "practice";
    elements.modeTabs.forEach((button) => {
      const active = button.dataset.setupMode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    elements.setupViews.forEach((view) => {
      const active = view.dataset.setupView === mode;
      view.classList.toggle("active", active);
      view.hidden = !active;
    });
    if (mode === "competition") updateCompetitionSummaries();
  }

  function showGroupTab(groupName) {
    const group = groupName === "challenger" ? "challenger" : "cxy";
    elements.startScreen.dataset.activeGroup = group;
    elements.groupTabs.forEach((button) => {
      const active = button.dataset.groupTab === group;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  function applyConfigs(configs) {
    const saved = configs || {};
    elements.configSelects.forEach((select) => {
      const config = saved[select.dataset.configGroup];
      if (!config) return;
      const value = String(config[select.dataset.configField]);
      if ([...select.options].some((option) => option.value === value)) select.value = value;
    });
  }

  function getConfig(groupName, contextName) {
    const group = groupName === "challenger" ? "challenger" : "cxy";
    const context = contextName === "competition" ? "competition" : "practice";
    const values = {};
    elements.configSelects.forEach((select) => {
      if (select.dataset.configGroup === group && (select.dataset.configContext || "practice") === context) {
        values[select.dataset.configField] = select.value;
      }
    });
    return RocketMath.questions.normalizeOptions({
      groupName: group,
      operationSet: values.operationSet,
      difficulty: values.difficulty,
      rangeMax: Number(values.rangeMax)
    });
  }

  function formatConfig(config) {
    const normalized = RocketMath.questions.normalizeOptions(config);
    const operation = RocketMath.questions.getOperationSet(normalized.operationSet).label;
    const difficulty = RocketMath.questions.getDifficulty(normalized.difficulty);
    return `${operation} · ${difficulty.label} · 1–${normalized.rangeMax}`;
  }

  function updateCompetitionSummaries() {
    elements.competitionCxySummary.textContent = formatConfig(getConfig("cxy", "competition"));
    elements.competitionChallengerSummary.textContent = formatConfig(getConfig("challenger", "competition"));
  }

  function renderProgress(progress) {
    renderProgressDashboard(progress);
    renderGroupStats(progress);
    renderFocusAreas(progress);
  }

  function renderGroupStats(progress) {
    elements.groupStats.innerHTML = "";
    ["cxy", "challenger"].forEach((groupName) => {
      const stats = progress.groupStats[groupName];
      const card = document.createElement("div");
      const heading = document.createElement("span");
      const detail = document.createElement("strong");
      const extra = document.createElement("small");
      card.className = "group-stat-card";
      heading.textContent = RocketMath.questions.getGroup(groupName).name;
      detail.textContent = `${stats.totalQuestions} questions`;
      extra.textContent = stats.gamesPlayed
        ? `Best ${stats.bestRate}% · Last ${stats.lastRate}%`
        : "Ready to launch";
      card.append(heading, detail, extra);
      elements.groupStats.appendChild(card);
    });
  }

  function renderProgressDashboard(progress) {
    if (!elements.progressCards) return;
    const dates = getRecentDateKeys(3);
    const allResults = [
      ...(Array.isArray(progress.practiceHistory) ? progress.practiceHistory : []),
      ...(Array.isArray(progress.competitionTurnHistory) ? progress.competitionTurnHistory : [])
    ];
    elements.progressCards.innerHTML = "";
    ["cxy", "challenger"].forEach((groupName) => {
      const days = dates.map((date) => {
        const results = allResults.filter((item) => item.groupName === groupName && item.playedAt === date.key);
        const questions = results.reduce((sum, item) => sum + (Number(item.totalQuestions) || 0), 0);
        const correct = results.reduce((sum, item) => sum + (Number(item.correctCount) || 0), 0);
        return {
          ...date,
          questions,
          correct,
          accuracy: questions ? Math.round((correct / questions) * 100) : 0
        };
      });
      elements.progressCards.appendChild(createProgressCard(groupName, days));
    });
  }

  function createProgressCard(groupName, days) {
    const card = document.createElement("article");
    const heading = document.createElement("div");
    const title = document.createElement("h3");
    const summary = document.createElement("p");
    const highlight = document.createElement("p");
    const chart = createProgressChart(groupName, days);
    const goal = document.createElement("div");
    const goalCopy = document.createElement("div");
    const goalTrack = document.createElement("div");
    const goalFill = document.createElement("span");
    const totalQuestions = days.reduce((sum, day) => sum + day.questions, 0);
    const totalCorrect = days.reduce((sum, day) => sum + day.correct, 0);
    const accuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const progressMessage = getProgressMessage(days);

    card.className = `progress-card ${groupName === "challenger" ? "challenger-progress" : "cxy-progress"}`;
    heading.className = "progress-card-heading";
    title.textContent = RocketMath.questions.getGroup(groupName).name;
    summary.textContent = `${totalQuestions} questions · ${accuracy}% accuracy`;
    heading.append(title, summary);

    highlight.className = `progress-highlight ${progressMessage.positive ? "is-positive" : "is-steady"}`;
    highlight.textContent = progressMessage.text;

    goal.className = "three-day-goal";
    goalCopy.className = "goal-copy";
    goalCopy.innerHTML = `<strong>${Math.min(totalQuestions, 30)}/30</strong><span>3-day question goal</span>`;
    goalTrack.className = "goal-track";
    goalFill.style.width = `${Math.min(100, (totalQuestions / 30) * 100)}%`;
    goalTrack.appendChild(goalFill);
    goal.append(goalCopy, goalTrack);
    card.append(heading, highlight, chart, goal);
    return card;
  }

  function createProgressChart(groupName, days) {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    const color = groupName === "challenger" ? "#7c5cff" : "#2478d8";
    const fill = groupName === "challenger" ? "#d9ccff" : "#bfe5ff";
    const xPositions = [62, 160, 258];
    const chartBottom = 116;
    const maximumQuestions = Math.max(10, ...days.map((day) => day.questions));
    const points = [];

    svg.classList.add("progress-chart");
    svg.setAttribute("viewBox", "0 0 320 150");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${RocketMath.questions.getGroup(groupName).name} questions and accuracy for the last three days`);

    [25, 50, 75, 100].forEach((percentage) => {
      const y = chartBottom - percentage * 0.82;
      svg.appendChild(svgNode(namespace, "line", { x1: 34, y1: y, x2: 294, y2: y, class: "chart-grid" }));
      svg.appendChild(svgNode(namespace, "text", { x: 4, y: y + 4, class: "chart-axis" }, `${percentage}%`));
    });

    days.forEach((day, index) => {
      const x = xPositions[index];
      const barHeight = (day.questions / maximumQuestions) * 62;
      const accuracyY = chartBottom - day.accuracy * 0.82;
      points.push(`${x},${accuracyY}`);
      svg.appendChild(svgNode(namespace, "rect", {
        x: x - 18,
        y: chartBottom - barHeight,
        width: 36,
        height: Math.max(2, barHeight),
        rx: 8,
        fill,
        class: "question-bar"
      }));
      svg.appendChild(svgNode(namespace, "text", { x, y: chartBottom - barHeight - 5, class: "bar-value" }, `${day.questions}Q`));
      svg.appendChild(svgNode(namespace, "text", { x, y: 143, class: "chart-date" }, day.label));
    });

    svg.appendChild(svgNode(namespace, "polyline", {
      points: points.join(" "),
      fill: "none",
      stroke: color,
      "stroke-width": 4,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      class: "accuracy-line"
    }));
    days.forEach((day, index) => {
      const x = xPositions[index];
      const y = chartBottom - day.accuracy * 0.82;
      svg.appendChild(svgNode(namespace, "circle", { cx: x, cy: y, r: 6, fill: color, class: "accuracy-point" }));
      svg.appendChild(svgNode(namespace, "text", { x, y: Math.max(12, y - 9), class: "accuracy-value" }, `${day.accuracy}%`));
    });
    return svg;
  }

  function svgNode(namespace, name, attributes, text) {
    const node = document.createElementNS(namespace, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text != null) node.textContent = text;
    return node;
  }

  function getProgressMessage(days) {
    const activeDays = days.filter((day) => day.questions > 0);
    if (!activeDays.length) return { positive: false, text: "Ready to begin — one mission starts your progress curve!" };
    if (activeDays.length === 1) return { positive: true, text: `Great start — ${activeDays[0].questions} questions completed!` };
    const previous = activeDays[activeDays.length - 2];
    const latest = activeDays[activeDays.length - 1];
    const accuracyChange = latest.accuracy - previous.accuracy;
    if (accuracyChange > 0) return { positive: true, text: `Fantastic progress — accuracy improved by ${accuracyChange} points!` };
    if (latest.questions > previous.questions) return { positive: true, text: `Strong effort — ${latest.questions - previous.questions} more questions completed!` };
    return { positive: false, text: "Every mission builds confidence — keep your rocket moving!" };
  }

  function getRecentDateKeys(count) {
    const dates = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    for (let offset = count - 1; offset >= 0; offset -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      dates.push({ key: `${year}-${month}-${day}`, label: `${month}/${day}` });
    }
    return dates;
  }

  function renderFocusAreas(progress) {
    const focusAreas = RocketMath.storage.getFocusAreas(progress, 3);
    elements.focusArea.textContent = focusAreas.length
      ? `Power-up ideas: ${focusAreas.map((item) => item.label).join(", ")}`
      : "Rocket tip: make 10 first whenever you can.";
  }

  function renderQuestion(question, questionNumber, totalQuestions, score, missionLabel, config, isRetry, hudState) {
    const ratio = Math.max(0, Math.min(1, questionNumber / totalQuestions));
    elements.missionLabel.textContent = missionLabel;
    elements.missionConfig.textContent = isRetry ? "One at a time" : shortConfig(config);
    elements.questionNumber.textContent = questionNumber;
    elements.questionTotal.textContent = totalQuestions;
    elements.questionProgress.style.width = `${ratio * 100}%`;
    elements.progressTrack.setAttribute("aria-valuenow", String(questionNumber));
    elements.progressTrack.setAttribute("aria-valuemax", String(totalQuestions));
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
    updateStreak(hudState && hudState.currentStreak);
    updateCompetitionHud(hudState);
  }

  function shortConfig(config) {
    const normalized = RocketMath.questions.normalizeOptions(config);
    const difficulty = RocketMath.questions.getDifficulty(normalized.difficulty).label;
    return `${difficulty} · 1–${normalized.rangeMax}`;
  }

  function updateTimer(seconds) {
    elements.timer.textContent = seconds;
  }

  function updateScore(score) {
    elements.score.textContent = score;
    RocketMath.animation.pulse(elements.score);
  }

  function updateStreak(streak) {
    elements.streak.textContent = Math.max(0, Number(streak) || 0);
  }

  function updateCompetitionHud(hudState) {
    const hud = hudState || {};
    const visible = hud.mode === "competition" && !hud.isRetry;
    elements.competitionHud.classList.toggle("hidden", !visible);
    if (!visible) return;
    elements.liveCxyStars.textContent = Math.max(0, Number(hud.cxyStars) || 0);
    elements.liveChallengerStars.textContent = Math.max(0, Number(hud.challengerStars) || 0);
    elements.competitionHud.querySelectorAll("[data-live-player]").forEach((item) => {
      item.classList.toggle("active", item.dataset.livePlayer === hud.activeGroup);
    });
  }

  function setAnswerButtonsDisabled(disabled) {
    elements.answerButtons.querySelectorAll("button").forEach((button) => {
      button.disabled = disabled;
    });
  }

  function markAnswer(chosenAnswer, correctAnswer, revealCorrect) {
    elements.answerButtons.querySelectorAll("button").forEach((button) => {
      const value = Number(button.dataset.answer);
      button.classList.toggle("correct", Boolean(revealCorrect) && value === correctAnswer);
      button.classList.toggle("wrong", value === chosenAnswer && chosenAnswer !== correctAnswer);
    });
  }

  function showHint(hint) {
    elements.hintText.textContent = `💡 ${safeText(hint)}`;
  }

  function showMessage(message, tone) {
    elements.message.textContent = safeText(message);
    elements.message.classList.remove("message-pop", "message-success", "message-encourage");
    if (tone === "success") elements.message.classList.add("message-success");
    if (tone === "encourage") elements.message.classList.add("message-encourage");
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
    elements.resultCelebrationIcon.textContent = result.correctionRate === 100 ? "🌟" : "⭐";
    elements.resultCelebrationIcon.classList.remove("is-trophy");
    elements.finalScore.textContent = result.baseStars + (result.retryStars || 0);
    elements.finalCorrect.textContent = `${result.correctCount}/${result.totalQuestions}`;
    elements.finalRate.textContent = `${result.correctionRate}%`;
    elements.finalAverage.textContent = Number(result.averageCorrectSeconds) || 0;
    elements.finalTime.textContent = result.elapsedSeconds;
    elements.comparisonMessage.textContent = buildComparisonText(previous, result);
    renderRewardBreakdown(result.rewards, result.retryStars);
    elements.competitionResult.classList.add("hidden");
    elements.competitionResult.classList.remove("winner-celebration");
    elements.competitionNextButton.classList.add("hidden");
    elements.reviewSection.classList.remove("hidden");
    elements.retryActions.innerHTML = "";
    elements.reviewTitle.textContent = "Mistake review";

    if (!result.wrongAnswers.length) {
      elements.reviewSummary.textContent = "Perfect score — every answer was correct!";
      elements.reviewSection.classList.add("perfect-review");
      celebrate();
      return;
    }

    elements.reviewSection.classList.remove("perfect-review");
    const remaining = result.wrongAnswers.filter((item) => !progress.completedRetries.includes(item.id)).length;
    elements.reviewSummary.textContent = remaining
      ? `${remaining} tricky ${remaining === 1 ? "question" : "questions"} · practise one at a time for bonus stars.`
      : `Great comeback — all ${result.wrongAnswers.length} tricky questions are fixed.`;
    if (remaining && !view.hideRetry) elements.retryActions.appendChild(createRetryButton(result.groupName, remaining));
    if (retryComplete) {
      const complete = document.createElement("p");
      complete.className = "retry-complete-message";
      complete.textContent = `+${result.retryStars || 0} review ⭐`;
      elements.retryActions.appendChild(complete);
    }
  }

  function renderRewardBreakdown(rewards, retryStars) {
    elements.rewardBreakdown.innerHTML = "";
    const source = rewards || {};
    const items = [
      ["Completed", source.completion],
      ["Correct", source.correct],
      ["Accuracy", source.accuracy],
      ["Accuracy ↑", source.accuracyImprovement],
      ["Speed ↑", source.speedImprovement],
      ["5 streak", source.streak],
      ["Challenge", source.difficulty],
      ["Review", retryStars]
    ];
    items.forEach(([label, value]) => {
      if (!(Number(value) > 0)) return;
      const chip = document.createElement("span");
      chip.className = "reward-chip";
      chip.textContent = `${label} +${value}⭐`;
      elements.rewardBreakdown.appendChild(chip);
    });
  }

  function renderCompetitionPrompt(result, progress, previous) {
    renderResult(result, progress, previous, { hideRetry: true });
    elements.resultTitle.textContent = "CXY turn complete! 🚀";
    elements.resultMessage.textContent = "Congratulations, CXY — your first competition mission is complete! Great progress. Pass the device to Challenger.";
    elements.resultCelebrationIcon.textContent = "🚀";
    elements.comparisonMessage.textContent = "Challenger’s questions use the saved parent settings.";
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
    const averageValues = [cxy.averageCorrectSeconds, challenger.averageCorrectSeconds].filter((value) => value > 0);
    const combinedAverage = averageValues.length
      ? Number((averageValues.reduce((sum, value) => sum + value, 0) / averageValues.length).toFixed(1))
      : 0;

    elements.resultTitle.textContent = comparison.winner;
    elements.resultMessage.textContent = completionMessage || comparison.message;
    elements.resultCelebrationIcon.textContent = "🏆";
    elements.resultCelebrationIcon.classList.add("is-trophy");
    elements.finalScore.textContent = combinedStars;
    elements.finalCorrect.textContent = `${combinedCorrect}/${combinedTotal}`;
    elements.finalRate.textContent = `${Math.round((combinedCorrect / combinedTotal) * 100)}%`;
    elements.finalAverage.textContent = combinedAverage;
    elements.finalTime.textContent = cxy.elapsedSeconds + challenger.elapsedSeconds;
    elements.comparisonMessage.textContent = "Mission stars decide the winner; accuracy and careful speed break a tie.";
    renderRewardBreakdown({
      completion: cxy.rewards.completion + challenger.rewards.completion,
      correct: cxy.rewards.correct + challenger.rewards.correct,
      accuracy: cxy.rewards.accuracy + challenger.rewards.accuracy,
      difficulty: cxy.rewards.difficulty + challenger.rewards.difficulty
    }, (cxy.retryStars || 0) + (challenger.retryStars || 0));
    elements.competitionNextButton.classList.add("hidden");
    elements.competitionResult.classList.remove("hidden");
    elements.competitionResult.classList.add("winner-celebration");
    elements.competitionResult.innerHTML = "";
    elements.competitionResult.append(
      createCompetitionCard("CXY", cxy, comparison.bonuses.cxy, comparison.winnerGroup),
      createCompetitionCard("Challenger", challenger, comparison.bonuses.challenger, comparison.winnerGroup)
    );

    const cxyRemaining = countRemaining(cxy, progress);
    const challengerRemaining = countRemaining(challenger, progress);
    const totalRemaining = cxyRemaining + challengerRemaining;
    elements.retryActions.innerHTML = "";
    elements.reviewSection.classList.toggle("hidden", totalRemaining === 0);
    elements.reviewTitle.textContent = "Competition review";
    elements.reviewSummary.textContent = totalRemaining
      ? `${totalRemaining} tricky ${totalRemaining === 1 ? "question" : "questions"} ready for bonus stars.`
      : "All tricky questions have been reviewed.";
    if (cxyRemaining) elements.retryActions.appendChild(createRetryButton("cxy", cxyRemaining));
    if (challengerRemaining) elements.retryActions.appendChild(createRetryButton("challenger", challengerRemaining));
    celebrate();
  }

  function createCompetitionCard(label, result, winnerBonus, winnerGroup) {
    const card = document.createElement("div");
    const title = document.createElement("h3");
    const score = document.createElement("p");
    const details = document.createElement("p");
    const encouragement = document.createElement("p");
    const groupName = label === "Challenger" ? "challenger" : "cxy";
    const isWinner = winnerGroup === "draw" || winnerGroup === groupName;
    card.className = `competition-score-card ${isWinner ? "competition-winner-card" : "competition-encourage-card"}`;
    title.textContent = label;
    score.className = "big-score";
    score.textContent = `${result.baseStars}⭐ · ${result.correctionRate}% · ${result.averageCorrectSeconds || 0}s avg`;
    details.textContent = `${shortConfig(result)} · ×${Number(result.difficultyMultiplier).toFixed(2)} · winner +${winnerBonus}`;
    encouragement.className = "competition-card-message";
    encouragement.textContent = isWinner
      ? "🏆 Congratulations — fantastic progress!"
      : "🚀 Strong effort — your comeback starts with the next mission!";
    card.append(title, score, details, encouragement);
    return card;
  }

  function createRetryButton(groupName, count) {
    const button = document.createElement("button");
    button.className = "retry-button";
    button.type = "button";
    button.dataset.retryGroup = groupName;
    button.textContent = `Review ${RocketMath.questions.getGroup(groupName).name} (${count})`;
    return button;
  }

  function countRemaining(result, progress) {
    return result.wrongAnswers.filter((item) => !progress.completedRetries.includes(item.id)).length;
  }

  function allWrongQuestionsReviewed(result, progress) {
    return result.wrongAnswers.length > 0
      && result.wrongAnswers.every((item) => progress.completedRetries.includes(item.id));
  }

  function buildComparisonText(previous, result) {
    if (!previous) return "First mission at these settings — your rocket journey starts here!";
    const rateChange = result.correctionRate - previous.correctionRate;
    const speedChange = Number(previous.averageCorrectSeconds) - Number(result.averageCorrectSeconds);
    const rateText = rateChange > 0
      ? `Accuracy improved by ${rateChange} points.`
      : (rateChange === 0 ? "Accuracy matched the last mission." : "Careful practice will build accuracy.");
    const speedText = result.correctionRate >= previous.correctionRate && speedChange > 0
      ? `Correct answers were ${speedChange.toFixed(1)}s faster on average.`
      : "Accuracy comes before speed.";
    return `${rateText} ${speedText}`;
  }

  function celebrate() {
    document.body.classList.add("is-celebrating");
    window.setTimeout(() => document.body.classList.remove("is-celebrating"), 2400);
  }

  RocketMath.ui = {
    elements,
    showScreen,
    showSetupMode,
    showGroupTab,
    applyConfigs,
    getConfig,
    formatConfig,
    updateCompetitionSummaries,
    renderProgress,
    renderQuestion,
    updateTimer,
    updateScore,
    updateStreak,
    updateCompetitionHud,
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
