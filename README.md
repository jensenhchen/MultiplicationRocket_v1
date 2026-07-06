# Multiplication Rocket

Multiplication Rocket is a cheerful browser game for children learning multiplication. The child picks a group and mission level, answers 10 questions, earns stars, gets hints, reviews mistakes, and watches a rocket launch higher with each correct answer.

The project is static and GitHub Pages friendly. It uses only HTML5, CSS3, and vanilla JavaScript. There is no backend, login, database, npm, build tool, CDN, or paid API.

## Features

- Group 1 `CXY` with Easy, Medium, and Hard levels for 1x1 to 9x9 practice
- Group 2 `CXR` with Easy, Medium, and Hard levels for 11x11 to 20x20 practice
- CXY vs CXR competition mode with side-by-side result comparison
- Score, timer, hints, encouraging messages, and wrong-answer review
- Responsive layout for iPhone, iPad, Android phones/tablets, Windows, and macOS browsers
- Vivid SVG rocket with idle, correct-answer, wrong-answer, and completion animations
- Flame, smoke, sparkles, clouds, moon, and celebration effects
- Sound effects for button taps, correct answers, wrong answers, rocket boost, completion, and perfect score
- Optional soft background music generated with the Web Audio API
- Sound and music toggles saved in `localStorage`
- Progress saved in `localStorage`: best score, total stars, wrong questions, weak tables, group stats, competition history, and last played date
- Installable Progressive Web App on iPad and supported desktop/mobile browsers
- Offline support after the first successful load
- Relative paths for GitHub Pages subfolder deployment
- `prefers-reduced-motion` support

## Browser Compatibility

Test targets:

- iPad Safari
- iPhone Safari
- Android Chrome
- Windows Chrome and Edge
- macOS Safari and Chrome

The layout uses responsive CSS, Flexbox, CSS Grid, `clamp()`, safe-area `env()` values, and touch-friendly controls with minimum 60px gameplay buttons.

## Folder Structure

```text
/
|-- index.html
|-- manifest.json
|-- service-worker.js
|-- offline.html
|-- 404.html
|-- README.md
|-- LICENSE
|-- robots.txt
|-- .nojekyll
|-- css/
|   |-- style.css
|   |-- responsive.css
|   `-- animations.css
|-- js/
|   |-- app.js
|   |-- game.js
|   |-- ui.js
|   |-- questions.js
|   |-- storage.js
|   |-- audio.js
|   |-- animation.js
|   `-- utils.js
|-- assets/
|   |-- icons/
|   |-- images/
|   `-- sounds/
`-- docs/
```

## Sound Controls

The game uses small Web Audio API tones instead of external audio files. This keeps the project offline-friendly and avoids licensing issues.

- `Sound On/Off` controls effects.
- `Music On/Off` controls soft looping background music.
- Audio starts only after a user interaction, which respects iOS and Android autoplay rules.
- Preferences are saved automatically in `localStorage`.

## Groups And Competition

Practice groups:

- `CXY`: original multiplication practice.
  - Easy: 1 to 5
  - Medium: 1 to 7
  - Hard: 1 to 9
- `CXR`: larger multiplication practice.
  - Easy: 11 to 13
  - Medium: 11 to 16
  - Hard: 11 to 20

Competition mode:

1. Choose `Compete Easy`, `Compete Medium`, or `Compete Hard`.
2. CXY plays first.
3. CXR plays second with the matching difficulty.
4. The game compares correct answers, correction rate, and time.
5. Higher accuracy wins. If accuracy is tied, the faster time wins.

## Run Locally

Open `index.html` in a browser for a quick check. Service workers require `https://` or `localhost`, so offline/PWA behavior should be tested with a local static server or on GitHub Pages.

Optional local server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Upload To GitHub

1. Create a new repository named `MultiplicationRocket`.
2. Upload all project files and folders from this directory.
3. Commit the files to the default branch, usually `main`.

## Enable GitHub Pages

1. Open the repository on GitHub.
2. Go to `Settings` > `Pages`.
3. Under `Build and deployment`, choose `Deploy from a branch`.
4. Select branch `main` and folder `/root`.
5. Save.

After GitHub finishes publishing, the app should work at:

```text
https://username.github.io/MultiplicationRocket/
```

## Open On iPad

1. Open Safari on the iPad.
2. Visit the GitHub Pages URL.
3. Play one mission while online so Safari can cache the app.

## Add To Home Screen On iPad

1. Open the game in Safari.
2. Tap the Share button.
3. Tap `Add to Home Screen`.
4. Confirm the name `Rocket Math`.
5. Launch it from the Home Screen icon.

## Test Offline Mode

1. Open the GitHub Pages URL while online.
2. Wait for the first page load to finish.
3. Play or start a mission.
4. Turn on Airplane Mode.
5. Reopen the Home Screen app or refresh the page. The game should still load from cache.

## Troubleshooting

- If offline mode does not work, reload once while online and wait a few seconds.
- If the Home Screen icon does not appear, confirm Safari is using the GitHub Pages `https://` URL.
- If sound does not play, tap anywhere in the game first; mobile browsers require user interaction before audio.
- If old files appear after an update, close the tab or Home Screen app and reopen it. The service worker deletes old named caches during activation.
- If progress is missing, check whether Safari private browsing or storage restrictions are enabled.
