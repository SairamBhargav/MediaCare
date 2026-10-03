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

## What only a device can confirm

Real photo access prompts and limited selection; scan speed and smoothness on your library size; HEIC thumbnails and orientation; copy sizes and what metadata a copy keeps; how Expo Go handles all of this. Nothing here is reported as tested until you run it.

## Real-photo test (owner)

1. `npm start`, open in Expo Go on the iPhone.
2. Clean → **Scan my library**. Choose **Allow Full Access** (or try **Limit Access** to test limited mode). Watch the job bar; try Pause/Resume, switch tabs while it runs.
3. Look at the findings: **Taken moments apart**, **Screenshots**, **Long videos**. Open one, Compare, mark a few, open **Review plan** (Remove stays disabled).
4. Library → tap a photo → **Make a smaller copy** → Target size 1 MB → Make copy → **Save to Photos**. Check the new photo in the Photos app and that the original is unchanged.
5. Settings → Developer → **Diagnostics** → Run file check and Run copy check → **Share report** and send it to me.
6. Report: iPhone model, iOS version, library size roughly, scan time, anything wrong.

## Next actionable tasks

1. **Owner**: real-photo test above plus the Phase 1 design checkpoint.
2. Fix whatever the device test finds (expected: some layout and iOS-behavior surprises).
3. Remaining Phase 1 polish: viewer drag-to-dismiss (P1-LIB-004), onboarding (P1-ONB-001..003), home reveal (P1-MOT-001), Increase Contrast palette (P1-UI-006), accessibility pass (P1-QA-001).
4. **Phase 3 decision (owner)**: Apple Developer Program membership for a development build. Exact duplicates, blur detection and removal need native code that Expo Go can't load.

## Blockers / owner input

- Device facts unknown (A1): iPhone model, iOS version, Expo Go version.
- The GitHub repo is **public** (checked 2026-10-02). Make it private unless you intend to publish (A4).
- Phase 3 needs the Apple Developer decision and a bundle identifier.

## Notes

- In Expo Go, photo permission is granted to Expo Go (Settings → Expo Go → Photos), not "MediaCare".
- Windows typed-routes quirk: if `npm run typecheck` complains about routes like `/../state/...` while `npm start` runs, restart `npm start` (see docs/SETUP_WINDOWS.md).
