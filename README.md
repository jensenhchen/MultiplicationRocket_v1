# Math Rocket: + - * /

Math Rocket is a cheerful, offline-friendly browser game for children practising addition, subtraction, multiplication, and division. A child configures a 10-question mission, earns stars, compares the result with the last matching mission, retries missed questions, and can play a two-person CXY vs Challenger competition.

The project is a static Progressive Web App. It uses HTML5, CSS3, and vanilla JavaScript only: no backend, login, database, npm, build tool, CDN, external API, or analytics. Progress never leaves the browser and is saved only in `localStorage`.

## Features

- Group 1 `CXY` and Group 2 `Challenger`
- Three operation sets: addition/subtraction, multiplication/division, or all four operations
- Easy (2 numbers), Medium (3 numbers), and Hard (4 numbers)
- CXY ranges: 1–10, 1–15, and 1–20
- Challenger ranges: 1–15, 1–25, and 1–30
- Ten unique, balanced multiple-choice questions per main mission
- Exact division, non-negative subtraction, integer results, and age-appropriate result limits
- Per-configuration comparison with the previous matching mission
- Retry queue for missed questions, repeated until correct
- Base, retry, winner, and draw star rewards
- CXY-first, Challenger-second competition with accuracy and time comparison
- Responsive rocket scene, encouragement, music, sound effects, and celebration animation
- Installable PWA and offline app shell
- Keyboard answer shortcuts 1–4, touch-friendly controls, safe areas, and reduced-motion support

## Mission Settings

| Group | Default | Number ranges |
| --- | --- | --- |
| CXY | Addition & Subtraction · Medium · 1–10 | 1–10, 1–15, 1–20 |
| Challenger | Addition & Subtraction · Medium · 1–15 | 1–15, 1–25, 1–30 |

Difficulty controls the number of operands: Easy has 2, Medium has 3, and Hard has 4. Multi-step expressions use explicit parentheses and are evaluated safely without `eval()`.

## Child-Friendly Generation Rules

- Every displayed operand stays inside the selected range.
- Subtraction and every intermediate step stay non-negative.
- Division is exact and never divides by zero.
- Result limits are centralized in `js/questions.js`:
  - CXY: 40 (Easy), 80 (Medium), 120 (Hard)
  - Challenger: 100 (Easy), 180 (Medium), 300 (Hard)
- Multiplication factor limits prevent chains of very large products.
- Selected operators are rotated across each 10-question set for balanced coverage.
- Four distinct choices are generated for every question, including exactly one correct answer.

## Stars

- Correct on the first attempt: 10 stars
- Correct during missed-question retry: 5 stars, once per original missed question
- Competition winner: 20 bonus stars
- Exact draw: 10 bonus stars per group

Competition winners are determined only by the original 10 questions. Higher accuracy wins; equal accuracy is decided by shorter time; matching accuracy and time is a draw.

## Local Data

`js/storage.js` stores versioned progress under `mathRocket.progress.v2`. It includes total and per-group stars, recent practice and competition history, last results by exact mission configuration, missed questions, retry completion, group statistics, and dates. The loader can migrate the previous progress key and maps the previous second-group statistics to Challenger.

Audio settings are stored separately. Storage failures are caught so the game remains playable in private browsing or when storage is unavailable.

## Run Locally

Opening `index.html` is enough for a basic view. PWA and offline behavior require `localhost` or HTTPS:

```bash
node tests/static-server.js 8765
```

Then open `http://127.0.0.1:8765/`.

## Verification

Run syntax and generator/storage rules without installing dependencies:

```bash
node --check js/app.js
node tests/core.test.js
```

`tests/core.test.js` exercises every group, operation set, difficulty, and range, then checks storage comparison, one-time retry rewards, and competition tie-breaking.

See `docs/TEST_PLAN.md` for responsive, browser, localStorage, competition, and offline checks.

## GitHub Pages and Offline Use

All paths are relative, so the repository can be deployed from a GitHub Pages subdirectory. Load the published game once while online to cache the app shell. On iPad, use Safari’s **Add to Home Screen** action to install Math Rocket.
