# Math Rocket (JJCC)

Math Rocket (JJCC) is a cheerful browser game designed to help a seven-year-old build confidence and speed with mental arithmetic. Its main focus is making ten and breaking ten in addition and subtraction. A parent can join as Challenger to turn practice into a short, friendly competition.

The browser app uses HTML, CSS, and vanilla JavaScript. GitHub Pages hosts the static game, while a free Cloudflare Worker and D1 database provide one central progress service for Edge, Chrome, Android, iPhone, and iPad. Browser `localStorage` remains an offline fallback.

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
- Shared Cloudflare D1 progress with automatic on-device fallback
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

The timestamped record-file design has been removed. Each browser receives one stable, locally stored device ID. The Cloudflare Worker keeps one current snapshot per device in D1 and merges all unique practice, competition, and review IDs before responding. Separate device rows prevent concurrent Edge, Chrome, Android, and iPad saves from overwriting one another, while de-duplication prevents a repeated upload from awarding stars twice.

The browser mirrors this data in `localStorage` so a temporary connection problem does not stop a mission. When the service is reachable again, the local snapshot is uploaded and the combined result is returned. Connected clients refresh shared progress every six seconds and whenever the app regains focus.

For local development only, `node server.js` stores the merged result in a single ignored file at `data/progress.json`; it no longer creates a `data/records` directory.

## Free Cloudflare Deployment

The Worker source is `cloudflare/worker.mjs`, and the D1 schema is `cloudflare/migrations/0001_initial.sql`. A Cloudflare account is required once to create and deploy these resources:

```bash
cd cloudflare
npx wrangler login
npx wrangler d1 create math-rocket-jjcc
```

Copy `wrangler.toml.example` to `wrangler.toml`, replace `REPLACE_WITH_D1_DATABASE_ID` with the ID printed by the previous command, then run:

```bash
npx wrangler d1 migrations apply math-rocket-jjcc --remote
npx wrangler deploy
```

Finally, put the deployed endpoint in `js/runtime-config.js`. The current production endpoint is:

```js
window.MATH_ROCKET_API_URL = "https://math-rocket-jjcc-sync.jensenhchen.workers.dev/api/progress";
```

Commit and push that one configuration change so the GitHub Pages version uses D1. Do not place Cloudflare login tokens in the repository. `ALLOWED_ORIGIN` limits browser access to `https://jensenhchen.github.io`; local `localhost` and `127.0.0.1` origins are also accepted for testing.

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
node --check cloudflare/worker.mjs
node tests/core.test.js
node tests/server.test.js
node tests/cloudflare-worker.test.mjs
```

## Deployment and Offline Use

GitHub Pages cannot write files itself, so it sends progress to the deployed Cloudflare Worker and D1 database configured in `js/runtime-config.js`. Load the game once while online to cache the app shell. On iPad or iPhone, use Safari’s **Add to Home Screen** action to install Math Rocket (JJCC).
