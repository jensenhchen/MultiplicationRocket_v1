(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};
  const { randomNumber, shuffle } = RocketMath.utils;

  const GROUPS = {
    cxy: {
      name: "CXY",
      description: "Tables 1 to 9",
      levels: {
        easy: { min: 1, max: 5, label: "Easy", description: "Tables 1 to 5" },
        medium: { min: 1, max: 7, label: "Medium", description: "Tables 1 to 7" },
        hard: { min: 1, max: 9, label: "Hard", description: "Tables 1 to 9" }
      }
    },
    cxr: {
      name: "CXR",
      description: "Tables 11 to 20",
      levels: {
        easy: { min: 11, max: 13, label: "Easy", description: "Tables 11 to 13" },
        medium: { min: 11, max: 16, label: "Medium", description: "Tables 11 to 16" },
        hard: { min: 11, max: 20, label: "Hard", description: "Tables 11 to 20" }
      }
    }
  };

  function getGroup(groupName) {
    return GROUPS[groupName] || GROUPS.cxy;
  }

  function getLevel(groupName, levelName) {
    const group = getGroup(groupName);
    return group.levels[levelName] || group.levels.easy;
  }

  function createQuestion(groupName, levelName) {
    const level = getLevel(groupName, levelName);
    const first = randomNumber(level.min, level.max);
    const second = randomNumber(level.min, level.max);
    const answer = first * second;

    return {
      group: getGroup(groupName).name,
      first,
      second,
      answer,
      table: Math.max(first, second),
      text: `${first} x ${second} = ?`,
      hint: buildHint(first, second),
      choices: createAnswerChoices(answer, level.min, level.max)
    };
  }

  function createAnswerChoices(correctAnswer, levelMin, levelMax) {
    const choices = new Set([correctAnswer]);
    const nearbyOffsets = [-40, -20, -10, -5, -3, -2, -1, 1, 2, 3, 5, 10, 20, 40];
    let attempts = 0;

    while (choices.size < 4 && attempts < 80) {
      attempts += 1;
      const useNearby = Math.random() > 0.25;
      const candidate = useNearby
        ? correctAnswer + nearbyOffsets[randomNumber(0, nearbyOffsets.length - 1)]
        : randomNumber(levelMin, levelMax) * randomNumber(levelMin, levelMax);

      if (candidate > 0 && candidate <= 400) {
        choices.add(candidate);
      }
    }

    while (choices.size < 4) {
      choices.add(randomNumber(levelMin, levelMax) * randomNumber(levelMin, levelMax));
    }

    return shuffle([...choices]);
  }

  function buildHint(first, second) {
    if (second > 10) {
      return `${second} groups of ${first}. Think ${first} x 10 plus ${first} x ${second - 10}.`;
    }

    const groups = Array.from({ length: second }, () => first).join(" + ");
    return `${second} groups of ${first}: ${groups}`;
  }

  RocketMath.questions = {
    GROUPS,
    getGroup,
    getLevel,
    createQuestion
  };

  window.RocketMath = RocketMath;
})();
