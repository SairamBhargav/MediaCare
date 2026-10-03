# Status

**Current phase:** 2 (real photos) in progress, paused mid-phase; Phase 1 owner checkpoint still pending
**Last updated:** 2026-10-03

## Phase 2 progress

Built and pushed: photo access (full/limited/denied), SQLite catalog, resumable metadata-only library scan, honest real findings (moments within 2 s, screenshots, long videos; favorites never suggested), Clean home for real results, Library showing real photos, photo viewer with Protect, and **Make a smaller copy** (quality or target size, measured bytes, decode check, save as a new photo, share). 183 tests pass.

Evidence from expo-media-library's iOS source: `getUri()` / `getInfo()` return the current (edited) rendition and download from iCloud, so exact duplicates need a native module (Phase 3). Video duration from metadata is already in milliseconds.

**Remaining before Phase 2 exit:** Studio entry point and copies list; Settings photo-access row and "Clear MediaCare data"; on-device diagnostics screen for spikes S1/S3/S5; docs (CAPABILITIES, SCREENS, DATA_MODEL, BACKLOG, CHANGELOG); then the owner's real-photo test.

## Completed

- **Phase 0**: P0-REPO-001 · P0-UI-001 · P0-UI-002 · P0-NAV-001 · P0-MOT-001 (device check pending) · P0-DOM-001 · P0-DOM-002 · P0-CI-001 · P0-DOC-001
- **Phase 1**: P1-SET-002 (preferences persist) · P1-CLN-001 (Clean home categories and states) · P1-JOB-001 (job model + simulated sample scan) · P1-JOB-002 (compact job bar + scan sheet) · P1-REV-001 (skip, protect, change keeper, session-persistent review) · P1-REV-002 (full-screen compare) · P1-REV-003 (next-group transition; design checkpoint pending) · P1-REV-004 (removal plan preview) · P1-LIB-001 (month timeline) · P1-LIB-002 (adaptive columns)

Details in [docs/BACKLOG.md](docs/BACKLOG.md).

## Checks actually run (Windows 11, Node 22.23.3, 2026-10-02, after P1-LIB-002)

| Check                                     | Result                                                           |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `npm run typecheck`                       | ✅ pass (with `.expo/types` set aside, as in CI; see note below) |
| `npm run lint`                            | ✅ pass                                                          |
| `npm run format:check`                    | ✅ pass                                                          |
| `npm test`                                | ✅ 150/150 tests, 19 suites                                      |
| `npm run doctor`                          | ✅ 21/21 (after adding expo-sqlite)                              |
| `npm run bundle:ios`                      | ✅ iOS Hermes bundle built (4 MB)                                |
| Metro dev server (`expo start --offline`) | ✅ served `/status` 200                                          |
| GitHub Actions CI                         | ✅ green on the Phase 0 fix commit; runs again on push           |
| Physical iPhone in Expo Go                | ⏳ not reported yet (P1-DEV-001)                                 |

**Windows typed-routes note:** while `npm start` runs, Expo's dev server on Windows records newly created non-route files as routes in `.expo/types/router.d.ts` (entries like `/../state/preferences`). Local `npm run typecheck` then fails on valid links. Restart `npm start` or delete `.expo/types`. Runtime and CI are unaffected. Also in [docs/SETUP_WINDOWS.md](docs/SETUP_WINDOWS.md).

## Implemented vs. evidence

| Item                                                                                          | Implemented | Automated checks                       | Device-tested | Notes                                                 |
| --------------------------------------------------------------------------------------------- | ----------- | -------------------------------------- | ------------- | ----------------------------------------------------- |
| Tabs, Settings sheet, gallery                                                                 | ✅          | ✅                                     | ⏳ owner      |                                                       |
| Preferences survive relaunch                                                                  | ✅          | ✅ (in-memory store mock)              | ⏳ owner      | Close the app fully, reopen; theme should stick       |
| Clean home states + category shelf                                                            | ✅          | ✅ (all 5 states)                      | ⏳ owner      | Shelf snap feel needs a device                        |
| Sample scan: job bar, scan sheet, pause/resume/stop, partial results                          | ✅          | ✅ (reducer, runner, store, bar, card) | ⏳ owner      | Bar spring and sheet detents need a device            |
| Review choices: skip, protect, change keeper, persist across navigation; totals respect them  | ✅          | ✅ (domain, store, screen)             | ⏳ owner      | Long-press action sheet needs a device                |
| Group review: pager + pinch zoom, side by side, differences, next group                       | ✅          | ✅ (compare helper, screen)            | ⏳ owner      | Swipe vs back-swipe and zoom need a device            |
| Removal plan preview (keeper/protected/skipped safety rules, iCloud warning, disabled remove) | ✅          | ✅ (plan domain, screen)               | ⏳ owner      |                                                       |
| Library timeline: sticky month headers, capture-local dates, adaptive columns                 | ✅          | ✅ (timeline domain, screen)           | ⏳ owner      | Sticky header blur over scrolling grid needs a device |
| Category screen, cross-group selection summary                                                | ✅          | ✅                                     | ⏳ owner      |                                                       |
| Press/selection motion + haptics                                                              | ✅          | ✅ (state only)                        | ⏳ owner      | Feel can't be verified off-device                     |
| `@expo/ui` Settings controls in Expo Go                                                       | ✅          | ✅ (types)                             | ⏳ owner      | Risk R7                                               |
| Real photo access, scanning, exports, removal                                                 | ❌          | —                                      | —             | Phases 2–3                                            |

**Demo-only paths:** `src/demo/` (sample library, hand-authored sample findings, simulated scan runner) and `src/state/clean-session.ts` (sample results and sample jobs are session-only, never persisted). Every surface showing them says "Sample".

## Next actionable tasks

1. **P1-DEV-001 (owner)**: run the app on your iPhone and do the smoke test in [docs/TEST_PLAN.md §4](docs/TEST_PLAN.md#4-device-checks-owner-physical-iphone), plus: Clean → **Run sample scan** → switch to Library while it runs (job bar stays above the tabs) → tap the bar (sheet opens; drag between half and full) → Pause/Resume → let it finish (one success tick) → open categories and select across groups → touch and hold a photo (Keep this one instead / Protect) → Skip a group and Undo → go back to Clean (total updates) and return (choices kept) → **Compare** on a group: swipe photos, pinch to zoom, try Side by side, Mark for review, Next group → **Review plan** (from a category or the Clean home): check it lists exactly what you marked and keeps each group’s keeper. Try **Stop scan** midway too: you should get partial results. Report iPhone model, iOS version, Expo Go version and anything that looks or feels off.
2. **Design checkpoint (owner, P1-REV-003)**: walk one full flow on the iPhone (scan → category → Compare → mark/keep/protect → Next group → back) and tell me what to change in look, motion or wording. This is the one sign-off Phase 1 asks for.
3. **P1-LIB-003 → P1-LIB-005**: photo viewer with tile-to-viewer continuity, pinch/pan/double-tap and drag-to-dismiss, scroll and selection restoration.
4. **P1-ONB-001 → P1-ONB-003**: onboarding and access explainer.

## Blockers / owner input

- Device facts still unknown (A1): iPhone model, iOS version, Expo Go SDK.
- The GitHub repo is **public** (checked 2026-10-02). Make it private in GitHub → Settings → General → Danger Zone unless you intend to publish the code (A4).
- Not needed until Phase 3: Apple Developer Program decision, bundle identifier.
