# Mystery Game — *THE CHOICE*

> **One machine. Three coffees. No coffee without a correct answer.**

An interactive mystery set at a vintage touchscreen coffee machine. Choose a coffee on the machine's
screen and solve that coffee's logic puzzle; only then does the machine brew it. A cartoon hand presses
the buttons for you. The finished cup is handed toward you, and after you pick it up, the machine has
something to say. Three puzzles, three coffees, a few secrets, and one final reward.

The app runs entirely in the browser (React + TypeScript + Vite). It has no backend and no account,
and stores nothing outside your own browser.

## Contents

- [Features](#features)
- [Gameplay walkthrough](#gameplay-walkthrough)
- [Technology stack](#technology-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Progress persistence](#progress-persistence)
- [Testing and quality assurance](#testing-and-quality-assurance)
- [Design and interaction](#design-and-interaction)
- [Secrets and Easter eggs (spoilers)](#secrets-and-easter-eggs-spoilers)
- [Limitations](#limitations)
- [Roadmap (ideas)](#roadmap-ideas)
- [Contributing](#contributing)
- [License and credits](#license-and-credits)

## Features

- **A coffee machine as the interface.** The machine is a real photograph. Its touchscreen is
  overlaid with three coffees (COFFEE, NORMAL COFFEE, STRONG COFFEE), sugar controls (0–5) and
  START. A cartoon hand reaches in and presses each button you choose, landing on the button's centre
  at any screen size.
- **Three logic puzzles**, one per coffee. Answers are never stored as strings: each answer is derived
  from the puzzle's own model, and the tests prove each puzzle has exactly one solution.
  | Coffee | Puzzle | How you answer |
  | --- | --- | --- |
  | COFFEE | *The First Lock*: three switches, three engraved statements, exactly one is true | Choose switch A, B or C |
  | NORMAL COFFEE | *Patterns Within Patterns*: a three-digit safe code, deduced from five logged attempts | Enter a 3-digit code |
  | STRONG COFFEE | *The Final Deduction*: three people, hats from a set of three white and two black, and what each can know | Choose WHITE or BLACK |
- **Feedback on wrong answers.** Incorrect and malformed answers are refused with a short verdict
  (e.g. ACCESS DENIED, or the log entry a code contradicts). The machine stays locked.
- **The brew.** ACCESS GRANTED, then power-up, grinding, pressure, the pour (with your sugar cubes
  dropping in first) and steam. Afterwards, the cup leaves the tray and travels toward you.
- **Picking up the coffee.** The cup waits in the foreground until you pick it up (click, tap, or
  Enter/Space). Only then does the coffee count as drunk, and the machine's display shows a message
  for that coffee.
- **MORE COFFEE.** A wide, spacebar-style metal key with a brass edge, set into the casing under the
  screen. It appears only after the cup is picked up and continues to the next message, or back to a
  fresh machine. Details are in [Design and interaction](#design-and-interaction).
- **Persistent progress.** Solved puzzles, finished coffees, Easter eggs and the final reward survive
  a reload (browser `localStorage`). A small **brass seal** marks each solved coffee on the machine.
- **Easter eggs and a final reward.** Curious Barista, Night Shift, Missing Bean, Coffee Ritual, and
  **The Secret Blend**: a final screen with an archive entry and the achievement
  **MASTER OF THE ARCHIVE**. How to find them is under
  [Secrets and Easter eggs](#secrets-and-easter-eggs-spoilers).
- **Leaving a puzzle.** A small back icon (top left), **Esc**, or the browser/phone back gesture
  returns to the machine. Your chosen coffee, sugar and half-typed answer are kept.
- **Responsive, accessible, reduced-motion aware**: see [Design and interaction](#design-and-interaction).

## Gameplay walkthrough

1. **Start.** The landing page shows one line: *FREEDOM IS YOUR CHOICE*. **CHOICE** is the button.
2. **Choose a coffee.** On the machine's screen, select a coffee and (optionally) set sugar with − / +.
   Press **START**. If nothing is selected, the machine refuses with a red pulse on the coffee buttons.
3. **Solve its puzzle.** The puzzle screen shows only the puzzle, the answer control, and a submit
   button. Wrong answers are refused with feedback; you can retry as often as you like, or leave and
   come back.
4. **Watch it brew.** A correct answer shows ACCESS GRANTED, and the machine brews your coffee with
   the sugar you chose.
5. **Pick up the cup.** The cup comes toward you and waits. Pick it up; this completes the "drinking".
6. **Read the machine's response**, then press **MORE COFFEE** to continue. After a few coffees there
   may be more than one page; each press shows the next one.
7. **Repeat.** The machine resets (no selection, no sugar), and solved coffees carry a brass seal. A
   solved puzzle can be played again, but it must be answered again each time.
8. **The final reward** unlocks once all three puzzles are solved *and* each of their coffees has been
   picked up. It plays right after the message that completes the set.

## Technology stack

Versions are those in `package-lock.json`.

| Technology | Version | Role |
| --- | --- | --- |
| [React](https://react.dev) + React DOM | 19.3 | UI; the game flow is a pure reducer (`useReducer`) |
| [TypeScript](https://www.typescriptlang.org) | 7.0 | Strict typing (`tsc --noEmit` is the type check) |
| [Vite](https://vite.dev) + `@vitejs/plugin-react` | 8.3 / 6.1 | Dev server, hot reload, production build |
| [Vitest](https://vitest.dev) | 5.0 | Unit tests (Node environment) |
| `@fontsource/ibm-plex-mono`, `courier-prime`, `cormorant-garamond` | 5.3 | Self-hosted fonts: machine display, case files, landing line and puzzle questions |
| `lucide-react` | 1.58 | Declared in `package.json`, but not imported by the current source |

Styling is plain CSS (custom properties, container queries); there is no CSS framework. The machine
artwork is the supplied photograph plus SVG and CSS overlays.

## Getting started

### Prerequisites

- **Node.js 22.12 or newer** (Vitest 5 requires `^22.12.0 || ^24.0.0 || >=26.0.0`; Vite 8 alone
  accepts `^20.19.0 || >=22.12.0`).
- **npm** (the repository ships a `package-lock.json`).
- A current evergreen browser (Chrome, Edge, Firefox, Safari). The UI relies on CSS container
  queries, `:has()`, `dvh` units and the `inert` attribute.

### Install and run

```bash
git clone https://github.com/LoneCod3r/Mystery_game.git
cd Mystery_game
npm ci             # installs exactly what package-lock.json specifies
npm run dev        # starts the dev server
```

Open the URL Vite prints, by default **http://localhost:5173/**.

### Available scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm test` | Runs all unit tests once (`vitest run`) |
| `npm run typecheck` | TypeScript check (`tsc --noEmit -p tsconfig.json`) |
| `npm run build` | Type check, then production build into `dist/` |
| `npm run preview` | Serves the production build locally |

There is no lint script in this project.

## Project structure

```
.
├── index.html                 App shell (title, meta, favicon)
├── public/favicon.svg
├── Coffee_machine.webp        Original machine photo (kept for reference; not loaded by the app)
├── hand.png                   Original hand artwork (kept for reference; not loaded by the app)
├── vite.config.ts             Vite + Vitest configuration
├── tsconfig.json
└── src/
    ├── main.tsx               Entry: fonts, stylesheets, <App /> in StrictMode
    ├── App.tsx                Screen routing, history/Esc handling, viewport sizing, saving progress
    ├── state/
    │   ├── machine.ts         The game as an explicit state machine (reducer)
    │   ├── progress.ts        Saved progress: versioned, validated localStorage
    │   └── eggs.ts            Easter egg timing rules (pure functions)
    ├── data/
    │   ├── paths.ts           Coffee ↔ case mapping (id, label, roast colour, pour time)
    │   ├── puzzles.ts         Puzzle content and answer validation
    │   ├── rewards.ts         All post-coffee, Easter egg and final-reward copy
    │   ├── machine.ts         Photo geometry: screen, buttons, hand targets, cup, casing parts
    │   └── brew.ts            Brewing phases
    ├── logic/                 Puzzle solvers: switch statements, code clues, possible-worlds hats
    ├── hooks/                 useHand (hand choreography), useReducedMotion
    ├── components/            IntroScreen, MachineSelect, PuzzleScreen, PuzzleInput, MachineScreen,
    │                          VendingMachine, Cup, CartoonHand, HandLayer, MoreCoffeeKey,
    │                          MachineEggs, SecretBlend, SugarEffects, Glyphs, ScanlineOverlay
    ├── styles/                base.css (tokens, CRT overlay), screens.css, machine.css, vending.css
    └── assets/                machine-empty.webp (the photo the app loads), machine-clean.webp
                               (its source), cup-hd.png, hand-clean.png
```

Tests sit beside the code they cover (`*.test.ts`).

**How the game flows** (`src/state/machine.ts`):
`INTRO → PATH_SELECTION → PUZZLE → ACCESS_GRANTED → BREWING → PUZZLE_SOLVED → (SECRET_BLEND)`.
Every action is honoured only on the screens that allow it. For example, the machine cannot brew
without a correct answer, and a drinking event counts once per brew, whatever the UI sends.

## Progress persistence

Progress is saved in the browser's `localStorage` under the key **`the-choice/progress`**:

```json
{
  "version": 1,
  "solved": ["key", "mind"],
  "drunk": ["key"],
  "coffees": 2,
  "eggs": ["missingBean"],
  "finalUnlocked": false,
  "finalSeen": false
}
```

(`key`, `mind` and `void` are COFFEE, NORMAL COFFEE and STRONG COFFEE.)

- **What's stored:** which puzzles are solved and which coffees were drunk, the count of finished
  coffees, the Easter eggs found, and whether the final reward is unlocked and has been seen in full.
- **When it changes:** only on real events: a correct answer, picking up a cup (once per brew), or
  finding an egg.
- **How it's restored:** on load, the record is rebuilt and validated.
  - Malformed JSON, an unknown version, unknown ids, duplicates and wrong types fall back to safe values.
  - Impossible combinations are corrected: drunk coffees must have been solved, and the Coffee Ritual
    needs three coffees.
  - `finalUnlocked` is *derived* from the data, never trusted as stored.
- **It never skips a puzzle.** Saved progress only shows the seals and keeps rewards; every coffee still
  requires answering its puzzle.
- **Local only.** This is not an account or server storage. It lives in one browser on one device.
  It is lost if site data is cleared, and is not kept in private windows that discard storage. If
  storage is unavailable, the game still works, and progress lasts for the visit.

**Resetting progress:** open the browser's developer console on the game's page and run the line
below, then reload. Alternatively, clear this site's data in the browser settings.

```js
localStorage.removeItem('the-choice/progress')
```

## Testing and quality assurance

The repository contains **65 unit tests in 6 files**, run with `npm test`:

| File | Covers |
| --- | --- |
| `src/logic/puzzles.test.ts` | Each puzzle has exactly one solution (truth tables; all 1000 codes; all hat worlds); answer normalisation and validation |
| `src/state/machine.test.ts` | State-machine transitions: no brewing without a correct answer, sugar, drafts, MORE COFFEE paging and double activation, drinking counted once, the eggs, the Coffee Ritual and the Secret Blend (first time, revisit, after reload) |
| `src/state/progress.test.ts` | Storage round-trip, versioning, malformed or tampered data, storage that throws, the unlock rules |
| `src/state/eggs.test.ts` | Tap and keypress timing windows; which key events count for Night Shift |
| `src/data/machine.test.ts` | Photo geometry: buttons inside the screen, hand alignment, MORE COFFEE clearance |
| `src/components/MachineSelect.test.ts` | Renders the selection screen with the props the app passes, for empty, missing and malformed saved data (regression test) |

Before publishing this version, all three checks passed: `npm run typecheck` (clean), `npm test`
(65/65), and `npm run build`.

During development the app was also checked in a real browser (Chrome via Playwright):

- the full journey;
- every Easter egg;
- keyboard-only and reduced-motion play;
- no console errors;
- layouts from 1920×1080 down to 568×320 and 360×640.

Those browser scripts are not part of this repository.

## Design and interaction

- **Visual direction.** A dark, archival, slightly analogue mood: a real machine photograph in a
  frame, a faint CRT scanline and grain overlay, phosphor-green text on the machine's display, and
  brass accents for anything rewarded. There is no decorative text.
  - **Fonts:** IBM Plex Mono for the machine, Courier Prime for the case files, Cormorant Garamond for
    the landing line and puzzle questions.
- **The machine.** Every overlay is positioned in fractions of the photograph and sized in container
  units, so the screen, the hand, the cup and the casing parts stay locked to the photo at any size.
- **MORE COFFEE.** A native `<button>`, so a mouse click, a tap, **Enter** or **Space** each activate
  it once.
  - It looks pressed while held, by pointer or keyboard.
  - Two activations within 450 ms count as one, and each press is tied to the page it was made on, so
    a double click never skips a message.
  - Its touch target is at least 44×44 px and never covers the display, the spouts or the cup.
  - It takes focus only if focus would otherwise be lost (when the picked-up cup disappears).
- **Responsive.** Every screen is exactly one visible viewport tall, following the on-screen keyboard
  via `visualViewport`; the page itself never scrolls. A long puzzle scrolls inside its own area while
  the answer bar stays visible. Short landscape screens get side-by-side layouts.
- **Accessibility.**
  - Semantic buttons, radio groups and labelled inputs.
  - Accessible names for icon-only controls.
  - Live regions announce selections, the machine's messages and Easter egg messages.
  - Focus moves to each new screen.
  - Visible focus outlines.
  - 44 px touch targets for the main controls.
- **Motion.** With `prefers-reduced-motion: reduce`, the cup appears instead of travelling, the brew
  is compressed, and particles, flicker and glow sweeps are skipped. The game remains fully playable.
- **No sound.**

## Secrets and Easter eggs (spoilers)

<details>
<summary><strong>Show the solutions</strong></summary>

Each egg is awarded once and saved. Its message appears once, briefly, on the machine's display, and
never blocks a click.

| Egg | How to find it |
| --- | --- |
| **Curious Barista** | Press the small brass maker's badge on the front of the drip tray **5 times**, each within 3 s of the last. It is a focusable button, so Tab + Enter works. *"You know, most people just want coffee."* It is disabled while the cup is moving or waiting. |
| **Night Shift** | On the selection screen, while the machine is idle, press **N** three times within 2 s. Not while typing an answer or with a control focused; modifiers and held-key repeats are ignored. *ARCHIVE ENTRY 07.* |
| **Missing Bean** | A single coffee bean rests on the right-hand bean-hopper lid (accessible name "Coffee bean"). *"A good eye makes a good barista."* |
| **Coffee Ritual** | Finish (pick up) **three coffees** of any kind, across visits. The next display page reads *"Ah. A regular."* with a REGULAR CUSTOMER badge. |
| **The Secret Blend** | Solve all three puzzles and pick up each one's coffee (the eggs are not required). After the message that completes the set, MORE COFFEE starts a short sequence on the machine, then the final screen. |

**The final screen** shows:

- *THE SECRET BLEND*, with "Three puzzles. Three coffees. One final secret.";
- the three roasts merging into one;
- *ARCHIVE ENTRY 00*, which ties the three answers together;
- the achievement **MASTER OF THE ARCHIVE**.

It plays in full once. Afterwards, a three-dot brass seal on the machine's casing reopens it directly,
including after a reload.

</details>

## Limitations

- **Progress is browser-local and not tamper-proof.** Editing `localStorage` by hand can unlock the
  final screen. It cannot make the machine dispense without a correct answer, but with no backend
  there is nothing stronger to enforce.
- **Small-screen readability.** On the smallest layouts (e.g. 568×320), text on the machine's own
  display goes down to about 7 px. It fits without clipping, but it is small.
- **Night Shift and focus.** The N sequence is deliberately ignored while a button or field has focus.
  After clicking a coffee button, focus stays on it until it moves elsewhere.
- **One-time messages.** Easter egg messages are shown only when the egg is first found; seeing them
  again requires resetting progress.
- **Modern browsers only.** The layout needs container queries, `:has()` and `inert`; older browsers are
  not supported.
- **Tooling gaps.** There is no lint script, the browser tests are not in the repository, and
  `lucide-react` is an unused dependency.

## Roadmap (ideas)

These are possible improvements, not implemented features or commitments:

- Add the browser (Playwright) tests to the repository and run them in CI.
- Add a lint setup (e.g. ESLint) and remove the unused `lucide-react` dependency.
- Add an in-game "reset progress" control.
- Add real screenshots to this README.

## Contributing

Issues and pull requests are welcome.

- Keep changes focused, and run `npm run typecheck`, `npm test` and `npm run build` before
  submitting.
- Puzzle answers must stay derived from each puzzle's model (with a test proving uniqueness), never
  hard-coded.
- Player-facing copy lives in `src/data/rewards.ts` and `src/data/puzzles.ts`.

## License and credits

No license file is included, so no open-source license is granted; all rights are reserved by the
repository owner unless a license is added.

The fonts are the open-source families listed above, bundled via Fontsource packages. The original
machine photograph (`Coffee_machine.webp`) and hand artwork (`hand.png`) were supplied with the
project; their source is not recorded in this repository.
