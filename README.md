# MediaCare

_Keep the memories that matter, reclaim space with confidence, and make the best of the media you keep._

An iPhone-first photo and video cleanup, organization and creation app, built with React Native, Expo and TypeScript, developed on Windows and tested on a physical iPhone. Working name; the brand isn't final.

> **Current status: Phase 0 complete (foundation).** The app runs in Expo Go with **sample images only**. It does not request photo access, scan a library, or remove anything yet. See [STATUS.md](STATUS.md).

## What's in this build

- Three tabs: **Clean**, **Library**, **Studio**, plus a **Settings** sheet.
- A sample _Similar shots_ review on Clean: suggested keeper (never selectable), tap-to-select with a spring check badge and haptic tick, Select all / Clear, and a live summary with sizes labelled as illustrative.
- A virtualized sample photo grid with Select mode.
- Light/Dark/System appearance, an in-app _Less motion_ switch that adds to iOS Reduce Motion, a Haptics switch, and a solid tab bar under Reduce Transparency.
- A development-only _Components & Motion_ gallery (Settings → Developer).

## Run it (Windows → iPhone)

Requirements: Node 22 LTS, Git, and **Expo Go** (SDK 57) on your iPhone, on the same Wi-Fi as the PC.

```powershell
git clone https://github.com/SairamBhargav/MediaCare.git
cd MediaCare
npm ci
npm start
```

Scan the QR code with the iPhone Camera app to open the project in Expo Go. Connection problems, tunnel fallback and the later EAS development-build path: [docs/SETUP_WINDOWS.md](docs/SETUP_WINDOWS.md).

## Scripts

| Command                                                | What it does                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| `npm start`                                            | Start Metro for Expo Go                                            |
| `npm run start:tunnel`                                 | Same, through a tunnel when LAN fails                              |
| `npm run start:dev-client`                             | Start Metro for a development build (Phase 3)                      |
| `npm run check`                                        | Typecheck + lint + format check + tests                            |
| `npm run typecheck` / `lint` / `format:check` / `test` | Individual checks                                                  |
| `npm run format`                                       | Apply Prettier                                                     |
| `npm run doctor`                                       | Expo dependency/config health                                      |
| `npm run bundle:ios`                                   | Build the iOS JS bundle to prove it compiles (not native behavior) |

## Project map

```
src/app/         routes (Expo Router)        src/components/  shared UI primitives
src/screens/     screen bodies               src/theme/       tokens: color, type, spacing, motion
src/domain/      pure rules + tests          src/demo/        synthetic sample library
src/state/       small UI stores             docs/            plan, specs, decisions
```

## Documentation

| Doc                                                                                                                    | Purpose                                                       |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [STATUS.md](STATUS.md)                                                                                                 | Where the project is, what's next, checks actually run        |
| [docs/PRD.md](docs/PRD.md)                                                                                             | Product, personas, full feature → phase map                   |
| [docs/ROADMAP.md](docs/ROADMAP.md) / [docs/BACKLOG.md](docs/BACKLOG.md)                                                | Phases, exit gates, ordered tasks                             |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) / [docs/DATA_MODEL.md](docs/DATA_MODEL.md)                                | Layers, interfaces, catalog design                            |
| [docs/STACK.md](docs/STACK.md) / [docs/CAPABILITIES.md](docs/CAPABILITIES.md)                                          | Versions, dependencies, what works where and on what evidence |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) / [docs/MOTION.md](docs/MOTION.md) / [docs/SCREENS.md](docs/SCREENS.md) | Visual, motion and screen specs                               |
| [docs/TEST_PLAN.md](docs/TEST_PLAN.md)                                                                                 | Automated checks and the iPhone checklist                     |
| [docs/PRIVACY_AND_SAFETY.md](docs/PRIVACY_AND_SAFETY.md)                                                               | Rules for access, removal, exports, storage claims            |
| [docs/RISKS_AND_ASSUMPTIONS.md](docs/RISKS_AND_ASSUMPTIONS.md)                                                         | Risks, assumptions, owner decisions                           |
| [docs/decisions/](docs/decisions/)                                                                                     | Architecture decision records                                 |

## Known limits

- Sample data only; no photo access, scanning, exports or removal yet.
- Preferences reset on relaunch (persistence is P1-SET-002).
- Nothing has been verified on an iPhone yet. CI proves the code compiles and tests pass, not native behavior.
- No license has been chosen; all rights reserved.
