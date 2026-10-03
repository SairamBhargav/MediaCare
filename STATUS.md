# Status

**Current phase:** 1 (polished Expo Go experience on sample data), in progress
**Last updated:** 2026-10-02

## Completed

- **Phase 0**: P0-REPO-001 · P0-UI-001 · P0-UI-002 · P0-NAV-001 · P0-MOT-001 (device check pending) · P0-DOM-001 · P0-DOM-002 · P0-CI-001 · P0-DOC-001
- **Phase 1**: P1-SET-002 (preferences persist) · P1-CLN-001 (Clean home categories and states) · P1-JOB-001 (job model + simulated sample scan) · P1-JOB-002 (compact job bar + scan sheet)
- **In progress**: P1-REV-001. Per-group review works inside the category screen; skip/protect and keeping selections after leaving the screen remain

Details in [docs/BACKLOG.md](docs/BACKLOG.md).

## Checks actually run (Windows 11, Node 22.23.3, 2026-10-02, after P1-JOB-002)

| Check                                     | Result                                                           |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `npm run typecheck`                       | ✅ pass (with `.expo/types` set aside, as in CI; see note below) |
| `npm run lint`                            | ✅ pass                                                          |
| `npm run format:check`                    | ✅ pass                                                          |
| `npm test`                                | ✅ 105/105 tests, 12 suites                                      |
| `npm run doctor`                          | ✅ 21/21 (after adding expo-sqlite)                              |
| `npm run bundle:ios`                      | ✅ iOS Hermes bundle built (4 MB)                                |
| Metro dev server (`expo start --offline`) | ✅ served `/status` 200                                          |
| GitHub Actions CI                         | ✅ green on the Phase 0 fix commit; runs again on push           |
| Physical iPhone in Expo Go                | ⏳ not reported yet (P1-DEV-001)                                 |

**Windows typed-routes note:** while `npm start` runs, Expo's dev server on Windows records newly created non-route files as routes in `.expo/types/router.d.ts` (entries like `/../state/preferences`). Local `npm run typecheck` then fails on valid links. Restart `npm start` or delete `.expo/types`. Runtime and CI are unaffected. Also in [docs/SETUP_WINDOWS.md](docs/SETUP_WINDOWS.md).

## Implemented vs. evidence

| Item                                                                 | Implemented | Automated checks                       | Device-tested | Notes                                           |
| -------------------------------------------------------------------- | ----------- | -------------------------------------- | ------------- | ----------------------------------------------- |
| Tabs, Settings sheet, gallery                                        | ✅          | ✅                                     | ⏳ owner      |                                                 |
| Preferences survive relaunch                                         | ✅          | ✅ (in-memory store mock)              | ⏳ owner      | Close the app fully, reopen; theme should stick |
| Clean home states + category shelf                                   | ✅          | ✅ (all 5 states)                      | ⏳ owner      | Shelf snap feel needs a device                  |
| Sample scan: job bar, scan sheet, pause/resume/stop, partial results | ✅          | ✅ (reducer, runner, store, bar, card) | ⏳ owner      | Bar spring and sheet detents need a device      |
| Category screen, cross-group selection summary                       | ✅          | ✅                                     | ⏳ owner      |                                                 |
| Press/selection motion + haptics                                     | ✅          | ✅ (state only)                        | ⏳ owner      | Feel can't be verified off-device               |
| `@expo/ui` Settings controls in Expo Go                              | ✅          | ✅ (types)                             | ⏳ owner      | Risk R7                                         |
| Real photo access, scanning, exports, removal                        | ❌          | —                                      | —             | Phases 2–3                                      |

**Demo-only paths:** `src/demo/` (sample library, hand-authored sample findings, simulated scan runner) and `src/state/clean-session.ts` (sample results and sample jobs are session-only, never persisted). Every surface showing them says "Sample".

## Next actionable tasks

1. **P1-DEV-001 (owner)**: run the app on your iPhone and do the smoke test in [docs/TEST_PLAN.md §4](docs/TEST_PLAN.md#4-device-checks-owner-physical-iphone), plus: Clean → **Run sample scan** → switch to Library while it runs (job bar stays above the tabs) → tap the bar (sheet opens; drag between half and full) → Pause/Resume → let it finish (one success tick) → open categories and select across groups. Try **Stop scan** midway too: you should get partial results. Report iPhone model, iOS version, Expo Go version and anything that looks or feels off.
2. **P1-REV-001** (finish): skip/protect per group; keep selections for the session when leaving and returning.
3. **P1-REV-002 → P1-REV-003**: full-screen compare and decide-next transition, then the **design checkpoint** with the owner.
4. **P1-REV-004**: action plan preview (exact items, keeper, bytes, iCloud warning; removal disabled in sample mode).
5. **P1-LIB-001 → P1-LIB-004**: sectioned timeline, adaptive columns, viewer and gestures.
6. **P1-ONB-001 → P1-ONB-003**: onboarding and access explainer.

## Blockers / owner input

- Device facts still unknown (A1): iPhone model, iOS version, Expo Go SDK.
- The GitHub repo is **public** (checked 2026-10-02). Make it private in GitHub → Settings → General → Danger Zone unless you intend to publish the code (A4).
- Not needed until Phase 3: Apple Developer Program decision, bundle identifier.
