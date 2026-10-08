# Status

**Current phase:** Phase 1 polish and P2-DUP-001 Find exact copies done in code; awaiting the owner's device test
**Last updated:** 2026-10-03

## Completed

- **Phase 0**: all tasks (device check pending).
- **Phase 1**: P1-SET-002, P1-CLN-001, P1-JOB-001, P1-JOB-002, P1-REV-001, P1-REV-002, P1-REV-003 (design checkpoint pending), P1-REV-004, P1-LIB-001..005, P1-ONB-001..003, P1-MOT-001, P1-UI-006, P1-UI-008, P1-UI-009, P1-QA-001 (automated part; device walkthrough pending). P1-UI-007 skipped (optional; licensing).
- **Phase 2**: P2-DUP-001 (awaiting device), P2-MEDIA-001/002/003/004/006, P2-DB-001..004, P2-JOB-001..003, P2-LIB-001, P2-EXP-001..007, P2-FIND-001, P2-UI-001, P2-DIAG-001. Spike S1 answered from source (needs dev build). Details in [docs/BACKLOG.md](docs/BACKLOG.md).

## Checks actually run (Windows 11, Node 22.23.3, 2026-10-03, after Phase 1 polish)

| Check                  | Result                                      |
| ---------------------- | ------------------------------------------- |
| `npm run typecheck`    | ✅ pass (`.expo/types` set aside, as in CI) |
| `npm run lint`         | ✅ pass                                     |
| `npm run format:check` | ✅ pass                                     |
| `npm test`             | ✅ 346/346 tests                            |
| `npm run doctor`       | ✅ 21/21                                    |
| `npm run bundle:ios`   | ✅ iOS Hermes bundle (4.3 MB)               |
| Physical iPhone        | ⏳ not run yet                              |

## Device test 1 (owner, 2026-10-03)

iPhone 17 · iOS 26.6.2 · Expo Go SDK 57 · limited access, 25 items. Scan, Library and thumbnails work (after fix P2-FIX-001). Compare failed with "page could not be found" (fixed: P2-FIX-002). Diagnostics are recorded in docs/CAPABILITIES.md under "Device evidence 1".

## What only a device can confirm

Real photo access prompts and limited selection; scan speed and smoothness on your library size; HEIC thumbnails and orientation; copy sizes and what metadata a copy keeps; how Expo Go handles all of this. Nothing here is reported as tested until you run it.

## Phase 1 polish: iPhone checklist (awaiting owner test)

1. **First run**: Settings → Help → Show introduction again. The sample tiles settle in about a second with a "Keep" mark; both buttons work at once. "Explore with samples" closes it. Do it again and tap **Continue**: if iOS hasn't asked about photos yet, the access explanation appears and the iOS prompt only shows after **Continue** there. (In Expo Go, access was probably granted already, so you'll see current access and "Change in iOS Settings" instead.)
2. **Home reveal**: force-quit and reopen. The Clean cards fade up in turn, once. Switch tabs and come back: no replay. With Settings → Less motion on, nothing animates.
3. **Viewer**: Library → tap a photo. It grows out of its tile and the tile looks empty underneath. Pinch, pan when zoomed, double-tap to zoom in and out. Drag down slowly a little and let go: it springs back. Drag further or flick: it shrinks back into its tile. **Close** does the same. **Info** shows date source, dimensions, size, source and file. With Less motion on, it fades instead.
4. **Library keeps its place**: scroll far down, tap Select, pick 3 photos, switch to Clean and back: same position, still selecting, "3 selected".
5. **Increase Contrast** (iOS Settings → Accessibility → Display & Text Size): secondary text and lines get stronger in both themes.
6. **Gallery** (Settings → Developer): theme chips, job bar states, sample scan sheet, chips, before/after placeholder.
7. **Accessibility walkthrough**: docs/TEST_PLAN.md §4, "Phase 1 accessibility pass".

## Find exact copies: iPhone checklist (awaiting owner test)

1. Clean → (with your library scanned) the **Exact copies** card → **Find exact copies**. The job bar says "Exact copies" with "Fingerprinting files · x of y". Try Pause, Resume, and switching tabs.
2. To create a real exact copy: in Photos, save the same image twice (e.g. save one image from Messages twice), or Duplicate a photo. Scan again on Clean, then **Check again**. Expect a set in **Exact copies**, with a keeper and Remove still disabled. Note whether Photos' Duplicate produces identical files; that's useful evidence either way.
3. The card lists what wasn't checked and why (Live Photos, iCloud only, edited, videos). Check the numbers look plausible for your library.
4. Stop partway, then **Continue checking**: it should pick up quickly.
5. Settings → Developer → Diagnostics: crop a photo in Photos, Scan again, then run **Edited photo check** and **Live Photo check** → Share report → send it to me.
6. Report how long the check took and for how many photos.

## Real-photo test (owner)

1. `npm start`, open in Expo Go on the iPhone.
2. Clean → **Scan my library**. Choose **Allow Full Access** (or try **Limit Access** to test limited mode). Watch the job bar; try Pause/Resume, switch tabs while it runs.
3. Look at the findings: **Taken moments apart**, **Screenshots**, **Long videos**. Open one, Compare, mark a few, open **Review plan** (Remove stays disabled).
4. Library → tap a photo → **Make a smaller copy** → Target size 1 MB → Make copy → **Save to Photos**. Check the new photo in the Photos app and that the original is unchanged.
5. Settings → Developer → **Diagnostics** → Run file check and Run copy check → **Share report** and send it to me.
6. Report: iPhone model, iOS version, library size roughly, scan time, anything wrong.

## Next actionable tasks (agreed with owner, 2026-10-03)

Device test 1 is done: scan, Library, thumbnails and Compare work (after fixes P2-FIX-001/002); copies keep orientation but not date or location (S5). Work in this order:

1. ✅ **Finish Phase 1 polish** (done in code 2026-10-03; device checklist above):
   - P1-LIB-003/004: viewer continuity from the tapped tile (measured overlay, no experimental shared-element API) and drag-to-dismiss with a velocity-or-distance threshold, plus a visible Close button
   - P1-LIB-005: keep Library scroll position and selection across tab switches
   - P1-ONB-001..003: value intro, access explainer before the iOS prompt, first-run flag persisted in the kv-store, reachable again from Settings
   - P1-MOT-001: home reveal stagger (once per session, at most 4 groups, skipped under reduced motion)
   - P1-UI-006: Increase Contrast palette, covered by the contrast tests
   - P1-UI-008: prune unused template deps (expo-glass-effect, expo-device, expo-web-browser) if still unused; doctor and bundle must pass
   - P1-UI-009: gallery completion (job bar states, sheets, chips)
   - P1-QA-001: accessibility pass (labels, roles, largest Dynamic Type, Reduce Motion, Reduce Transparency)
   - P1-UI-007 (licensed fixture photos) is optional; skip if licensing is uncertain
2. ✅ **P2-DUP-001 "Find exact copies"** (done in code 2026-10-03; checklist above): a separate, user-started, pausable job (about 50 ms per photo measured on iPhone 17, so roughly 8 minutes for 10,000 photos).
   - Eligible only: not a Live Photo; `getIsInCloud()` false (so nothing downloads); the `getUri()` file proves it is the camera original (path under `DCIM`, file name matches the catalog filename). Everything else is reported as "not checked" with the reason.
   - Hash with `File.info({ md5: true })`; only compare files of equal byte size; confirm candidates with a second, stronger check (SHA-256 via expo-crypto if it works in Expo Go SDK 57, otherwise full byte comparison) before calling them exact copies.
   - Persist fingerprints in a new migration with representation, algorithm, implementation version and the asset's modification time; invalidate on change.
   - Results feed the existing "exact" category and review flow. Keeper rule, protection, favorites-never-suggested and the disabled Remove button all stay.
   - Add Diagnostics checks for an **edited** photo and a **Live Photo** to gather evidence before widening eligibility.
3. **Owner**: Phase 1 design checkpoint; Phase 3 decision (Apple Developer Program) when ready. Removal, blur detection and metadata-preserving copies need native code.

## Blockers / owner input

- The GitHub repo is **public** (checked 2026-10-02). Make it private unless you intend to publish (A4).
- **Decided 2026-10-03: the owner is enrolling in the Apple Developer Program** (so face/eye analysis, similarity and blur can use Apple Vision, and the owner's dad can test via TestFlight). Still needed from the owner: membership approved, a bundle identifier (e.g. `com.<name>.mediacare`), and a go-ahead before the first EAS build.
- Both libraries are real and personal (the owner's and the dad's); test photos are used for testing, never treated as disposable. Removal stays disabled in every build until it is proven only on test photos the owner deliberately creates for that purpose (e.g. screenshots taken for the test), with the owner's explicit go-ahead each time. **Apple Developer membership active (2026-10-03); bundle ID `com.bhargav.mediacare` registered and set in app.json.** EAS project linked (@bhargavsairam/mediacare) and expo-dev-client added. Next (owner, interactive): `npx eas-cli@latest device:create` to register the iPhone, then `npx eas-cli@latest build --profile development --platform ios` (asks for the Apple login; uses one build credit).

## Notes

- In Expo Go, photo permission is granted to Expo Go (Settings → Expo Go → Photos), not "MediaCare".
- Windows typed-routes quirk: if `npm run typecheck` complains about routes like `/../state/...` while `npm start` runs, restart `npm start` (see docs/SETUP_WINDOWS.md).

## Owner decision, 2026-10-07 (revised)

Build a feature-rich app before spending builds: the testers would rather have many features than an early thin build. Native work (Apple Vision: similarity, blur, exposure, faces/eyes, keeper; then Phase 4 native pieces) is batched so one EAS build compiles it all. Sequence: features on main, then one development build for the owner's iPhone (device:create + development profile) to compile and test, then a production build with --auto-submit to TestFlight for the owner and his dad. Removal stays disabled. No build starts without the owner's go-ahead.

## Phase 3/4 progress, 2026-10-07

Written and tested on Windows (375 tests, doctor 21/21, iOS bundle): native module (Vision analysis + Enhance/red-eye/background tools), similar shots by look with keeper reasons, blur / eyes-closed / exposure flags, pausable photo check with storage (migration 3), Edit tools in the viewer, Diagnostics → Vision check. **Not compiled yet**: the Swift compiles only in an EAS build.

Next (owner): `npx eas-cli@latest device:create`, then `npx eas-cli@latest build --profile development --platform ios`; install; `npm run start:dev-client`. Then run Diagnostics → Vision check and share it so thresholds can be tuned; after that, a production build to TestFlight for the owner and his dad.
