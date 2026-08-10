# Product Requirements Document

## Product

Math JJCC Rocket is an offline-friendly browser game that helps children around age 7–8 build fluency in addition, subtraction, multiplication, and division.

## Goals

- Make short arithmetic practice friendly, rewarding, and repeatable.
- Build mental calculation speed without using negative, fractional, or confusing intermediate results.
- Encourage improvement through stars, supportive comparisons, retry missions, sound, and animation.
- Support two named players/groups in both practice and competition.
- Work on phones, tablets, desktop browsers, and as an installed PWA.
- Keep all personal progress inside the current browser.

## Practice Configuration

Both CXY and Challenger choose an operation set and an operand-count difficulty.

- Operations: Addition & Subtraction; Multiplication & Division; All Four Operations
- Difficulty: Easy (2 numbers); Medium (3 numbers); Hard (4 numbers)
- CXY ranges: 1–10, 1–15, 1–20
- Challenger ranges: 1–15, 1–25, 1–30

CXY defaults to Addition & Subtraction, Medium, 1–10. Challenger defaults to Addition & Subtraction, Medium, 1–15.

## Core Gameplay

- A main mission contains exactly 10 questions with four answer choices.
- Correct first answers earn 10 stars.
- Incorrect answers receive kind feedback and are stored for review.
- A hint explains calculation order without simply stating the answer.
- The rocket rises as correct answers accumulate.
- Results show correct count, accuracy, time, session stars, total stars, and comparison with the previous identical mission configuration.

## Question Safety and Difficulty

- Displayed operands stay in the selected range.
- Expressions are evaluated with a structured left-associated model and explicit parentheses, never `eval()`.
- All intermediate and final values are non-negative integers.
- Division is exact and has a non-zero divisor.
- CXY result limits are 40, 80, and 120 for Easy, Medium, and Hard.
- Challenger result limits are 100, 180, and 300.
- Factor limits constrain long multiplication chains.
- Operators are rotated across a set for balanced coverage, and exact duplicate questions are rejected.

## Missed-Question Retry

- Results list the expression, chosen answer, and correct answer.
- The retry mission contains only unresolved questions from that result.
- A question answered incorrectly in retry is placed at the end of the queue.
- Correcting an original missed question earns 5 stars once only.
- Completing the queue triggers a celebration and supportive message.

## Competition

- Competition uses the two Practice configurations visible on the start screen.
- CXY completes 10 questions first, followed by Challenger.
- Higher accuracy wins; equal accuracy uses shorter time; equal accuracy and time is a draw.
- The winner receives 20 bonus stars; a draw gives each group 10 bonus stars.
- Retry stars do not change the winner.
- Each group’s missed questions can be retried after the final comparison.

## Persistence and Privacy

Use localStorage only for audio preferences, total and per-group stars, histories, last matching results, wrong questions, retry completion, game count, and dates. Handle unavailable or corrupt storage without blocking play. Migrate the previous local schema when possible. Do not transmit data or introduce a backend, login, analytics, database, or external API.

## Technical Constraints

- HTML5, CSS3, and vanilla JavaScript only
- Existing IIFE and `window.RocketMath` module pattern
- No framework, npm, build tool, CDN, or paid service
- Relative asset paths for GitHub Pages
- Valid manifest and service worker app shell
- iOS/Android audio unlocked only after interaction
- Touch, keyboard, safe-area, landscape, and reduced-motion support
