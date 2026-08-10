(function () {
  "use strict";

  const RocketMath = window.RocketMath;
  const ui = RocketMath.ui;
  let operatorClickTimer = null;
  let operatorClickCount = 0;

  async function boot() {
    const localProgress = RocketMath.storage.loadProgress();
    let progress = localProgress;
    try {
      progress = await RocketMath.storage.loadServerProgress(localProgress);
    } catch (error) {
      // Continue with the on-device copy when the server is offline.
    }
    RocketMath.game.init(progress);
    ui.updateAudioButtons(RocketMath.audio.getSettings());
    bindEvents();
    startProgressSync();
    registerServiceWorker();
  }

  function startProgressSync() {
    let lastSyncAt = 0;
    const sync = () => {
      const now = Date.now();
      if (now - lastSyncAt < 1200) return;
      lastSyncAt = now;
      RocketMath.storage.syncServerProgress().catch(() => {
        // The local copy remains usable until the shared server is reachable.
      });
    };

    window.setInterval(sync, 6000);
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") sync();
    });
  }

  function bindEvents() {
    if (ui.elements.operatorTitleImage) {
      ui.elements.operatorTitleImage.addEventListener("click", (event) => {
        event.preventDefault();
        operatorClickCount += 1;
        if (operatorClickTimer) window.clearTimeout(operatorClickTimer);

        if (operatorClickCount >= 3) {
          operatorClickCount = 0;
          operatorClickTimer = null;
          applyHiddenChallengerAdjustment(-20);
          return;
        }

        operatorClickTimer = window.setTimeout(() => {
          if (operatorClickCount === 2) applyHiddenChallengerAdjustment(20);
          operatorClickTimer = null;
          operatorClickCount = 0;
        }, 420);
      });
      ui.elements.operatorTitleImage.addEventListener("dblclick", (event) => event.preventDefault());
    }

    ui.elements.configSelects.forEach((select) => {
      select.addEventListener("focus", () => {
        const label = select.closest("label");
        if (label) label.classList.add("select-expanded");
      });

      select.addEventListener("blur", () => {
        const label = select.closest("label");
        if (label) label.classList.remove("select-expanded");
      });

      select.addEventListener("change", () => {
        RocketMath.audio.play("click");
        const context = select.dataset.configContext || "practice";
        if (context === "practice") {
          RocketMath.game.saveConfig(ui.getConfig(select.dataset.configGroup, "practice"));
        }
        ui.updateCompetitionSummaries();
      });
    });

    ui.elements.startPracticeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        RocketMath.audio.unlock();
        RocketMath.audio.play("click");
        RocketMath.game.start({
          ...ui.getConfig(button.dataset.group, "practice"),
          mode: "practice"
        });
      });
    });

    ui.elements.startCompetitionButton.addEventListener("click", () => {
      RocketMath.audio.unlock();
      RocketMath.audio.play("click");
      RocketMath.game.startCompetition({
        cxy: ui.getConfig("cxy", "competition"),
        challenger: ui.getConfig("challenger", "competition")
      });
    });

    ui.elements.answerButtons.addEventListener("click", (event) => {
      const button = event.target.closest(".answer-button");
      if (!button) return;
      RocketMath.audio.unlock();
      RocketMath.audio.play("click");
      RocketMath.game.answer(button.dataset.answer);
    });

    ui.elements.hintButton.addEventListener("click", () => {
      RocketMath.audio.play("click");
      RocketMath.game.showHint();
    });

    ui.elements.goBackButton.addEventListener("click", () => {
      RocketMath.audio.play("click");
      RocketMath.game.leaveMission("back");
    });

    ui.elements.goHomeButton.addEventListener("click", () => {
      RocketMath.audio.play("click");
      RocketMath.game.leaveMission("home");
    });

    ui.elements.resultScreen.addEventListener("click", (event) => {
      const retryButton = event.target.closest("[data-retry-group]");
      if (!retryButton) return;
      RocketMath.audio.play("click");
      RocketMath.game.startRetry(retryButton.dataset.retryGroup);
    });

    ui.elements.playAgainButton.addEventListener("click", () => {
      RocketMath.audio.play("click");
      RocketMath.game.leaveMission("back");
    });

    ui.elements.resultHomeButton.addEventListener("click", () => {
      RocketMath.audio.play("click");
      RocketMath.game.leaveMission("home");
    });

    ui.elements.continueRaceButton.addEventListener("click", () => {
      RocketMath.audio.play("click");
      RocketMath.game.continueRace();
    });

    ui.elements.exitRaceButton.addEventListener("click", () => {
      RocketMath.audio.play("click");
      RocketMath.game.exitRace();
    });

    ui.elements.raceExitDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      RocketMath.game.continueRace();
    });

    ui.elements.competitionNextButton.addEventListener("click", () => {
      RocketMath.audio.play("click");
      RocketMath.game.startNextCompetitionTurn();
    });

    ui.elements.soundToggle.addEventListener("click", () => {
      RocketMath.audio.unlock();
      RocketMath.audio.toggleSound();
      ui.updateAudioButtons(RocketMath.audio.getSettings());
    });

    ui.elements.musicToggle.addEventListener("click", () => {
      RocketMath.audio.unlock();
      RocketMath.audio.toggleMusic();
      ui.updateAudioButtons(RocketMath.audio.getSettings());
    });

    document.addEventListener("keydown", (event) => {
      if (event.key < "1" || event.key > "4") return;
      const buttons = [...ui.elements.answerButtons.querySelectorAll(".answer-button:not(:disabled)")];
      const button = buttons[Number(event.key) - 1];
      if (button) button.click();
    });
  }

  function applyHiddenChallengerAdjustment(amount) {
    RocketMath.audio.unlock();
    const applied = RocketMath.game.adjustChallengerPracticeStars(amount);
    if (!applied) return;
    RocketMath.audio.play(applied > 0 ? "complete" : "wrong");
    ui.showSecretStarFeedback(applied);
  }

  function registerServiceWorker() {
    const canUseServiceWorker = "serviceWorker" in navigator
      && (window.location.protocol === "https:" || window.location.hostname === "localhost");

    if (!canUseServiceWorker) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch(() => {
        // The game still works online if service worker registration is unavailable.
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { void boot(); });
  } else {
    void boot();
  }
})();
