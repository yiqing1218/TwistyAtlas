> 语言 / Language: [简体中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md)

# Twisty Atlas Cube Algorithm Atlas

An algorithm library for multiple types of cubes, plus a **true 3D** move player and a **csTimer-style timer**. Algorithms, move highlighting, and the 3D view are kept strictly in sync; **37 built-in algorithm sets (2433 cases / 13667 algorithms)** are included; data is stored locally and works offline. Desktop and Android each have their own distinct interaction design (not the same page merely scaled).

This is neither a mockup nor a video: cubes/tetrahedrons/dodecahedrons are rendered in real time with WebGL, and every layer turn is computed by `cubing.js`'s state model. Correctness is verified by checking engine state rather than screenshots.

---

## Features

### 3D Player
- **True 3D playback**: 9 puzzle types are true 3D — 3×3, 2×2 through 7×7, Pyraminx, Skewb, and Megaminx; Square-1 uses 2D rendering (an engine limitation, labeled honestly).
- **Step-by-step algorithm playback**: 0 / N step counter, draggable progress bar, previous/next step, jump to start/end, 0.5×–2× speed control.
  Clicking step k always stops at the frame at the end of step k (positioning is based on the engine timeline, not a timer).
- **Three initial states**: start from solved / use the inverse algorithm as the initial state / custom setup (for cases such as OLL, PLL, F2L).
- **Optional demo bottom face**: yellow (default) / white / blue / green / red / orange. The approach is not "rotating the camera"; instead the algorithm and initial state are conjugated together as `R·A·R⁻¹`, so the final state is still solved — only the overall orientation differs.
  The selection is persisted and the current algorithm is reloaded immediately after switching.
- **Camera and viewing**: drag to rotate, scroll to zoom, one-click reset. **Camera movement does not change the cube state** (there is a dedicated test case for this).

### Built-in Algorithm Sets (37 sets / 2433 cases / 13667 algorithms)
| Category | Contents |
|---|---|
| 3×3 · CFOP main line | OLL 57, PLL 21, 2-Look OLL 10, 2-Look PLL 6, F2L 41 |
| 3×3 · Advanced systems | COLL 40, WV 26, ZBLL/1LLL 472, **VLS 189**, ZBLS 291, OLLCP 342, CLS 97, SBLS 65, SV 27, CMLL 42, ELL 25, Advanced F2L 54, Pseudo F2L 33 |
| 2×2 | CLL 42, EG-1 40, EG-2 40, Ortega OLL 7, Ortega PBL 9 |
| 4×4 / 5×5 | 4×4 OLL Parity 9, 4×4 PLL Parity 52, 5×5 L2E 31 |
| Pyraminx / Megaminx / SQ-1 | Pyraminx L4E 49; Megaminx CO/CP/EO/EP/PLL 16/15/3/5/151; SQ-1 CO/CP/EO/EP/Parity 7/8/7/99/5 |

Every algorithm has been structurally validated with real KPuzzle (9357 passed full state validation, 4310 passed syntax + parseability validation);
the details panel shows the source and validation level; the 399 rejected algorithms are recorded in `data/verified/rejected.json`.
For details see [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).

### Timer (csTimer-style)
- Scramble bar at the top (real WCA random states) + get another (`N`); scramble text wraps fully on mobile without truncation.
- Hold Space (or hold the large number area) for ≥ 300 ms to turn green → release to start; press again to stop.
- WCA inspection: start within 15 s, 15–17 s gives `+2`, over 17 s gives `DNF` (toggleable).
- Statistics: current / best / worst / mean / mo3 / ao5 / ao12 / **ao50 / ao100** / best ao5 / ao12 / ao50,
  mean with best and worst removed, correct DNF handling.
- **Individual results are editable**: click `+2` / `DNF` to toggle a penalty, click to delete a single result; `Delete` key removes the last result; clear the session.
- **Export**: CSV (opens directly in Excel, includes penalties, scramble, timestamps) / JSON (all fields) / plain text (aligned table).
- Right column: a real `TwistyPlayer` preview of "what this scramble looks like" (not an image).
- The seven-segment display is pure SVG polygons (beveled strokes + `skewX(-6)`), with no font dependency; width adapts automatically,
  shrinking for long numbers such as `1:23.456` so nothing is clipped on narrow screens.

### Algorithm Library Management
- Search (title / algorithm / tags), category and tag filters, favorites, sorting, create/edit/copy/delete/undo-delete.
- Import and export in both JSON and CSV formats; preview before import with duplicates flagged; atomic transaction with full rollback on failure.
- Three-column layout on desktop; on mobile the "list + detail" side-by-side view is dropped — tapping an item goes directly to a single-item detail page (with player).

### Two Interfaces: Desktop / Mobile
| | Desktop (> 760 px) | Mobile (≤ 760 px) |
|---|---|---|
| Navigation | Top horizontal navigation (including the "workbench" three-column view) | **Bottom 4 tabs**: Timer / Sets / Library / Settings (thumb-reachable, avoiding the full-screen gesture area) |
| Layout | Three columns side by side | Single column, large areas (player / large timer) with fixed height, list scrolls inside its container, **no whole-page vertical scrolling** |
| Entry | Workbench `#/` | Automatically lands on `#/sets` (the workbench is a desktop-only combined three-column view) |
| Information density | All fields | Removes duplicate titles, duplicate counts, and long explanations, keeping only core actions |

### Six-Language Interface
- The UI supports Simplified Chinese / English / 日本語 / Русский / Español / Português (BR), switchable instantly under Settings → Language with the choice persisted; "Follow system" resolves according to the browser's preferred language.
- Lower layers (`domain` / `application` / `infrastructure`) contain no UI copy; translations are centralized in the presentation layer at `src/presentation/i18n/`. Dictionary keys are derived from the baseline language — missing or extra keys both produce type errors — and unit tests verify that the six languages have identical key sets and interpolation placeholders.
- The README itself is also available in six languages, switchable from a single line at the top.

### Keyboard Shortcuts (Player)
| Key | Action |
|---|---|
| `Space` | Play / pause (start timing on the timer page) |
| `←` / `→` | Previous step / next step |
| `Home` / `End` | Jump to start / end |
| `Delete` | Delete the last result on the timer page |
| `Esc` | Close dialog / cancel timing |

---

## Quick Start

```bash
npm install
npm run dev          # http://localhost:5173
```

### All Commands

```bash
npm run dev            # development server
npm run build          # type check + production build (vue-tsc --noEmit && vite build)
npm run preview        # preview the production build
npm run check          # typecheck + architecture check + 115 unit tests
npm run test           # run Vitest only
npm run test:e2e       # Playwright (44 executions: 38 desktop projects + 6 mobile projects)
npm run data:build     # regenerate built-in algorithm sets (fetch results are in data/raw/)
npm run desktop:build  # package desktop app → out/TwistyAtlas/TwistyAtlas.exe
npm run android:apk    # package Android → out/TwistyAtlas-1.3.0-android-debug.apk
```

---

## Two Packaging Approaches

| Target | Technology | Artifact |
|---|---|---|
| Computer (Windows x64) | Electron 45 (`contextIsolation` + `sandbox`) | `out/TwistyAtlas/TwistyAtlas.exe` (367 MB, no installation required) |
| Android phone | Capacitor 8 + Gradle (minSdk 24 / targetSdk 36, JDK 21) | `out/TwistyAtlas-1.3.0-android-debug.apk` (5.1 MB) |

Steps, environment requirements, pitfalls encountered, and measured conclusions are in [`docs/PACKAGING.md`](docs/PACKAGING.md).

---

## Architecture

Layered (`domain / application / infrastructure / presentation / data`), with dependency direction statically guarded by
`scripts/check-arch.mjs` (67 files); `cubing/*` is only allowed under `infrastructure/cubing`:

```
src/
  domain/                  # pure logic, zero framework dependencies
    model/                 #   algorithms, cubes, results, settings, demo orientation
    timer/                 #   timer state machine (pure functions), statistics, formatting
  application/
    sets/                  #   built-in algorithm set loading and categorization
    timer/                 #   result export (CSV / JSON / text, pure functions)
  infrastructure/
    cubing/                # the only place that interfaces with cubing.js (includes adapters/)
    persistence/           #   Dexie: algorithms, results, settings
  presentation/            # Vue components / views / Pinia store / router / composables / i18n
  data/algsets.json        # build-time generated algorithm sets (separate chunk, not loaded on first screen)
e2e/                       # Playwright (desktop + mobile)
scripts/                   # data pipeline, architecture check, packaging, verification, screenshots
docs/                      # architecture, data, packaging, acceptance evidence
```

For details see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Tests and Evidence

```
Unit tests        115 (Vitest)  — timer boundaries/statistics/algorithm validation/import-export/playback positioning/export formatting/bottom-face conjugation/six-language dictionaries
End-to-end        44 executions (Playwright) — real WebGL, state consistency, persistence, no whole-page scrolling on mobile, tabs reachable, language switching
Architecture check  67 files, no out-of-bounds dependencies
Data validation  2433 cases / 13667 algorithms each checked by the engine (399 rejected)
```

```bash
# Test rendering and state for each puzzle in practice (will rewrite docs/capability-raw.md and docs/screenshots/puzzle-*.png)
node scripts/verify-puzzles.mjs

# Smoke test the production build (first run npx vite preview --port 4173)
node scripts/verify-dist.mjs

# Verify the desktop build page by page (first launch out/TwistyAtlas/TwistyAtlas.exe --remote-debugging-port=9222)
node scripts/verify-desktop.mjs

# Desktop screenshot archive; mobile four-page screenshots + quantified checks for "no whole-page scrolling / no horizontal overflow / tabs within viewport"
node scripts/shots.mjs
node scripts/shot-mobile.mjs
```

---

## Documentation

| File | Contents |
|---|---|
| `docs/ARCHITECTURE.md` | Layering, dependency rules, key modules, data flow, extension points, mobile routing strategy |
| `docs/PACKAGING.md` | Commands, environment, pitfalls, and measured conclusions for the two packaging approaches |
| `docs/DATA_SOURCES.md` | Sources of the 37 algorithm sets, structural criteria, rejected entries, known gaps |
| `docs/API_VERIFICATION.md` | Item-by-item verification of the cubing.js API (versions, signatures, runtime output, overturned assumptions) |
| `docs/CUBING_CAPABILITY_MATRIX.md` | Item-by-item measured conclusions for 10 puzzle types (including why Square-1 can only be 2D) |
| `docs/TECH_DECISIONS.md` | Technical decisions: choices, abandoned approaches, reasons, costs |
| `docs/ACCEPTANCE_REPORT.md` | Phase A–H acceptance report + v1.2 / v1.3 additions |
| `docs/screenshots/` | Real screenshots of desktop, mobile (390×844 / 360×800), each puzzle, timer, and algorithm sets |
| `README.{en,ja,ru,es,pt-BR}.md` | The README in six languages, switchable from a single line at the top |

---

## Data and Privacy

- All data lives in the browser's IndexedDB (database name `TwistyAtlasDB`), **no upload, no account, no backend**.
- Clearing site data will lose algorithms/results; back up regularly with "Export JSON".
- Imports only accept whitelisted fields, and HTML is rendered as plain text (with a dedicated test verifying scripts do not execute).

---

## Known Limitations

1. **Square-1 has 2D rendering only**: `cubing@0.66.1`'s `visualizationStrategy` for Square-1 was measured as `2D`,
   with no true 3D deformation model. The play area shows a "2D rendering" badge, **without posing as 3D**.
2. **Playable puzzles are limited to 10 types**: the engine ships with 21, but those without per-state acceptance testing do not appear in the selector.
3. **The Android package has not been tested on a real device**: it compiles and passes package structure validation, but no AVD/device was available locally, so install-and-run verification was not performed.
4. **The desktop build is unsigned and uses the default icon**: first run may show an "unknown publisher" warning.
5. **PWA auto-update may interrupt editing**: `registerType: 'autoUpdate'`, with no implementation of "delay update when there are unsaved changes".
6. **No cloud sync**: use export / import to move between devices.
7. **No performance-grade landscape layout on mobile**: landscape still works, but the player height is calculated with `vh`, so the visible area is smaller in landscape.

---

## Browser Requirements

WebGL2 + IndexedDB + ES2022. Verified under Chromium (Playwright's bundled `chromium` channel,
SwiftShader software rendering) and Electron 45.

---

## License

[MIT](LICENSE) © 2026 yiqing1218

Third-party libraries used (Vue, Vite, cubing.js, Dexie, Electron, Capacitor, etc.) retain their respective licenses;
see each dependency's repository for the complete list. Built-in algorithm data comes from public cubing sites; sources and per-set credits are in
[`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).
