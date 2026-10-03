# Status

**Current phase:** 2 (real photos) built; awaiting the owner's device test before Phase 3
**Last updated:** 2026-10-03

## Completed

- **Phase 0**: all tasks (device check pending).
- **Phase 1**: P1-SET-002, P1-CLN-001, P1-JOB-001, P1-JOB-002, P1-REV-001, P1-REV-002, P1-REV-003 (design checkpoint pending), P1-REV-004, P1-LIB-001, P1-LIB-002.
- **Phase 2**: P2-MEDIA-001/002/003/004/006, P2-DB-001..004, P2-JOB-001..003, P2-LIB-001, P2-EXP-001..007, P2-FIND-001, P2-UI-001, P2-DIAG-001. Spike S1 answered from source (needs dev build). Details in [docs/BACKLOG.md](docs/BACKLOG.md).

## Checks actually run (Windows 11, Node 22.23.3, 2026-10-03)

| Check                  | Result                                      |
| ---------------------- | ------------------------------------------- |
| `npm run typecheck`    | ✅ pass (`.expo/types` set aside, as in CI) |
| `npm run lint`         | ✅ pass                                     |
| `npm run format:check` | ✅ pass                                     |
| `npm test`             | ✅ 185/185 tests                            |
| `npm run doctor`       | ✅ 21/21                                    |
| `npm run bundle:ios`   | ✅ iOS Hermes bundle (4.3 MB)               |
| Physical iPhone        | ⏳ not run yet                              |

## Device test 1 (owner, 2026-10-03)

iPhone 17 · iOS 26.6.2 · Expo Go SDK 57 · limited access, 25 items. Scan, Library and thumbnails work (after fix P2-FIX-001). Compare failed with "page could not be found" (fixed: P2-FIX-002). Diagnostics are recorded in docs/CAPABILITIES.md under "Device evidence 1".

## What only a device can confirm

Real photo access prompts and limited selection; scan speed and smoothness on your library size; HEIC thumbnails and orientation; copy sizes and what metadata a copy keeps; how Expo Go handles all of this. Nothing here is reported as tested until you run it.

## Real-photo test (owner)

1. `npm start`, open in Expo Go on the iPhone.
2. Clean → **Scan my library**. Choose **Allow Full Access** (or try **Limit Access** to test limited mode). Watch the job bar; try Pause/Resume, switch tabs while it runs.
3. Look at the findings: **Taken moments apart**, **Screenshots**, **Long videos**. Open one, Compare, mark a few, open **Review plan** (Remove stays disabled).
4. Library → tap a photo → **Make a smaller copy** → Target size 1 MB → Make copy → **Save to Photos**. Check the new photo in the Photos app and that the original is unchanged.
5. Settings → Developer → **Diagnostics** → Run file check and Run copy check → **Share report** and send it to me.
6. Report: iPhone model, iOS version, library size roughly, scan time, anything wrong.

## Next actionable tasks (agreed with owner, 2026-10-03)

Device test 1 is done: scan, Library, thumbnails and Compare work (after fixes P2-FIX-001/002); copies keep orientation but not date or location (S5). Work in this order:

1. **Finish Phase 1 polish**, each with tests and a device-checklist line:
   - P1-LIB-003/004: viewer continuity from the tapped tile (measured overlay, no experimental shared-element API) and drag-to-dismiss with a velocity-or-distance threshold, plus a visible Close button
   - P1-LIB-005: keep Library scroll position and selection across tab switches
   - P1-ONB-001..003: value intro, access explainer before the iOS prompt, first-run flag persisted in the kv-store, reachable again from Settings
   - P1-MOT-001: home reveal stagger (once per session, at most 4 groups, skipped under reduced motion)
   - P1-UI-006: Increase Contrast palette, covered by the contrast tests
   - P1-UI-008: prune unused template deps (expo-glass-effect, expo-device, expo-web-browser) if still unused; doctor and bundle must pass
   - P1-UI-009: gallery completion (job bar states, sheets, chips)
   - P1-QA-001: accessibility pass (labels, roles, largest Dynamic Type, Reduce Motion, Reduce Transparency)
   - P1-UI-007 (licensed fixture photos) is optional; skip if licensing is uncertain
2. **Then P2-DUP-001 "Find exact copies"**: a separate, user-started, pausable job (about 50 ms per photo measured on iPhone 17, so roughly 8 minutes for 10,000 photos).
   - Eligible only: not a Live Photo; `getIsInCloud()` false (so nothing downloads); the `getUri()` file proves it is the camera original (path under `DCIM`, file name matches the catalog filename). Everything else is reported as "not checked" with the reason.
   - Hash with `File.info({ md5: true })`; only compare files of equal byte size; confirm candidates with a second, stronger check (SHA-256 via expo-crypto if it works in Expo Go SDK 57, otherwise full byte comparison) before calling them exact copies.
   - Persist fingerprints in a new migration with representation, algorithm, implementation version and the asset's modification time; invalidate on change.
   - Results feed the existing "exact" category and review flow. Keeper rule, protection, favorites-never-suggested and the disabled Remove button all stay.
   - Add Diagnostics checks for an **edited** photo and a **Live Photo** to gather evidence before widening eligibility.
3. **Owner**: Phase 1 design checkpoint; Phase 3 decision (Apple Developer Program) when ready. Removal, blur detection and metadata-preserving copies need native code.

## Blockers / owner input

- The GitHub repo is **public** (checked 2026-10-02). Make it private unless you intend to publish (A4).
- Phase 3 needs the Apple Developer decision and a bundle identifier.

## Notes

- In Expo Go, photo permission is granted to Expo Go (Settings → Expo Go → Photos), not "MediaCare".
- Windows typed-routes quirk: if `npm run typecheck` complains about routes like `/../state/...` while `npm start` runs, restart `npm start` (see docs/SETUP_WINDOWS.md).
