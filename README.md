# MediaCare

_Keep the memories that matter, reclaim space with confidence, and make the best of the media you keep._

An iPhone-first photo and video cleanup, organization and creation app, built with React Native, Expo and TypeScript, developed on Windows and tested on a physical iPhone. Working name; the brand isn't final.

> **Current status: Phase 2 built, awaiting device test.** MediaCare can read your Photos library (with your permission), catalog it on the iPhone, find bursts, screenshots and long videos, and make verified smaller copies. Removal is not available yet (Phase 3). See [STATUS.md](STATUS.md).

## What's in this build

- **Clean**: scan your Photos library on the iPhone (or a clearly labelled sample). Real results: photos taken moments apart, screenshots and long videos, with favorites never suggested. Review groups (keeper, protect, skip, compare side by side) and see a removal plan. Removal itself is disabled until Phase 3.
- **Library**: your photos by month; tap one for details, Protect, or a smaller copy.
- **Studio**: make smaller JPEG copies by quality or target size, with real measured sizes, saved as new photos. Originals are never changed.
- **Settings**: theme, motion, haptics, photo access, Clear MediaCare data, and developer tools (component gallery, Diagnostics).

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

- No removal yet; exact duplicates and blur detection need Phase 3 (native code).
- Real photo sizes are not measured during scans; only copies you make are measured.
- Nothing has been verified on an iPhone yet. CI proves the code compiles and tests pass, not native behavior.
- No license has been chosen; all rights reserved.
