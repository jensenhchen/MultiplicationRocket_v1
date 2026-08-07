(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};
  const { randomNumber, shuffle } = RocketMath.utils;

  const GROUPS = {
    cxy: {
      name: "CXY",
      ranges: [10, 15, 20],
      defaultRange: 10
    },
    challenger: {
      name: "Challenger",
      ranges: [15, 25, 30],
      defaultRange: 15
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

  const GENERATION_RULES = {
    attemptsPerQuestion: 260,
    attemptsPerSetItem: 80,
    resultLimits: {
      cxy: { easy: 40, medium: 80, hard: 120 },
      challenger: { easy: 100, medium: 180, hard: 300 }
    },
    factorLimits: {
      cxy: { easy: 10, medium: 10, hard: 8 },
      challenger: { easy: 12, medium: 12, hard: 10 }
    }
  };

  function normalizeOptions(options) {
    const requested = options || {};
    const groupName = GROUPS[requested.groupName] ? requested.groupName : "cxy";
    const difficulty = DIFFICULTIES[requested.difficulty] ? requested.difficulty : "medium";
    const operationSet = OPERATION_SETS[requested.operationSet] ? requested.operationSet : "add-sub";
    const numericRange = Number(requested.rangeMax);
    const rangeMax = GROUPS[groupName].ranges.includes(numericRange)
      ? numericRange
      : GROUPS[groupName].defaultRange;

    return { groupName, difficulty, operationSet, rangeMax };
  }

  function createQuestionSet(options, count) {
    const config = normalizeOptions(options);
    const total = Number.isInteger(count) && count > 0 ? count : 10;
    const questions = [];
    const signatures = new Set();

    for (let index = 0; index < total; index += 1) {
      let question = null;

      for (let attempt = 0; attempt < GENERATION_RULES.attemptsPerSetItem; attempt += 1) {
        const candidate = createQuestion(config, index + attempt * total);
        if (!signatures.has(candidate.signature)) {
          question = candidate;
          break;
        }
      }

      if (!question) question = createQuestion(config, index);
      signatures.add(question.signature);
      questions.push(question);
    }

    return questions;
  }

  function createQuestion(options, questionIndex) {
    const config = normalizeOptions(options);
    const difficulty = DIFFICULTIES[config.difficulty];
    const operatorCount = difficulty.operandCount - 1;
    const operators = buildOperatorPlan(config.operationSet, operatorCount, Number(questionIndex) || 0);
    const resultLimit = GENERATION_RULES.resultLimits[config.groupName][config.difficulty];

    for (let attempt = 0; attempt < GENERATION_RULES.attemptsPerQuestion; attempt += 1) {
      const built = buildSafeExpression(config, operators, resultLimit);
      if (!built) continue;

      const expression = formatExpression(built.numbers, operators);
      const question = {
        group: GROUPS[config.groupName].name,
        groupName: config.groupName,
        operationSet: config.operationSet,
        difficulty: config.difficulty,
        rangeMax: config.rangeMax,
        numbers: built.numbers,
        operators: [...operators],
        intermediateResults: built.intermediateResults,
        answer: built.answer,
        expression,
        text: `${expression} = ?`,
        hint: buildHint(built.numbers, operators),
        signature: `${operators.join("-")}:${built.numbers.join("-")}`,
        choices: createAnswerChoices(built.answer, resultLimit, config.rangeMax)
      };

      if (validateQuestion(question).valid) return question;
    }

    return createFallbackQuestion(config, Number(questionIndex) || 0);
  }

  function buildOperatorPlan(operationSet, count, questionIndex) {
    const allowed = OPERATION_SETS[operationSet].operators;
    const offset = Math.abs(questionIndex) % allowed.length;
    const operators = [];

    for (let index = 0; index < count; index += 1) {
      operators.push(allowed[(offset + index) % allowed.length]);
    }

    return operators;
  }

  function buildSafeExpression(config, operators, resultLimit) {
    const numbers = [randomNumber(1, config.rangeMax)];
    const intermediateResults = [];
    let current = numbers[0];

    for (const operator of operators) {
      const next = chooseOperand(operator, current, config, resultLimit);
      if (next == null) return null;

      const calculated = applyOperator(operator, current, next);
      if (!Number.isInteger(calculated) || calculated < 0 || calculated > resultLimit) return null;

      numbers.push(next);
      current = calculated;
      intermediateResults.push(current);
    }

    return { numbers, intermediateResults, answer: current };
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

    if (operator === "multiply") {
      const safeCurrent = Math.max(1, current);
      const maximum = Math.min(
        config.rangeMax,
        GENERATION_RULES.factorLimits[config.groupName][config.difficulty],
        Math.floor(resultLimit / safeCurrent)
      );

      if (maximum < 1) return null;
      return maximum >= 2 ? randomNumber(2, maximum) : 1;
    }

    if (operator === "divide") {
      const divisors = [];
      for (let candidate = 2; candidate <= config.rangeMax; candidate += 1) {
        if (current % candidate === 0) divisors.push(candidate);
      }

      if (divisors.length > 0) return divisors[randomNumber(0, divisors.length - 1)];
      return current === 0 || current === 1 ? 1 : null;
    }

    return null;
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

  function buildHint(numbers, operators) {
    if (operators.length === 1) {
      return `Think about how to ${OPERATOR_DETAILS[operators[0]].word} ${numbers[1]} with ${numbers[0]}`;
    }

    const instructions = operators.map((operator, index) => {
      if (index === 0) {
        return `first work out ${numbers[0]} ${OPERATOR_DETAILS[operator].symbol} ${numbers[1]}`;
      }
      return `then ${OPERATOR_DETAILS[operator].word} ${numbers[index + 1]}`;
    });

    return `Follow the parentheses from the inside out: ${instructions.join(", ")}`;
  }

  function createAnswerChoices(correctAnswer, resultLimit, rangeMax) {
    const choices = new Set([correctAnswer]);
    const offsets = shuffle([-20, -10, -5, -3, -2, -1, 1, 2, 3, 5, 10, 20]);
    const choiceLimit = Math.max(resultLimit, correctAnswer + rangeMax + 5);

    offsets.forEach((offset) => {
      const candidate = correctAnswer + offset;
      if (choices.size < 4 && candidate >= 0 && candidate <= choiceLimit) choices.add(candidate);
    });

    let distance = 1;
    while (choices.size < 4) {
      const candidate = correctAnswer + distance;
      if (candidate <= choiceLimit) choices.add(candidate);
      if (choices.size < 4 && correctAnswer - distance >= 0) choices.add(correctAnswer - distance);
      distance += 1;
    }

    return shuffle([...choices].slice(0, 4));
  }

  function refreshChoices(question) {
    const config = normalizeOptions(question);
    const resultLimit = GENERATION_RULES.resultLimits[config.groupName][config.difficulty];
    return { ...question, choices: createAnswerChoices(question.answer, resultLimit, config.rangeMax) };
  }

  function validateQuestion(question) {
    const config = normalizeOptions(question);
    const allowedOperators = OPERATION_SETS[config.operationSet].operators;
    const expectedOperands = DIFFICULTIES[config.difficulty].operandCount;
    const resultLimit = GENERATION_RULES.resultLimits[config.groupName][config.difficulty];
    const errors = [];

    if (!Array.isArray(question.numbers) || question.numbers.length !== expectedOperands) {
      errors.push("wrong operand count");
    }

    if (!question.numbers.every((number) => Number.isInteger(number) && number >= 1 && number <= config.rangeMax)) {
      errors.push("operand outside selected range");
    }

    if (!question.operators.every((operator) => allowedOperators.includes(operator))) {
      errors.push("operator outside selected set");
    }

    if (question.operators.length !== expectedOperands - 1) {
      errors.push("wrong operator count");
    }

    if (!question.intermediateResults.every((value) => Number.isInteger(value) && value >= 0 && value <= resultLimit)) {
      errors.push("unsafe intermediate result");
    }

    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > resultLimit) {
      errors.push("unsafe final answer");
    }

    if (!Array.isArray(question.choices) || new Set(question.choices).size !== 4 || !question.choices.includes(question.answer)) {
      errors.push("invalid answer choices");
    }

    return { valid: errors.length === 0, errors };
  }

  function createFallbackQuestion(config, questionIndex) {
    const allowed = OPERATION_SETS[config.operationSet].operators;
    const safeOperator = allowed.includes("add") ? "add" : (allowed.includes("multiply") ? "multiply" : allowed[0]);
    const base = safeOperator === "multiply" || safeOperator === "divide" ? 1 : 3;
    const numbers = Array.from({ length: DIFFICULTIES[config.difficulty].operandCount }, () => base);
    const operators = Array.from({ length: numbers.length - 1 }, () => safeOperator);
    const built = buildSafeExpression(config, operators, GENERATION_RULES.resultLimits[config.groupName][config.difficulty]);

    if (!built) {
      numbers.fill(1);
      const answer = safeOperator === "add" ? numbers.length : 1;
      const expression = formatExpression(numbers, operators);
      return {
        group: GROUPS[config.groupName].name,
        ...config,
        numbers,
        operators,
        intermediateResults: numbers.slice(1).map((_, index) => index + 2),
        answer,
        expression,
        text: `${expression} = ?`,
        hint: "Add one number at a time",
        signature: `fallback:${questionIndex}:${numbers.length}`,
        choices: createAnswerChoices(answer, 20, config.rangeMax)
      };
    }

    const expression = formatExpression(built.numbers, operators);
    return {
      group: GROUPS[config.groupName].name,
      ...config,
      ...built,
      operators,
      expression,
      text: `${expression} = ?`,
      hint: buildHint(built.numbers, operators),
      signature: `fallback:${questionIndex}:${operators.join("-")}:${built.numbers.join("-")}`,
      choices: createAnswerChoices(built.answer, GENERATION_RULES.resultLimits[config.groupName][config.difficulty], config.rangeMax)
    };
  }

  function getGroup(groupName) {
    return GROUPS[groupName] || GROUPS.cxy;
  }

  function getDifficulty(difficulty) {
    return DIFFICULTIES[difficulty] || DIFFICULTIES.medium;
  }

  function getOperationSet(operationSet) {
    return OPERATION_SETS[operationSet] || OPERATION_SETS["add-sub"];
  }

  RocketMath.questions = {
    GROUPS,
    DIFFICULTIES,
    OPERATION_SETS,
    GENERATION_RULES,
    normalizeOptions,
    createQuestion,
    createQuestionSet,
    refreshChoices,
    validateQuestion,
    getGroup,
    getDifficulty,
    getOperationSet
  };

  window.RocketMath = RocketMath;
})();
