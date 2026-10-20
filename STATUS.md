# Status

**Current phase:** All main features done in code (Phases 3–6 slice, native v3); next is one development build to compile and test them, then a production build to TestFlight for the owner and his dad
**Last updated:** 2026-10-19

## Session 2026-10-19: opt-in iCloud checking (P3-ICL-001)

Dad's feedback: on his iPhone (Optimize iPhone Storage on) 8,667 of ~13,200 items were "Stored in iCloud only" and never scanned, however often he checked. Cause: every check read with network off by design. Owner decision: opt-in iCloud for both checks at once, Wi-Fi only with a mobile-data option (ADR-0009). This is ahead of the audit plan order by owner request.

Done in code: Settings → iCloud Photos (switch with confirmation, "Also use mobile data"); both checks retry iCloud-only photos last in small batches, re-checking connection, Low Data, Low Power and the switch before every batch, and stop with a stated reason; job line "Getting photos from iCloud · n of m"; Clean cards explain the iCloud count and link to Settings. Native: `CloudAccess.swift` (`networkState`), `analyzeFromCloud`, `hashOriginalsFromCloud`, time limits per photo, `cloudVersion` 1 (analysis `version` unchanged, so no results are redone).

Checks: `npm run check` ✅ (53 suites, 488 tests), `npm run bundle:ios` ✅ 4.6 MB. Doctor not rerun (no dependency or config change). Swift **not compiled** yet: needs a new EAS build (not started; owner's go-ahead needed). Device behaviour **awaiting owner test**: data per photo, speed, whether Photos keeps downloaded originals.

Then (same day, P3-BG-001, ADR-0010): checks continue in the background on iOS 26 as a continued-processing task (Live Activity with progress and stop) and send a local notification when done, stopped or failed. Native `BackgroundRun.swift`; app.json gains `BGTaskSchedulerPermittedIdentifiers` and `UIBackgroundModes: processing`. Checks after this: `npm run check` ✅ (54 suites, 490 tests), `npm run bundle:ios` ✅ 4.6 MB, `npm run doctor` 20/21: nine Expo packages are one patch behind (new SDK 57 patches, not caused by this change); run `npx expo install --fix` before the next build.

Then (same day, P4-PPL-001..005, ADR-0011): **People**. Owner chose to combine Apple Vision with a dedicated face model. Native `FaceTools.swift` (Vision landmarks, OpenCV 5-point alignment, Apple + optional SFace fingerprints), migration 7, grouping in `src/domain/people.ts` (tested), "Finding people" step in the photo check, People row in Library, People and person screens (rename, merge, hide, Not <name>). PRD non-goal narrowed. SFace itself isn't in the repo yet: run Actions → **Face model** (P4-PPL-006), confirm the model, then commit `SFace.mlmodelc` into `modules/media-analysis/ios/models/`. Without it, People uses Apple's fingerprint only (strict). Checks: `npm run check` ✅ (56 suites, 504 tests), bundle ✅ 4.7 MB, doctor 20/21 (same patch-version item). All People behaviour **awaiting build and owner test**.

Also logged from the same feedback: P4-ICL-003 (Studio on iCloud photos), P4-CUT-001 (tap to pick one person in Remove background), P4-PPL-001 (people by name: blocked, PRD non-goal; Photos → People & Pets does this today).

## First TestFlight build (2026-10-09)

Owner ran `eas build --platform ios --profile production --auto-submit` (checks 472 tests, doctor 21/21 beforehand). Version 0.2.0 build 2 is processed in App Store Connect (app id 6818920566), internal group "Team (Expo)" with the owner invited. EAS manages the distribution certificate, App Store profile and an APP_MANAGER App Store Connect API key. Removal hidden in this build (ADR-0008). Next (owner): install via TestFlight, compare smoothness with the dev build (feeds P3-PERF-002), add dad as an internal tester, check the app icon. Release-build behaviour **awaiting owner test**.

## Session 2026-10-09 (second PC set up; features, UI rework, release prep)

New Windows PC set up: Node 24.21, `npm ci`, all checks pass. Owner decisions: all remaining main features today (activity, date jump, edits, collage, video, slideshow, passport fine-tuning, Studio hub); **dev build first, then production → TestFlight**; dad as an **internal** tester; UI rework of **Clean home** and an overall **dad-friendly** pass.

Done in code (450 tests, doctor 21/21, iOS bundle 4.6 MB), see CHANGELOG 0.2.0:

- Studio hub + picker; Adjust; Collage; Slideshow; Video trim/smaller copy and playback; Large videos from measured sizes (migration 6); passport fine-tuning; Activity; Library Jump to.
- Clean: one "Check my photos" button (photo check, then exact copies), prioritized findings list. Settings: Bigger text, Activity.
- Release builds can't remove photos (ADR-0008); permission strings and privacy manifest updated; version 0.2.0.
- Deferred with reason: blur restoration and object removal (no reliable on-device model; P5-ENH/P5-INP).

**Not compiled yet**: native v3 Swift (`Creations.swift`, `VideoTools.swift`, module registrations). Everything native is "awaiting build", nothing here is device-tested.

### Next (owner, interactive; each build uses one EAS credit)

1. `npx eas-cli@latest login` (once on this PC).
2. `npx eas-cli@latest build --profile development --platform ios` → install → `npx expo start --dev-client --clear`.
3. Test the "What to test" list in docs/SETUP_WINDOWS.md Stage 3, plus: Adjust turn direction and warmth direction; a slideshow of ~10 photos; trim a video with "Start here"; Large videos after Check my photos. Report anything wrong (and the EAS log link if the build fails).
4. When it's good: `npx eas-cli@latest build --profile production --platform ios --auto-submit`, then add dad as an internal tester (SETUP_WINDOWS.md Stage 3).

## Completed

- **Phase 0**: all tasks (device check pending).
- **Phase 1**: P1-SET-002, P1-CLN-001, P1-JOB-001, P1-JOB-002, P1-REV-001, P1-REV-002, P1-REV-003 (design checkpoint pending), P1-REV-004, P1-LIB-001..005, P1-ONB-001..003, P1-MOT-001, P1-UI-006, P1-UI-008, P1-UI-009, P1-QA-001 (automated part; device walkthrough pending). P1-UI-007 skipped (optional; licensing).
- **Phase 2**: P2-DUP-001 (awaiting device), P2-MEDIA-001/002/003/004/006, P2-DB-001..004, P2-JOB-001..003, P2-LIB-001, P2-EXP-001..007, P2-FIND-001, P2-UI-001, P2-DIAG-001. Spike S1 answered from source (needs dev build). Details in [docs/BACKLOG.md](docs/BACKLOG.md).

## Checks actually run (Windows 11, Node 24.21.0, 2026-10-09, after native v3 and UI rework)

| Check                  | Result                                     |
| ---------------------- | ------------------------------------------ |
| `npm run typecheck`    | ✅ pass                                    |
| `npm run lint`         | ✅ pass                                    |
| `npm run format:check` | ✅ pass                                    |
| `npm test`             | ✅ 450/450 tests                           |
| `npm run doctor`       | ✅ 21/21                                   |
| `npm run bundle:ios`   | ✅ iOS Hermes bundle (4.6 MB)              |
| Swift (native v3)      | ⏳ compiles only in an EAS build           |
| Physical iPhone        | ⏳ awaiting owner test after the dev build |

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
3. Look at the findings: **Possible repeats**, **Screenshots**, **Long videos**. Open one, Compare, mark a few, open **Review plan** (Remove stays disabled).
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

## First development build, 2026-10-07

EAS development build (free tier) compiled the MediaAnalysis native module on the first attempt; installed on the owner's iPhone 17 with Developer Mode; the app runs from `npm run start:dev-client`. Feature checks on device: awaiting owner test (Look at my photos, Edit tools, Diagnostics → Vision check).

## Device evidence 2 (owner, 2026-10-08, iPhone 17, development build)

Photo check: 804 photos in about 1 minute; Vision check 78 ms per photo. Similar shots good about 85% of the time; dance photos (different poses, same studio) were grouped. Distances seen: repeat shot 0.18, same scene / different moment 0.42, different scenes 0.9–1.2. Fix (JS, no build): similar cut-off 0.45 → 0.30, complete linkage (no chaining), tuning readout in Compare (development builds). Next native build adds a body-pose and layout check.

## Progress 2026-10-08 (after device evidence 2)

Done in code (408 tests, doctor 21/21, iOS bundle):

- Safe removal (P3-DEL-001): off by default (Settings → Allow removing photos); revalidation, iOS confirmation, verified outcomes, migration 4. Works with the current build after a reload. Test only on purpose-made photos, with the owner's go-ahead.
- Passport photo, U.S. (P5-PASS-001): works with the current build after a reload.
- Native v2 (needs the next build): body pose + layout checks for similar shots (P3-SIM-002), exact copies for edited and Live Photos via SHA-256 of every Photos resource (P3-DUP-002). Stored analysis carries the native version, so results are redone after updating.

Next: owner decides between building now (compile native v2 early) or after Studio hub (P5) and video (P6).

## Next session (handoff, 2026-10-08)

- The dev build is on the owner's iPhone and loads after `npx expo start --dev-client --clear` (a plain restart left stale code after the package updates).
- Owner to test with a reload: safe removal (on purpose-made screenshots only, after turning on Settings → Allow removing photos) and Passport photo (U.S.).
- Decision pending: next EAS development build now (compiles native v2: pose/layout, exact copies for edited and Live Photos) or after Studio hub (P5) and video (P6).
- Then: re-run "Look at my photos" after the new build; tune thresholds from Compare's tuning line; production build → TestFlight for the owner and his dad.

## Latest session — 2026-10-09: repository audit and stabilization plan

This entry supersedes earlier next-step instructions: Phase 3 performance/safety stabilization is the next gate. P3-AUD-001 is complete (audit/documentation only); fixes remain planned.

Owner reports tap/view-opening lag in the installed development build with fewer than 1,000 photos. Direction: calm, Photos-like, dad-friendly; full deep scan each fresh launch; then browsing, albums/favorites/date/type, people/subject/text search, editing and creations. Tab swipe preference remains open; preserve current behavior until decided.

Read [the 26-finding audit](docs/REPO_AUDIT_2026-10-09.md) and [the 21-task implementation plan](docs/AUDIT_IMPLEMENTATION_PLAN.md). Start with P3-PERF-002 (interaction profiling), P3-SAFE-001/002 (protection and honest removal outcomes), then P3-JOB-004 (awaited cancellation). Add automatic launch scanning after responsiveness/lifecycle foundations.

Source findings include protection-store divergence, lookup errors counted as removed, clear-data/write races and quadratic grouping. ADR-0008 removal gate stays. No app behavior, dependency, native build or removal changed in this audit.

Evidence: npm run check passed (52 suites, 472 tests). npm audit: 66 affected package entries, 49 high / 17 moderate / 0 critical, including inherited tooling warnings. Synthetic 1,000-photo grouping: 499,500 comparisons, 745 ms on Windows Node/V8, not an iPhone timing. Native/device validation remains awaiting owner test. Doctor/bundle not rerun for documentation-only changes. No cloud build authorized.
