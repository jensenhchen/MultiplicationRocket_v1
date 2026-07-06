(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};

  function randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(items) {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = randomNumber(0, index);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    return shuffled;
  }

  function todayString() {
    return new Date().toISOString().slice(0, 10);
  }

  function safeText(value) {
    return String(value == null ? "" : value);
  }

  RocketMath.utils = {
    randomNumber,
    shuffle,
    todayString,
    safeText
  };

  window.RocketMath = RocketMath;
})();
