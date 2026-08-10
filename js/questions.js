(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};
  const { randomNumber, shuffle } = RocketMath.utils;

  const GROUPS = {
    cxy: {
      name: "CXY",
      ranges: [10, 15, 20],
      defaultRange: 10,
      defaultDifficulty: "easy"
    },
    challenger: {
      name: "Challenger",
      ranges: [15, 25, 30],
      defaultRange: 25,
      defaultDifficulty: "medium"
    }
  };

  const DIFFICULTIES = {
    easy: { label: "Easy", operandCount: 2 },
    medium: { label: "Medium", operandCount: 3 },
    hard: { label: "Hard", operandCount: 4 }
  };

  const OPERATION_SETS = {
    "add-sub": { label: "Addition & Subtraction", operators: ["add", "subtract"] },
    "mul-div": { label: "Multiplication & Division", operators: ["multiply", "divide"] },
    all: { label: "All Four Operations", operators: ["add", "subtract", "multiply", "divide"] }
  };

  const OPERATOR_DETAILS = {
    add: { symbol: "+", word: "add" },
    subtract: { symbol: "−", word: "subtract" },
    multiply: { symbol: "×", word: "multiply by" },
    divide: { symbol: "÷", word: "divide by" }
  };

  const CXY_STRATEGY_PLAN = Object.freeze([
    "make-ten",
    "break-ten",
    "make-ten",
    "break-ten",
    "make-ten",
    "break-ten",
    "reinforce",
    "reinforce",
    "varied",
    "varied"
  ]);

  const EASY_MUL_DIV_PLAN = Object.freeze([
    "two-digit-multiply-no-carry",
    null,
    "two-digit-multiply-carry",
    null,
    "two-digit-divide",
    null,
    "two-digit-multiply-no-carry",
    null,
    "two-digit-multiply-carry",
    null
  ]);

  const GENERATION_RULES = {
    attemptsPerQuestion: 320,
    attemptsPerSetItem: 100,
    multiplicationTables: {
      cxy: {
        easy: [2, 5, 10],
        medium: [2, 3, 4, 5, 10],
        hard: [2, 3, 4, 5, 6, 7, 8, 9, 10]
      },
      challenger: {
        easy: [2, 3, 4, 5, 10],
        medium: [2, 3, 4, 5, 6, 8, 9, 10],
        hard: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      }
    },
    resultLimits: {
      cxy: { easy: 50, medium: 80, hard: 120 },
      challenger: { easy: 120, medium: 240, hard: 360 }
    }
  };

  function normalizeOptions(options) {
    const requested = options || {};
    const groupName = GROUPS[requested.groupName] ? requested.groupName : "cxy";
    const group = GROUPS[groupName];
    const difficulty = DIFFICULTIES[requested.difficulty]
      ? requested.difficulty
      : group.defaultDifficulty;
    const operationSet = OPERATION_SETS[requested.operationSet]
      ? requested.operationSet
      : "add-sub";
    const numericRange = Number(requested.rangeMax);
    const rangeMax = group.ranges.includes(numericRange) ? numericRange : group.defaultRange;

    return { groupName, difficulty, operationSet, rangeMax };
  }

  function createQuestionSet(options, count) {
    const config = normalizeOptions(options);
    const total = Number.isInteger(count) && count > 0 ? count : 10;
    const questions = [];
    const signatures = new Set();

    for (let index = 0; index < total; index += 1) {
      let question = null;
      const setStrategy = getSetQuestionStrategy(config, index);

      for (let attempt = 0; attempt < GENERATION_RULES.attemptsPerSetItem; attempt += 1) {
        const candidate = createQuestion(config, index + attempt * total, setStrategy);
        if (!signatures.has(candidate.signature)) {
          question = candidate;
          break;
        }
      }

      if (!question) question = createQuestion(config, index, setStrategy);
      signatures.add(question.signature);
      questions.push(question);
    }

    return questions;
  }

  function createQuestion(options, questionIndex, requestedStrategy) {
    const config = normalizeOptions(options);
    const index = Math.abs(Number(questionIndex) || 0);
    const strategy = requestedStrategy || getStrategy(config, index);
    const resultLimit = getResultLimit(config);

    for (let attempt = 0; attempt < GENERATION_RULES.attemptsPerQuestion; attempt += 1) {
      const built = isTwoDigitFactStrategy(strategy)
        ? buildEasyTwoDigitFact(config, strategy, resultLimit)
        : (config.groupName === "cxy" && config.operationSet === "add-sub"
          ? buildCxyAddSubtract(config, strategy, index + attempt)
          : buildGeneralExpression(config, index + attempt, resultLimit));

      if (!built) continue;
      const expression = formatExpression(built.numbers, built.operators);
      const question = {
        group: GROUPS[config.groupName].name,
        ...config,
        strategy: built.strategy || strategy,
        numbers: built.numbers,
        operators: built.operators,
        intermediateResults: built.intermediateResults,
        answer: built.answer,
        expression,
        text: `${expression} = ?`,
        hint: built.hint || buildHint(built),
        signature: `${built.operators.join("-")}:${built.numbers.join("-")}`,
        choices: createAnswerChoices(built.answer, resultLimit, config.rangeMax)
      };

      if (validateQuestion(question).valid) return question;
    }

    return createFallbackQuestion(config, index, strategy);
  }

  function getSetQuestionStrategy(config, questionIndex) {
    if (config.operationSet !== "mul-div" || config.difficulty !== "easy") return null;
    return EASY_MUL_DIV_PLAN[questionIndex % EASY_MUL_DIV_PLAN.length];
  }

  function isTwoDigitFactStrategy(strategy) {
    return strategy === "two-digit-multiply-carry"
      || strategy === "two-digit-multiply-no-carry"
      || strategy === "two-digit-divide";
  }

  function buildEasyTwoDigitFact(config, strategy, resultLimit) {
    const singleDigits = getMultiplicationTable(config).filter((value) => value >= 2 && value <= 9);
    if (!singleDigits.length) return null;

    if (strategy === "two-digit-divide") {
      const candidates = [];
      singleDigits.forEach((divisor) => {
        const minimumQuotient = Math.ceil(10 / divisor);
        const maximumQuotient = Math.min(Math.floor(99 / divisor), Math.floor(resultLimit / divisor));
        for (let quotient = minimumQuotient; quotient <= maximumQuotient; quotient += 1) {
          const dividend = divisor * quotient;
          if (dividend >= 10 && dividend <= 99) candidates.push([dividend, divisor]);
        }
      });
      if (!candidates.length) return null;
      const [dividend, divisor] = candidates[randomNumber(0, candidates.length - 1)];
      return makeStep(
        [dividend, divisor],
        ["divide"],
        strategy,
        `Use the fact family: ${divisor} × ${dividend / divisor} = ${dividend}`
      );
    }

    const requiresCarry = strategy === "two-digit-multiply-carry";
    const candidates = [];
    singleDigits.forEach((factor) => {
      const maximum = Math.min(99, Math.floor(resultLimit / factor));
      for (let multiplicand = 10; multiplicand <= maximum; multiplicand += 1) {
        const carriesFromOnes = (multiplicand % 10) * factor >= 10;
        if (carriesFromOnes === requiresCarry) candidates.push([multiplicand, factor]);
      }
    });
    if (!candidates.length) return null;
    const [multiplicand, factor] = candidates[randomNumber(0, candidates.length - 1)];
    const onesProduct = (multiplicand % 10) * factor;
    const hint = requiresCarry
      ? `Multiply the ones first: ${multiplicand % 10} × ${factor} = ${onesProduct}, then carry the ten`
      : `Multiply the ones first: ${multiplicand % 10} × ${factor} = ${onesProduct}, with no carry`;
    return makeStep([multiplicand, factor], ["multiply"], strategy, hint);
  }

  function getStrategy(config, questionIndex) {
    if (config.groupName === "cxy" && config.operationSet === "add-sub") {
      return CXY_STRATEGY_PLAN[questionIndex % CXY_STRATEGY_PLAN.length];
    }
    if (config.operationSet === "mul-div") return "fact-family";
    return "varied";
  }

  function buildCxyAddSubtract(config, strategy, questionIndex) {
    const operandCount = DIFFICULTIES[config.difficulty].operandCount;
    let firstStep;

    if (strategy === "make-ten") firstStep = buildMakeTenStep(config, operandCount, questionIndex);
    if (strategy === "break-ten") firstStep = buildBreakTenStep(config, operandCount, questionIndex);
    if (strategy === "reinforce") firstStep = buildReinforcementStep(config, questionIndex);
    if (!firstStep) firstStep = buildVariedAddSubtractStep(config, questionIndex);
    if (!firstStep) return null;

    const numbers = [...firstStep.numbers];
    const operators = [...firstStep.operators];
    const intermediateResults = [...firstStep.intermediateResults];
    let current = firstStep.answer;

    while (numbers.length < operandCount) {
      const preferSubtract = current >= config.rangeMax - 2
        || (numbers.length + questionIndex) % 2 === 0;
      let operator = preferSubtract ? "subtract" : "add";
      let next = chooseAddSubtractOperand(operator, current, config.rangeMax);

      if (next == null) {
        operator = operator === "add" ? "subtract" : "add";
        next = chooseAddSubtractOperand(operator, current, config.rangeMax);
      }
      if (next == null) return null;

      current = applyOperator(operator, current, next);
      numbers.push(next);
      operators.push(operator);
      intermediateResults.push(current);
    }

    return {
      numbers,
      operators,
      intermediateResults,
      answer: current,
      strategy,
      hint: firstStep.hint
    };
  }

  function buildMakeTenStep(config, operandCount, questionIndex) {
    const start = randomNumber(6, 9);
    const toTen = 10 - start;

    if (operandCount === 2 && config.rangeMax > 10) {
      const extraMax = Math.max(1, Math.min(config.rangeMax - 10, 6));
      const extra = randomNumber(1, extraMax);
      const second = toTen + extra;
      return makeStep(
        [start, second],
        ["add"],
        "make-ten",
        `Make 10 first: ${start} + ${toTen} = 10, then add ${extra}`
      );
    }

    const safeStart = config.rangeMax < 10 ? Math.max(1, config.rangeMax - 4) : start;
    const complement = config.rangeMax < 10 ? config.rangeMax - safeStart : toTen;
    if (complement < 1) return null;
    return makeStep(
      [safeStart, complement],
      ["add"],
      "make-ten",
      `Make ${config.rangeMax < 10 ? config.rangeMax : 10} first: ${safeStart} + ${complement}`
    );
  }

  function buildBreakTenStep(config, operandCount, questionIndex) {
    if (config.rangeMax <= 10) {
      const subtract = randomNumber(1, 9);
      return makeStep(
        [10, subtract],
        ["subtract"],
        "break-ten",
        `Start at 10 and count back ${subtract}`
      );
    }

    let start = randomNumber(11, config.rangeMax);
    if (start % 10 === 0) start = Math.max(11, start - 1);
    const ones = start % 10;

    if (operandCount === 2) {
      const extra = randomNumber(1, Math.max(1, Math.min(6, 9 - ones)));
      const subtract = ones + extra;
      return makeStep(
        [start, subtract],
        ["subtract"],
        "break-ten",
        `Break ${subtract} into ${ones} and ${extra}: ${start} − ${ones} − ${extra}`
      );
    }

    return makeStep(
      [start, ones],
      ["subtract"],
      "break-ten",
      `Reach 10 first: ${start} − ${ones} = 10`
    );
  }

  function buildReinforcementStep(config, questionIndex) {
    const useAddition = questionIndex % 2 === 0;
    if (useAddition) {
      const left = randomNumber(1, Math.min(8, config.rangeMax - 1));
      const right = randomNumber(1, Math.max(1, Math.min(config.rangeMax - left, 10 - left)));
      return makeStep([left, right], ["add"], "reinforce", `Count on from ${left} by ${right}`);
    }

    const left = randomNumber(3, config.rangeMax);
    const right = randomNumber(1, left);
    return makeStep([left, right], ["subtract"], "reinforce", `Count back from ${left} by ${right}`);
  }

  function buildVariedAddSubtractStep(config, questionIndex) {
    const operator = questionIndex % 2 === 0 ? "add" : "subtract";
    if (operator === "add") {
      const left = randomNumber(1, config.rangeMax - 1);
      const right = randomNumber(1, config.rangeMax - left);
      return makeStep([left, right], [operator], "varied", `Look for a pair that makes 10`);
    }

    const left = randomNumber(2, config.rangeMax);
    const right = randomNumber(1, left);
    return makeStep([left, right], [operator], "varied", `Count back in a comfortable step`);
  }

  function makeStep(numbers, operators, strategy, hint) {
    let current = numbers[0];
    const intermediateResults = [];
    operators.forEach((operator, index) => {
      current = applyOperator(operator, current, numbers[index + 1]);
      intermediateResults.push(current);
    });
    return { numbers, operators, intermediateResults, answer: current, strategy, hint };
  }

  function chooseAddSubtractOperand(operator, current, rangeMax) {
    if (operator === "add") {
      const maximum = rangeMax - current;
      return maximum >= 1 ? randomNumber(1, Math.min(maximum, 6)) : null;
    }
    const maximum = Math.min(current, 6);
    return maximum >= 1 ? randomNumber(1, maximum) : null;
  }

  function buildGeneralExpression(config, questionIndex, resultLimit) {
    const operatorCount = DIFFICULTIES[config.difficulty].operandCount - 1;
    const operators = buildOperatorPlan(config, operatorCount, questionIndex);
    const numbers = [chooseStartingNumber(config, operators[0], resultLimit)];
    const intermediateResults = [];
    let current = numbers[0];

    for (const operator of operators) {
      const next = chooseOperand(operator, current, config, resultLimit);
      if (next == null) return null;
      const calculated = applyOperator(operator, current, next);
      if (!Number.isInteger(calculated) || calculated < 0 || calculated > resultLimit) return null;
      numbers.push(next);
      intermediateResults.push(calculated);
      current = calculated;
    }

    return {
      numbers,
      operators,
      intermediateResults,
      answer: current,
      strategy: config.operationSet === "mul-div" ? "fact-family" : "varied"
    };
  }

  function buildOperatorPlan(config, count, questionIndex) {
    const allowed = OPERATION_SETS[config.operationSet].operators;
    const offset = questionIndex % allowed.length;
    const operators = [];

    for (let index = 0; index < count; index += 1) {
      let operator = allowed[(offset + index) % allowed.length];
      if (config.groupName === "cxy" && config.operationSet === "all" && count > 1) {
        const existingComplex = operators.filter((item) => item === "multiply" || item === "divide").length;
        const complexLimit = config.difficulty === "hard" ? 2 : 1;
        if ((operator === "multiply" || operator === "divide") && existingComplex >= complexLimit) {
          operator = index % 2 === 0 ? "add" : "subtract";
        }
      }
      operators.push(operator);
    }

    return operators;
  }

  function chooseStartingNumber(config, firstOperator, resultLimit) {
    if (firstOperator === "divide") {
      const table = getMultiplicationTable(config);
      const divisor = table[randomNumber(0, table.length - 1)];
      const quotientMax = Math.max(1, Math.min(
        Math.floor(config.rangeMax / divisor),
        Math.floor(resultLimit / divisor)
      ));
      return divisor * randomNumber(1, quotientMax);
    }
    return randomNumber(1, config.rangeMax);
  }

  function chooseOperand(operator, current, config, resultLimit) {
    if (operator === "add") {
      const maximum = Math.min(config.rangeMax, resultLimit - current);
      return maximum >= 1 ? randomNumber(1, maximum) : null;
    }

    if (operator === "subtract") {
      const maximum = Math.min(config.rangeMax, current);
      return maximum >= 1 ? randomNumber(1, maximum) : null;
    }

    const table = getMultiplicationTable(config).filter((value) => value <= config.rangeMax);
    if (operator === "multiply") {
      const factors = table.filter((value) => current * value <= resultLimit);
      return factors.length ? factors[randomNumber(0, factors.length - 1)] : null;
    }

    if (operator === "divide") {
      const divisors = table.filter((value) => value !== 0 && current % value === 0);
      return divisors.length ? divisors[randomNumber(0, divisors.length - 1)] : null;
    }

    return null;
  }

  function getMultiplicationTable(config) {
    return GENERATION_RULES.multiplicationTables[config.groupName][config.difficulty];
  }

  function applyOperator(operator, left, right) {
    if (operator === "add") return left + right;
    if (operator === "subtract") return left - right;
    if (operator === "multiply") return left * right;
    if (operator === "divide") return left / right;
    return NaN;
  }

  function formatExpression(numbers, operators) {
    let expression = String(numbers[0]);
    operators.forEach((operator, index) => {
      const step = `${expression} ${OPERATOR_DETAILS[operator].symbol} ${numbers[index + 1]}`;
      expression = index === operators.length - 1 ? step : `(${step})`;
    });
    return expression;
  }

  function buildHint(built) {
    if (built.operators.length === 1) {
      return `Think about how to ${OPERATOR_DETAILS[built.operators[0]].word} ${built.numbers[1]}`;
    }
    return `Work from the inside out, one small step at a time`;
  }

  function createAnswerChoices(correctAnswer, resultLimit, rangeMax) {
    const choices = new Set([correctAnswer]);
    const offsets = shuffle([-10, -5, -3, -2, -1, 1, 2, 3, 5, 10]);
    const choiceLimit = Math.max(resultLimit, correctAnswer + rangeMax);
    offsets.forEach((offset) => {
      const candidate = correctAnswer + offset;
      if (choices.size < 4 && candidate >= 0 && candidate <= choiceLimit) choices.add(candidate);
    });

    let distance = 1;
    while (choices.size < 4) {
      if (correctAnswer + distance <= choiceLimit) choices.add(correctAnswer + distance);
      if (choices.size < 4 && correctAnswer - distance >= 0) choices.add(correctAnswer - distance);
      distance += 1;
    }
    return shuffle([...choices].slice(0, 4));
  }

  function refreshChoices(question) {
    const config = normalizeOptions(question);
    return {
      ...question,
      choices: createAnswerChoices(question.answer, getResultLimit(config), config.rangeMax)
    };
  }

  function getResultLimit(options) {
    const config = normalizeOptions(options);
    if (config.operationSet === "add-sub") return config.rangeMax;
    return GENERATION_RULES.resultLimits[config.groupName][config.difficulty];
  }

  function getDifficultyMultiplier(options) {
    const config = normalizeOptions(options);
    const operationBonus = { "add-sub": 0, "mul-div": 0.1, all: 0.2 }[config.operationSet];
    const difficultyBonus = { easy: 0, medium: 0.15, hard: 0.3 }[config.difficulty];
    const rangeIndex = Math.max(0, GROUPS[config.groupName].ranges.indexOf(config.rangeMax));
    return Math.min(1.6, Number((1 + operationBonus + difficultyBonus + rangeIndex * 0.1).toFixed(2)));
  }

  function validateQuestion(question) {
    const config = normalizeOptions(question);
    const allowedOperators = OPERATION_SETS[config.operationSet].operators;
    const expectedOperands = DIFFICULTIES[config.difficulty].operandCount;
    const resultLimit = getResultLimit(config);
    const errors = [];

    if (!Array.isArray(question.numbers) || question.numbers.length !== expectedOperands) {
      errors.push("wrong operand count");
    }
    const isTwoDigitFact = isTwoDigitFactStrategy(question.strategy)
      && config.operationSet === "mul-div"
      && config.difficulty === "easy";
    const operandsAreValid = isTwoDigitFact
      ? Number.isInteger(question.numbers[0])
        && question.numbers[0] >= 10
        && question.numbers[0] <= 99
        && Number.isInteger(question.numbers[1])
        && question.numbers[1] >= 1
        && question.numbers[1] <= 9
      : question.numbers.every((number) => Number.isInteger(number) && number >= 1 && number <= config.rangeMax);
    if (!operandsAreValid) errors.push("operand outside selected range");
    if (!question.operators.every((operator) => allowedOperators.includes(operator))) {
      errors.push("operator outside selected set");
    }
    if (question.operators.length !== expectedOperands - 1) errors.push("wrong operator count");
    if (!question.intermediateResults.every((value) => Number.isInteger(value) && value >= 0 && value <= resultLimit)) {
      errors.push("unsafe intermediate result");
    }
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > resultLimit) {
      errors.push("unsafe final answer");
    }
    if (!Array.isArray(question.choices) || new Set(question.choices).size !== 4 || !question.choices.includes(question.answer)) {
      errors.push("invalid answer choices");
    }

    let current = question.numbers[0];
    question.operators.forEach((operator, index) => {
      const next = question.numbers[index + 1];
      if (operator === "divide" && current % next !== 0) errors.push("non-exact division");
      current = applyOperator(operator, current, next);
    });
    if (current !== question.answer) errors.push("incorrect calculated answer");

    return { valid: errors.length === 0, errors };
  }

  function createFallbackQuestion(config, questionIndex, strategy) {
    const operandCount = DIFFICULTIES[config.difficulty].operandCount;
    const safeOperator = OPERATION_SETS[config.operationSet].operators.includes("add") ? "add" : "multiply";
    const numbers = Array.from({ length: operandCount }, () => 1);
    const operators = Array.from({ length: operandCount - 1 }, () => safeOperator);
    const intermediateResults = [];
    let answer = numbers[0];
    operators.forEach((operator, index) => {
      answer = applyOperator(operator, answer, numbers[index + 1]);
      intermediateResults.push(answer);
    });
    const expression = formatExpression(numbers, operators);
    return {
      group: GROUPS[config.groupName].name,
      ...config,
      strategy,
      numbers,
      operators,
      intermediateResults,
      answer,
      expression,
      text: `${expression} = ?`,
      hint: "Take one small step at a time",
      signature: `fallback:${questionIndex}:${operators.join("-")}:${numbers.join("-")}`,
      choices: createAnswerChoices(answer, getResultLimit(config), config.rangeMax)
    };
  }

  function getGroup(groupName) {
    return GROUPS[groupName] || GROUPS.cxy;
  }

  function getDifficulty(difficulty) {
    return DIFFICULTIES[difficulty] || DIFFICULTIES.easy;
  }

  function getOperationSet(operationSet) {
    return OPERATION_SETS[operationSet] || OPERATION_SETS["add-sub"];
  }

  RocketMath.questions = {
    GROUPS,
    DIFFICULTIES,
    OPERATION_SETS,
    GENERATION_RULES,
    CXY_STRATEGY_PLAN,
    EASY_MUL_DIV_PLAN,
    normalizeOptions,
    createQuestion,
    createQuestionSet,
    refreshChoices,
    validateQuestion,
    getResultLimit,
    getDifficultyMultiplier,
    getGroup,
    getDifficulty,
    getOperationSet
  };

  window.RocketMath = RocketMath;
})();
