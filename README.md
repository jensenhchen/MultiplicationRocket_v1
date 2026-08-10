# Math Rocket (JJCC)

Math Rocket (JJCC) is a cheerful browser game designed to help a seven-year-old build confidence and speed with mental arithmetic. Its main focus is making ten and breaking ten in addition and subtraction. A parent can join as Challenger to turn practice into a short, friendly competition.

The browser app uses HTML, CSS, and vanilla JavaScript. A small dependency-free Node.js server serves the app and stores shared CXY and Challenger progress in `data/progress.json`. Browser `localStorage` remains an offline fallback.

## Features

- Two practice groups: Group 1 `CXY` and Group 2 `Challenger`
- Practice and Competition settings on the same scrollable page
- Operations, Difficulty, and Number range stay in one compact row and expand while choosing
- Independent competition settings for both pilots
- Addition/subtraction, multiplication/division, and mixed-operation missions
- Ten questions per mission, followed by a compact result screen and missed-question retry
- Child-first addition/subtraction generation with at least 60% make-ten or break-ten questions for CXY
- Age-appropriate number, result, multiplication, and division limits
- Seven-day question-volume bars, correct/total curves, daily star summaries, and a 210-question goal (30 per day) for each group
- Shared server-file progress with automatic on-device fallback
- Large animated star and trophy celebrations
- Supportive feedback after competition mistakes and congratulations for progress and wins
- Music, sound effects, rocket animation, confetti, and encouraging English messages
- Responsive layouts for Windows PCs, iPad, iPhone, and Android phones
- Installable PWA with offline app-shell caching

## Mission Defaults

| Group | Default | Number ranges |
| --- | --- | --- |
| CXY | Addition & Subtraction · Easy · 1–10 | 1–10, 1–15, 1–20 |
| Challenger | Addition & Subtraction · Medium · 1–25 | 1–15, 1–25, 1–30 |

Easy uses 2 numbers, Medium uses 3, and Hard uses 4. CXY is intentionally gentler; Challenger provides a suitable parent target without making the child’s mission discouraging.

## Child-Friendly Generation

- CXY Easy addition/subtraction stays within the chosen number range.
- Every intermediate subtraction result is non-negative.
- Make-ten problems encourage completing the next ten, such as `7 + 3`.
- Break-ten problems encourage subtracting to ten first, such as `13 − 5`.
- Multiplication uses controlled fact tables; CXY Easy starts with 2, 5, and 10.
- Division is exact, uses no zero divisor, and avoids oversized dividends.
- Every question has four distinct choices and one correct answer.
- Expressions are evaluated safely without `eval()`.

## Star Scoring

- Practice: a perfect 10/10 earns a 5-star basis.
- Practice options: each step above the first Operations, Difficulty, or Number range option adds +1 star to a perfect mission.
- Competition completion: +10 stars.
- Competition correctness: +3 for 10/10, +2 for 9/10, +1 for 8/10, and +0 for 7/10 or below.
- Competition options: each step above the first option in Operations, Difficulty, or Number range adds +1 star.
- Competition speed: the pilot with the shorter total time earns +2 stars.
- Review: correcting each missed question earns +1 star.
- Daily volume: after 30 questions in one day, each additional block of up to 10 questions earns +1 extra star.

An only-perfect pilot wins immediately. Otherwise, total competition stars decide the winner, followed by correct-answer count and total time when needed.

## Progress Data

The Node server writes versioned progress to `data/progress.json`. The file is created automatically on the first run and contains CXY and Challenger settings, practice and competition history, retries, accuracy, question totals, and timing. The file is excluded from Git so deployment updates do not overwrite a child’s progress.

The browser mirrors this data in `localStorage` so a temporary connection problem does not stop a mission. When the server is reachable again, new results are written to the server file.

## Run and Debug in VS Code

In the VS Code terminal, run:

```bash
node server.js 8765
```

Then open `http://127.0.0.1:8765/`. The server progress file appears at `data/progress.json` after the first saved setting or completed mission.

The server listens on all network interfaces by default, so another device on the same Wi-Fi can use `http://YOUR-PC-IP:8765/` while the server is running and the Windows firewall permits the connection.

## Verification

No dependency installation is required:

```bash
node --check js/app.js
node tests/core.test.js
node tests/server.test.js
```

## Deployment and Offline Use

Server-file persistence requires a Node.js host with a writable, persistent disk. The server serializes writes and merges session IDs so simultaneous PC, Android and iPad games do not overwrite one another. Connected clients refresh shared progress every six seconds and whenever the app regains focus. GitHub Pages can display the app but cannot write `data/progress.json`; use a Node-capable host for shared progress. Load the deployed game once while online to cache the app shell. On iPad or iPhone, use Safari’s **Add to Home Screen** action to install Math Rocket (JJCC).
