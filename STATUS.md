# Status

**Current phase:** 0 complete → starting Phase 1
**Last updated:** 2026-10-02

## Completed (Phase 0)

P0-REPO-001 · P0-UI-001 · P0-UI-002 · P0-NAV-001 · P0-MOT-001 (device check pending) · P0-DOM-001 · P0-DOM-002 · P0-CI-001 · P0-DOC-001. Details in [docs/BACKLOG.md](docs/BACKLOG.md).

## Checks actually run (Windows 11, Node 22.23.3, npm 10.9.9, 2026-10-02)

| Check                            | Result                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `npm run typecheck`              | ✅ pass                                                                         |
| `npm run lint`                   | ✅ pass (0 problems)                                                            |
| `npm run format:check`           | ✅ pass                                                                         |
| `npm test`                       | ✅ 58/58 tests, 4 suites                                                        |
| `npx expo-doctor`                | ✅ 21/21 checks                                                                 |
| `npx expo export --platform ios` | ✅ iOS Hermes bundle built (3.8 MB)                                             |
| Physical iPhone in Expo Go       | ❌ **not yet run**: owner action (P1-DEV-001)                                   |
| GitHub Actions CI                | First run failed at Expo Doctor (script not on PATH); fixed in follow-up commit |

## Implemented vs. evidence

| Item                                          | Implemented | Automated checks | Device-tested | Notes                             |
| --------------------------------------------- | ----------- | ---------------- | ------------- | --------------------------------- |
| Tabs, Settings sheet, gallery                 | ✅          | ✅               | ⏳ owner      |                                   |
| Press/selection motion + haptics              | ✅          | ✅ (state only)  | ⏳ owner      | Feel can't be verified off-device |
| Reduce Motion / Transparency handling         | ✅          | ✅ (compiles)    | ⏳ owner      |                                   |
| `@expo/ui` Settings controls in Expo Go       | ✅          | ✅ (types)       | ⏳ owner      | Risk R7                           |
| Real photo access, scanning, exports, removal | ❌          | —                | —             | Phases 2–3                        |

**Demo-only paths:** everything in `src/demo/` and every screen's photo content. All are labelled "Sample".

## Next actionable tasks

1. **P1-DEV-001 (owner)**: Run the app on your iPhone: `npm start`, scan the QR. Do the Phase 0 smoke test in [docs/TEST_PLAN.md §4](docs/TEST_PLAN.md#4-device-checks-owner-physical-iphone). Report iPhone model, iOS version, Expo Go version, anything broken, and a short recording of the selection interaction.
2. **P1-SET-002**: Persist preferences with `expo-sqlite/kv-store`.
3. **P1-CLN-001**: Clean home sample categories with all states.
4. **P1-JOB-001 → P1-JOB-002**: Job model, labelled sample scan, compact job bar + detail sheet.
5. **P1-REV-001 → P1-REV-003**: Group review and compare, then the **design checkpoint** with the owner.
6. **P1-LIB-001 → P1-LIB-004**: Sectioned timeline, adaptive columns, viewer and gestures.

## Blockers / owner input

- Device facts unknown (assumption A1): iPhone model, iOS version, Expo Go SDK.
- The GitHub repo is **public** (checked 2026-10-02). Make it private in GitHub → Settings → General → Danger Zone unless you intend to publish the code (A4).
- Not needed until Phase 3: Apple Developer Program decision, bundle identifier.
