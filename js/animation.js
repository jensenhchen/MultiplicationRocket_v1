(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};

  function moveRocket(rocketElement, progressRatio) {
    if (!rocketElement) return;

    const safeProgress = Math.max(0, Math.min(1, progressRatio));
    rocketElement.style.bottom = `${10 + safeProgress * 72}%`;
    rocketElement.style.setProperty("--rocket-progress", safeProgress);
  }

  function pulse(element) {
    if (!element) return;

    element.classList.remove("pulse");
    window.requestAnimationFrame(() => element.classList.add("pulse"));
  }

  function setRocketState(rocketElement, stateName) {
    if (!rocketElement) return;

    const rocketArea = rocketElement.closest(".rocket-area");
    rocketElement.classList.remove("is-idle", "is-correct", "is-wrong", "is-complete");
    if (rocketArea) {
      rocketArea.classList.remove("is-idle", "is-correct", "is-wrong", "is-complete");
    }

    window.requestAnimationFrame(() => {
      rocketElement.classList.add(`is-${stateName}`);
      if (rocketArea) {
        rocketArea.classList.add(`is-${stateName}`);
      }
    });
  }

  RocketMath.animation = {
    moveRocket,
    pulse,
    setRocketState
  };

  window.RocketMath = RocketMath;
})();
