# Repository audit: smoothness, UX, correctness and privacy

Date: 2026-10-09. Task: P3-AUD-001. Baseline commit: 4ae077a (working tree initially clean).
Scope: Expo SDK 57 / React Native 0.86.3, installed MediaCare development build, iPhone first.
This is an audit and plan, not an implementation of the fixes.

## Owner context and direction

The owner reports a usable but noticeably unsmooth app, especially button taps and opening views, with fewer than 1,000 photos in the installed development build. The desired feel is calm, simple and Photos-like, usable by the owner's dad.

The owner wants a **full deep scan on every fresh launch**, then a photo manager covering browsing, organizing, editing and creations. Organization includes albums, favorites, date/type filters and search by people, subjects and text. A deep clean should find exact copies and similar moments and suggest keepers using clarity, eyes and other explainable measurements. Suggestions must never become automatic removal.

A full scan means actually rechecking accessible photos, not silently substituting an incremental scan. Schedule it behind the first interactive screen; keep previous results visible with their date until replaced. See the implementation plan for cold launch versus foreground semantics, consent, interruption and iCloud limits. Tab-swipe preference is still open; standard instant tabs are recommended, not yet an owner decision.

## Conclusion

Prioritize tap-to-feedback and screen-opening latency before adding more animation or adopting new libraries. Development overhead is a plausible contributor, but several implementation paths can independently block or overload the UI. Reanimated animations cannot make synchronous JavaScript computation disappear.

The most consequential correctness finding is protection state split between the viewer and review flow. Fix that, deletion outcome verification and job cancellation before enabling removal. ADR-0008 currently disables removal in release UI; preserve that restriction.

## Evidence and limits

- Read project status, roadmap, backlog, ADRs, motion and privacy rules.
- Traced routes, root bootstrap, custom tab navigator, common controls, library/picker/viewer, category/compare/plan, Studio/edit/export/video, stores, repositories/migrations, scan runners, native module and native tools, diagnostics, configuration and CI.
- Checked installed SDK source for thumbnail loading and compiler availability; consulted matching SDK docs.
- Ran npm run check: typecheck, lint, formatting and **52 suites / 472 tests passed**.
- Queried npm audit: **66 affected package entries: 49 high, 17 moderate, 0 critical**. These include transitive dependents, not 66 independently exploitable application flaws.
- Ran an in-memory synthetic benchmark of the actual similarSets implementation.
- No physical-device profiling, screenshots, VoiceOver walkthrough, native Swift compilation, deletion or EAS build was performed. UI recommendations come from source and owner feedback. Device-only acceptance is **awaiting owner test**.
- No comprehensive historical secret scan, network capture, cloud repository visibility check or Apple platform security review was performed. Historical STATUS notes that the repository was public; current visibility is unverified.

Severity: P0 = block enabling destructive functionality; P1 = next stabilization work; P2 = subsequent UX/scale/hardening. Confidence: confirmed = source behavior or reproduced computation; hypothesis = needs profiling. File line numbers refer to the audited baseline.

## Performance and interaction findings

### F01 — Press feedback still waits for JavaScript (P1, confirmed mechanism; impact unmeasured)

Evidence: src/components/pressable-scale.tsx:40–63 uses React state on press-in/out; the CSS animation then runs through Reanimated. Button actions and haptics also originate on the JS side.

When JS is busy, the visual acknowledgement can begin late. This fits the reported symptom but does not establish the cause of every slow tap. Measure touch → feedback → navigation start separately. Prototype UI-thread press feedback in the shared control, preserving accessibility activation, scrolling cancellation, disabled/loading states, long-press behavior and reduced motion. Do not add arbitrary delays around every router.push.

### F02 — Always-mounted tab pages and custom gesture lifecycle (P1, confirmed architecture; runtime cost unmeasured)

Evidence: src/components/pager-tabs.tsx:144–191 renders every route side by side, with a full-page horizontal pan. It has onEnd settling but no explicit finalization recovery for an interrupted active gesture. It does not consult the app's useReduceMotion preference for its settle spring.

Hidden Clean/Library trees retain subscriptions. Clean reads all review adjustments and builds the action plan; Library subscribes to every job update even when showing an existing library. These are candidates for work underneath another screen. The custom pager also owns horizontal gestures that could otherwise belong to shelves and future editing controls.

Recommend standard Expo Router tabs, lazily mounted with preserved session/scroll state, subject to the owner's swipe preference. If swipe stays: limit offscreen work, define interruption recovery, test taps during settling and VoiceOver focus, and honor in-app reduced motion. Update ADR-0002 and MOTION.md to match the chosen implementation. Do not remove swiping without resolving that decision.

### F03 — Large removal plans and large groups eagerly mount all thumbnails (P1, confirmed)

Evidence: src/screens/plan.tsx:93,147,174 uses ScrollView plus nested map calls; category/group-review.tsx:140 maps every member in one virtualized group row; review/thumb-strip.tsx:38 maps the whole group into a horizontal ScrollView.

Category virtualization is already present, but a single large group bypasses its benefit. Opening a plan can create hundreds of images and controls at once. Flatten the plan into bounded list rows, retain keeper context, and show a compact group preview with an explicit full-group view. Virtualize long thumbnail strips. Preserve reviewability of every marked asset; do not hide removal details behind an inaccessible summary.

### F04 — Similarity grouping can become quadratic on the JS thread (P1, reproduced)

Evidence: src/domain/visual-findings.ts:202–263. similarNeighbours only expires groups by their last member; a growing group compares each new photo against every previous member. This also means the comment promising at most 30 comparisons is inaccurate.

Synthetic stress test, Windows Node/V8, one run per size, 768-dimensional identical vectors, no faces/poses, increasing timestamps 1 ms apart:

| Photos | Actual featureDistance calls | Synchronous elapsed time |
| ------ | ---------------------------- | ------------------------ |
| 250    | 31,125                       | 48 ms                    |
| 500    | 124,750                      | 191 ms                   |
| 1,000  | 499,500                      | 745 ms                   |

Method: TypeScript transpiled in memory, similarSets executed in a VM context, featureDistance instrumented only with a call counter. Pair counts follow n(n-1)/2. These are synthetic worst-case timings, not iPhone benchmarks or the owner's actual distribution.

realFindings in src/state/clean-session.ts:157 runs grouping synchronously at startup/result restoration and after analysis/copy checks. Vector normalization and conversion also happen again in currentScores.

First make grouping cancellable and time-sliced, with genuine grouping progress. Cache versioned scores/results and avoid regrouping when only copy findings change. Evaluate bounded candidate discovery or a native worker later. Preserve complete-linkage safety: arbitrarily comparing fewer members can incorrectly join different poses and must not be presented as an equivalent optimization.

### F05 — Catalog hydration loads the entire analysis dataset (P1 at launch; P2 for larger libraries)

Evidence: src/state/catalog.ts:76 loads assets, fingerprints, all visual rows and sizes together. src/db/catalog-repo.ts:504 parses feature vectors, faces, poses and layouts from JSON for every row. All PhotoItems and maps are rebuilt on each load.

This contradicts the store comment suggesting only a few hundred bytes per item: visual vectors are also retained. Finish callbacks reload the whole dataset. Serve a lightweight first screen from summaries, fetch visible media pages, and load vectors only for analysis/grouping. Preserve stable item identity for unchanged assets. Use indexed SQL for counts and date queries; avoid an ORM migration without a demonstrated need.

### F06 — Progress and review changes fan out beyond the active control (P1, profiling required)

Evidence: screens/clean/index.tsx:54–63 computes coverage and subscribes to plan/adjustments; screens/library.tsx:59 subscribes to full job; review/index.tsx subscribes to the entire review store. Clean remains mounted while selections change elsewhere. Clean Results calculates several findings summaries.

Separate job progress from result content, subscribe only to visible status, and maintain narrow per-asset/per-group subscriptions and cached summaries. Measure render commits during one selection and one progress update.

**React Compiler is already enabled** in app.json, and babel-plugin-react-compiler is present through babel-preset-expo. Inline objects/callbacks and lack of manual memo are not by themselves proven bugs. Inspect compiler coverage and profiler output before adding useMemo/useCallback everywhere. Compiler memoization does not eliminate changed inputs, subscriptions, algorithms or excessive mounted views.

### F07 — Legacy exact-copy hashing can stall JS (P1 when that capability path is active)

Evidence: services/media/file-fingerprint.ts: fileMd5 uses synchronous File.info({ md5: true }); byte comparisons yield between 256 KB chunks. Newer native builds hash resources on a background queue, but Expo Go and older installed builds can take the synchronous fallback.

Record native version/hash method in performance reports. Prefer the existing native path where available; keep a truthful Expo Go fallback and schedule bounded work. A Promise wrapper around synchronous MD5 does not make hashing asynchronous. Full automatic scans must not repeatedly monopolize JS on the fallback path.

### F08 — Editing previews accumulate work and temporary files (P1, confirmed)

Evidence: screens/adjust.tsx:63–104. A 250 ms debounce starts native work; subsequent requests discard stale _results_ but do not cancel or serialize work. Every result URI is retained until leaving. A late completion after unmount escapes the cleanup pass. Reset invalidates requests but can leave working true when the old request's finally no longer matches.

Use one in-flight preview and one latest pending request, retain only the displayed and replacement preview, delete superseded/late outputs immediately, and invalidate the generation on unmount. Keep the old preview visible while updating. Native slider events currently update the whole screen; profile a smaller preview/controller boundary and commit policy.

### F09 — Thumbnail and compositing policy needs measurement (P2, source-confirmed capability)

MediaArtwork already uses expo-image and recyclingKey. Installed expo-image/ios/Loaders/PhotoLibraryAssetLoader.swift:94–124 requests a view-sized image when context permits, but sets isNetworkAccessAllowed = true. Browsing is therefore not guaranteed offline even though native analysis/hash jobs prohibit network. There are no explicit cloud/error states in MediaArtwork.

Add consistent loading/error/cloud placeholders; verify rapid reuse never shows the previous photo. Benchmark thumbnail fades, month-header blur and viewer overlay composition with real HEICs. Bound prefetching to nearby visible items. Do not assume a FlashList swap, permanent rasterization or disabling all motion is automatically faster.

## Safety, privacy and correctness findings

### F10 — Viewer protection is not authoritative in the removal plan (P0, confirmed source path)

Evidence: screens/photo.tsx:377–397 calls catalog.setProtected. state/catalog.ts:138 updates only catalog protection. useActionPlan and PlanScreen use review-session protection, seeded earlier. runRemoval receives that set without merging current catalog protection.

Reproduction to automate with mocked Photos: scan → mark a non-favorite photo in a finding → open that photo from Library → Protect → return to plan. The viewer can show Protected while the plan still contains it; in an enabled development session the stale protected set reaches revalidation.

Use one authoritative protection source and re-read it at the execution boundary. Optimistic persistence failures must be surfaced/rolled back, not silently lost on restart. Add a cross-screen integration regression. Release removal remains disabled.

### F11 — Removal verification confuses inaccessible with removed (P0, confirmed)

Evidence: services/media/removal.ts:109–122 catches any metadata/favorite lookup error and returns exists:false. After deletion, that is counted as removed. Permission changes or transient Photos errors are not proof of deletion. PlanScreen's generic failure wording can also assert that nothing was removed after a post-delete verification failure.

Introduce exists / missing / inaccessible-or-unknown outcomes. Recheck access, never count unknown as removed, preserve a durable submitted batch and reconcile later. Record outcomes reliably; multiple record failures are currently swallowed.

Also: run-removal.ts:27 constructs reviewedVersions from the current catalog at execution time, not an immutable review snapshot. Null versions compare equal in domain/removal.ts, and size/resource signatures are absent from this boundary. Capture reviewed source versions and representations when reviewed; reject unknown or changed evidence, and require fresh verification before exact-copy removal. The current behavior does not satisfy all written revalidation promises.

### F12 — Destructive policy is enforced only in the UI (P0 hardening, confirmed)

PlanScreen checks sample mode, preference and REMOVAL_IN_THIS_BUILD. runRemoval and deleteFromPhotos do not enforce the policy themselves.

Current inspection found no automatic deletion route; this is defense against future callers and stale UI state, not proof of a remote bypass. Move the release/sample/preference gate and an execution lock to the command boundary. Re-read protection immediately before submitting. Keep user confirmation and OS confirmation. Never use a performance test on personal photos as deletion evidence.

### F13 — Cancellation, reset and clear can race with in-flight jobs (P1, confirmed)

Scan runners expose done, but state/clean-session.ts reduces controls to pause/resume/cancel. cancel emits its terminal event immediately while a pending native request/database write can finish later. finish callbacks load/recompute without a session-generation check; reset clears state without awaiting drain. Settings then calls catalog.clear.

Consequences: a cleared catalog can be repopulated, stale results can replace newer state, concurrent scans can overlap, or checkpoint order can misreport status. markInterruptedScans also runs on every catalog.load rather than only startup recovery.

Add a single job coordinator with generation IDs, awaited cancellation/drain, serialized state publication and clear-data fencing. Recover interrupted work only at bootstrap. Mark completion only after grouping and result publication succeed. Handle rejected finish promises rather than attaching an unobserved finally.

### F14 — Clear data does not clear all sensitive app data (P1, confirmed)

catalog-repo.ts:278 deletes table rows; catalog.clear resets several stores. It does not remove native temporary outputs, image-manipulator outputs or image caches, and does not reset viewer/creation drafts. Settings accurately describes some catalog data, but PRIVACY_AND_SAFETY.md promises caches/temp cleanup as well.

Define app-owned storage directories and a retention/size budget, stop writers first, clear all related in-memory state, remove only owned files, and show failure/retry. Verify iOS data protection and backup policy for database/WAL/temp outputs; sandbox placement alone does not demonstrate those properties. SQL DELETE is logical cleanup, not a promise of forensic erasure.

### F15 — Permission changes and asset deletions leave stale findings (P1, confirmed)

catalog.refreshAccess changes only access. Watcher deletion updates items/byId but not findings, review selections, copySets or visual maps. Non-incremental changes merely request a future scan. Library decides whether to show real data based on items.length, not current access.

getMediaItem throws for missing IDs (features/media/registry.ts:19); category, compare and plan call it while rendering. Revoke limited access or delete a selected member externally and a subsequent render can fail.

Reconcile findings and review state atomically with accessible assets. Mask unavailable media promptly, use recoverable placeholders, block affected plans and allow rescan. Do not claim OS permission bypass: this is retained app data and stale state.

### F16 — Native movie waits can hang; outputs are insufficiently verified (P1, confirmed source defects; native execution untested)

VideoTools.swift:236 waits for writer readiness without cancellation or writer-status checks. Other semaphore waits have no deadline. Pool/allocation/append failures break the frame loop; completion can still be evaluated without verifying the intended frame count.

Video export reports dimensions from the source video track, not the encoded output, and can fall back to MOV while JS saves/shares it as MP4 (screens/video.tsx and components/movie-steps.tsx). Duration is derived from requested inputs rather than measured output.

Use cancellation-aware, bounded waits; abort and clean on frame failure. Reopen output and verify actual container, tracks, dimensions, duration and expected audio. Return actual MIME/UTI/container through the bridge. Awaiting compilation and owner playback/A-V sync tests.

### F17 — Movie completion after unmount can leak results (P1, confirmed)

features/studio/use-movie-task.ts:34–60 cancels on unmount and deletes only an already-known URI. A successful late promise can then create a new pending URI and set state with no remaining owner. Introduce request identity/mounted guards, delete late files, and make retries mutually exclusive. Apply the same lifecycle discipline to photo/export tools and failed saves.

### F18 — Export format and cloud consent are incomplete (P1, confirmed)

services/exports/exporter.ts always encodes JPEG without a source capability check. Transparent PNG, HDR/high bit-depth, animated and paired media need explicit handling rather than silently flattening. Native edit paths also need an output-fidelity audit.

isInCloud catches errors as false, and ExportScreen starts with cloud=false while the query is pending; a fast Make-copy tap can precede the download warning. Resolve cloud status or obtain explicit download consent before a network-capable source request. No upload-to-MediaCare was found; Apple iCloud fetching is a separate issue.

### F19 — Diagnostic reports disclose identifying metadata when shared (P2, confirmed)

features/diagnostics/device-checks.ts includes filenames, path suffixes and hashes; screens/diagnostics.tsx shares the report at the user's request. Settings hides its developer entry in release, but the route itself is registered and unguarded.

Add a redacted default report and a clearly described opt-in for full local details. Guard developer routes themselves if release access is undesired. This is user-triggered disclosure, not discovered automatic exfiltration.

### F20 — Known dependency advisories require targeted triage (P1)

npm audit returned five underlying advisory records propagated through 66 package entries:

| Package              | Registry severity | Likely relevant surface                                                                                                                                 |
| -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| braces               | High              | Build/test pattern processing; [advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)                                                            |
| decode-uri-component | Moderate          | query-string / Expo Router; malformed external links deserve runtime reachability review; [advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) |
| node-forge           | High              | Expo CLI / code-signing tooling; [advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv)                                                          |
| sprintf-js           | Moderate          | Test/tool argument formatting; [advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)                                                            |
| uuid                 | Moderate          | Xcode configuration tooling, specific buffer APIs; [advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq)                                        |

Installed decode-uri-component is 0.2.2 and query-string imports it. Exploitability in this application's bundled routing is not proven. npm's suggested fixes include Expo 44 and mismatched React Native/Reanimated versions: **do not run audit fix --force**. Resolve with SDK-compatible patches or a separately verified SDK upgrade, and distinguish shipped runtime from CI/development dependencies. Re-run doctor, bundle and checks for any dependency change.

Source searches found no app-owned fetch/axios upload path, eval usage or obvious tracked credential files among the searched patterns. SQL values are generally bound parameters. These are positive findings, not a certification that no secrets or vulnerabilities exist.

### F21 — Video-size failures can be cached indefinitely (P2, confirmed)

services/scan/visual-analysis-job.ts:90 schedules size measurement only when no row exists or the asset version changed. A failed or iCloud-only row is not retried when the same video becomes locally available. Retry failed/cloud rows under a clear policy and invalidate coverage by status, version and implementation.

### F22 — Error handling and duplicated orchestration hide recoverable failures (P2)

Silent catches occur for protection persistence, catalog load, history writes, sharing and clearing. Some are acceptable best-effort feedback (haptics), but safety state is not equivalent to a haptic failure. Classify expected absence/cancel separately from failed persistence and unknown outcomes. Use structured local errors with redaction, retry paths and durable operation IDs.

Consolidate job lifecycle and export ownership into small services instead of expanding clean-session.ts further. Validate decoded database/native data at boundaries; parseJson<T> is a cast, and pose/vector structures are not fully validated.

## UI and product changes

### F23 — The initial experience is not yet the requested deep check (P1)

Current bootstrap restores cached findings; startFullCheck only analyzes the existing catalog then checks copies. Metadata scan is a separate first action. A metadata-only success can say all items were checked or nothing needs cleaning before visual analysis/exact checks run. Historical successful job status can hide CheckCard despite changed analysis coverage.

Create a launch pipeline: explain permission → index accessible library → visual/quality checks → exact-resource checks → publish deep-clean results. Show stage-specific coverage and last checked time, including skipped/cloud/unsupported items. Do not block Library or Studio behind a full-screen progress view. Previous results remain clearly dated and safe while new ones are prepared.

### F24 — Library selection has no useful completion action (P1 product gap)

screens/library.tsx has Select/Done and a count, but no add-to-album, favorite, share or creation action for the selected items. It currently feels unfinished as a manager. Add a small contextual action bar and date/type/favorite filters. Keep "Protect in MediaCare" distinct from a Photos favorite and from album membership.

Implement real album/favorite adapters and capability checks before enabling those actions. Album membership is not moving a filesystem file and must not delete the original.

### F25 — Simplify the review and editing surface (P2)

- Clean: one scan status card and a clear "Review similar shots" entry; keep detailed coverage expandable. Avoid stacked cards repeating Scan, Check, Analyze and Find copies.
- Review: lead with the suggested keeper, show plain-language reasons, visible Keep/Mark controls and optional side-by-side comparison. Long-press should be a shortcut, not the only way to protect or choose a keeper.
- Use "Mark for removal" consistently instead of ambiguous Select all. Explain that "Also good" is a suggestion, not enforced protection.
- Plan: show actual kept count, photos versus videos, known versus unknown sizes and current build capability. "Keeping 1 photo" is misleading when other members remain unselected.
- Viewer: primary Edit, Favorite, Share; put metadata, Protect and smaller-copy options in a secondary menu while preserving discoverability.
- Studio: organize tools into Edit, Create and Video; show unavailable tools with a useful explanation, not a wall of disabled cards.
- Editing: persistent image preview, grouped controls, before/after and explicit saved-copy behavior. Avoid showing all sliders at once on a small phone.
- Use brief contextual help instead of automatically interrupting the user's first deep scan with a long spotlight tour. Keep the tour available in Help.
- People/subject/text search is a new on-device indexing feature, not functionality that already exists. Person naming/identity grouping needs a separate privacy/product decision; face-quality detection does not provide person identity.

### F26 — Accessibility, consistency and platform gates (P2)

Hardcoded dimensions/spacing occur outside src/theme (for example plan.tsx THUMB/FOOTER_CLEARANCE, library.tsx GAP/header/button sizes, pick.tsx badges/footer); thumb-strip uses raw Pressable. Move recurring design values into tokens; retain documented geometry constants where mathematically necessary.

Test fixed footers at largest Dynamic Type, safe-area insets, button label wrapping, VoiceOver order and focus after modal close. Check in-app Less motion in the pager independently of system Reduce Motion. AppText and the contrast listener are good shared foundations. Swift tools have capability guards, but Android/web behavior and native zoom differ and remain unverified; do not advertise cross-platform parity.

## What is already worth keeping

- Expo Router screen boundaries, shared controls/theme, UI-thread viewer gestures and reduced-motion support in much of the app.
- Virtualized Library, picker and category outer lists; narrow group subscriptions already implemented in part.
- No account or app-owned photo upload service found; native analysis and original-resource hashing disallow network.
- New-asset export model, explicit sample labeling, SQLite WAL/prepared statements, bounded scan batches and strong pure-domain tests.
- Exact-copy confirmation beyond MD5, keeper rules, favorites checks and release removal gate.

## Verification gaps to close

The passing suite is valuable but cannot detect GPU cost, native callback races, thermal load, real Photos permission transitions or video output fidelity. Add targeted integration tests for F10–F18, a temporary-SQLite repository/migration harness where supported, operation-count stress tests for grouping, and device profiling. Current Jest mocks do not prove Swift behavior.

Do not rewrite the app or add a paid service to solve this audit. Start with the ordered work in [AUDIT_IMPLEMENTATION_PLAN.md](AUDIT_IMPLEMENTATION_PLAN.md).

## Reference material checked

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) and [documentation index](https://docs.expo.dev/llms.txt).
- [React Native 0.86 performance](https://reactnative.dev/docs/0.86/performance): development-mode overhead and JS/UI frame distinction.
- [Expo Image SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/image/): image loading/recycling API; installed iOS loader examined separately for network policy.
- [Expo SQLite SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/): async database/transaction APIs.
- [Expo MediaLibrary SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/media-library/): current object API.
- [Expo React Compiler](https://docs.expo.dev/guides/react-compiler/): automatic memoization; installed preset confirms compiler dependency.
