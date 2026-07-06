# Product Requirements Document

## Product

Multiplication Rocket is a static browser game that helps a child practice multiplication facts from 1x1 to 20x20 across two named groups.

## Goals

- Make multiplication practice friendly, fast, and encouraging.
- Work on iPad Safari and as an iPad Home Screen app.
- Work offline after the first successful online load.
- Deploy cleanly to GitHub Pages with relative paths.

## Audience

- Primary: children around age 7 learning multiplication.
- Secondary: parents, guardians, and teachers who want a no-login practice tool.

## Core Gameplay

- Child chooses CXY or CXR, then Easy, Medium, or Hard.
- Child can choose CXY vs CXR competition mode.
- Game asks 10 multiplication questions.
- Child picks one of four answers.
- Correct answers earn 10 stars.
- Incorrect answers show the right answer and appear in review.
- Hints explain multiplication as repeated addition or a 10-group shortcut for larger tables.
- Rocket moves upward as the score increases.
- Results show time, correct/total, and correction rate.

## Groups And Levels

- CXY Easy: tables 1 to 5
- CXY Medium: tables 1 to 7
- CXY Hard: tables 1 to 9
- CXR Easy: tables 11 to 13
- CXR Medium: tables 11 to 16
- CXR Hard: tables 11 to 20

## Competition

- CXY plays first.
- CXR plays second with the same difficulty.
- Higher correct count wins.
- If correct count is tied, faster time wins.
- Competition history is saved locally.

## Persistence

Use `localStorage` to save:

- Best score
- Total stars earned
- Wrong questions
- Weak multiplication tables
- Group stats for CXY and CXR
- Competition history
- Last played date
- Games played

## Technical Constraints

- HTML5, CSS3, and vanilla JavaScript only
- No backend
- No login
- No database
- No npm or build tools
- No external CDN libraries
- No paid API
- Compatible with GitHub Pages subfolder deployment

## PWA Requirements

- Valid web app manifest
- Service worker cache for offline play
- iPad Home Screen metadata and icon
- Safe-area and touch-friendly layout
