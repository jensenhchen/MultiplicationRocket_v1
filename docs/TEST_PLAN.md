# Test Plan

## Automated Checks

- Run `node --check` on every file in `js/` and `tests/`.
- Run `node tests/core.test.js`.
- Confirm the core test covers both groups, all operation sets, all difficulties, and all number ranges.
- Confirm generated operands stay in range, divisions are exact, intermediate values are safe integers, choices are unique, and each set has ten unique signatures.
- Confirm previous-result lookup occurs before a new result replaces it.
- Confirm a retry ID earns stars only once.
- Confirm accuracy and speed competition rules, including a draw.

## Start Screen

- Confirm the title is `Math JJCC Rocket` and the English subtitle is correct.
- Confirm Group 1 is CXY and Group 2 is Challenger.
- Confirm each group has Operations, Difficulty, Number Range, and Start controls.
- Confirm CXY defaults to Addition & Subtraction, Medium, 1–10.
- Confirm Challenger defaults to Addition & Subtraction, Medium, 1–15.
- Change each select and confirm the competition summaries update.
- Confirm no old second-group name is visible.

## Practice

- Complete a 10-question mission for each operation set.
- Confirm question progress, mission settings, stars, time, feedback, hint, and rocket state update.
- Confirm keyboard keys 1–4 choose the corresponding answer position.
- Confirm result accuracy and time match the completed mission.
- Repeat an identical mission and confirm the comparison uses the prior result.
- Change one setting and confirm it reports the first result for that distinct mission.

## Retry

- Finish a mission with at least one wrong answer.
- Confirm each wrong expression shows the chosen and correct answers.
- Start retry and answer one item incorrectly; confirm it returns later.
- Correct all missed questions and confirm 5 stars are added once per item.
- Confirm reopening the same result cannot award the same retry ID again.
- Finish a perfect mission and confirm the perfect message, sound, and celebration appear without a retry button.

## Competition

- Start a competition and confirm CXY plays first for 10 questions.
- Confirm the transition screen does not reveal a final winner.
- Start Challenger and complete 10 questions.
- Confirm both score cards show settings, correct count, accuracy, time, stars, and previous matching result comparison.
- Confirm accuracy wins before speed, speed breaks an accuracy tie, and exact ties display Draw.
- Confirm winner/draw bonuses are applied once.
- Retry missed questions for each group and confirm the winner stays unchanged.

## localStorage

- Reload and confirm total stars, group stars, stats, histories, audio settings, and retry completion remain.
- Insert valid data under the previous progress key, reload, and confirm it migrates without crashing.
- Insert malformed JSON and confirm the game still loads with defaults.
- Reset progress and confirm only Math JJCC Rocket progress keys are removed; audio preferences remain.

## Responsive and Accessibility

- Check 320, 375, 390, 430, 768, 1024, and desktop widths with no horizontal scrolling.
- Test iPad portrait and landscape plus a short-height landscape viewport.
- Confirm controls are comfortably touchable and focus indicators are visible.
- Navigate selects, buttons, answer choices, hints, retry, and competition by keyboard.
- Confirm live result/feedback regions announce changes without duplicating text.
- Enable reduced motion and confirm transitions become minimal without hiding state changes.

## Audio, PWA, and Offline

- Confirm sound and music start only after interaction and toggles persist.
- Serve through localhost or HTTPS and confirm service worker registration has no unhandled errors.
- Load once online, go offline, and confirm the app shell, styles, scripts, icons, and game remain available.
- Confirm manifest name, short name, start URL, icons, and standalone display.
- Confirm a new service worker cache version replaces older app caches.
