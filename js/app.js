(function () {
  "use strict";

  const RocketMath = window.RocketMath;
  const ui = RocketMath.ui;

  function boot() {
    const progress = RocketMath.storage.loadProgress();
    RocketMath.game.init(progress);
    ui.updateAudioButtons(RocketMath.audio.getSettings());
    bindEvents();
    registerServiceWorker();
  }

  function bindEvents() {
    ui.elements.configSelects.forEach((select) => {
      select.addEventListener("change", () => {
        RocketMath.audio.play("click");
        ui.updateCompetitionSummaries();
      });
    });

    ui.elements.startPracticeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        RocketMath.audio.unlock();
        RocketMath.audio.play("click");
        RocketMath.game.start({
          ...ui.getConfig(button.dataset.group),
          mode: "practice"
        });
      });
    });

    ui.elements.startCompetitionButton.addEventListener("click", () => {
      RocketMath.audio.unlock();
      RocketMath.audio.play("click");
      RocketMath.game.startCompetition({
        cxy: ui.getConfig("cxy"),
        challenger: ui.getConfig("challenger")
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

    ui.elements.resultScreen.addEventListener("click", (event) => {
      const retryButton = event.target.closest("[data-retry-group]");
      if (!retryButton) return;
      RocketMath.audio.play("click");
      RocketMath.game.startRetry(retryButton.dataset.retryGroup);
    });

    ui.elements.playAgainButton.addEventListener("click", () => {
      RocketMath.audio.play("click");
      RocketMath.game.showStart();
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

    ui.elements.resetProgressButton.addEventListener("click", () => {
      RocketMath.audio.play("click");
      RocketMath.game.resetProgress();
      ui.elements.savedProgress.textContent = "Progress reset. Ready for a fresh launch!";
    });

    document.addEventListener("keydown", (event) => {
      if (event.key < "1" || event.key > "4") return;
      const buttons = [...ui.elements.answerButtons.querySelectorAll(".answer-button:not(:disabled)")];
      const button = buttons[Number(event.key) - 1];
      if (button) button.click();
    });
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
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
