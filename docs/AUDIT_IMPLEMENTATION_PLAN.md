# Audit implementation plan

Date: 2026-10-09. Based on [REPO_AUDIT_2026-10-09.md](REPO_AUDIT_2026-10-09.md).
Phase: Phase 3 stabilization/performance gate, then Phase 4 management and Phase 5/6 export validation.
Status: planned; only P3-AUD-001 (audit/documentation) is complete. No application fixes are included in this change.

## Product decisions

| Topic              | Decision / constraint                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Primary experience | Calm, simple, Photos-like; usable by the owner's dad                                      |
| Reported lag       | Installed development build; fewer than 1,000 photos; taps and opening views              |
| Launch behavior    | Owner explicitly wants a full deep scan every fresh launch                                |
| Manager scope      | Albums, favorites, date/type filters, editing, creations; people/subject/text search      |
| Removal            | Suggestions only until explicit review and confirmation; ADR-0008 release gate stays      |
| Cloud              | No remote processing; native deep scan stays local-only, reports skipped iCloud originals |
| Tab swiping        | Owner answer pending; preserve existing swipe until decided; standard tabs recommended    |
| Builds             | No EAS build or paid service authorized by this audit                                     |

Interpret "fresh launch" as a cold app session, not every foreground event or return from the Photos permission dialog. State this in onboarding/settings. A full scan refreshes metadata and reruns supported visual/quality and exact-copy checks across the accessible library, even if cached results exist. Cache is for responsive display and reusable technical resources, not skipping the requested recheck. If the owner later wants incremental checking, make that an explicit change of preference.

Ask before changing tab interaction or introducing person naming/recognition semantics. iCloud batch downloading, external processing and cloud builds require separate decisions. These do not block source-only stabilization.

## Order and acceptance criteria

Effort is relative (S: localized; M: several related files; L: architectural/native or multi-flow). It is not a delivery-date promise. Complete one reviewable slice at a time, updating status/backlog/capabilities with actual evidence.

### Wave 0 — Establish the performance baseline

**P3-PERF-002 — Interaction profiling (M; F01/F02/F06). First implementation task.**

Record app/native tools version, commit, iOS/device, library size, Metro dev flag, Hermes/debugger state, thermal/low-power conditions and whether a scan is running. Use the owner's existing installed development client first.

Compare normal development mode with the existing npm run start:fast command. That serves minified non-development JavaScript to the development client; it is a useful diagnostic comparison, **not a release-native benchmark**. It also makes **DEV** false, so developer UI/removal are expected to disappear. Do not request a cloud build just to start this comparison.

Capture 20 repetitions per path after warm-up, plus cold opens:

1. Clean → category; category → Compare; Compare → plan.
2. Library → photo → close; photo → Edit/Smaller copy.
3. Clean/Library/Studio tab changes; Settings open/close.
4. Select/unselect; choose keeper; Protect from viewer and review.
5. Repeat with idle app, active analysis, active copy check, and result publication.

Instrument only local aggregate timings: press-in, feedback, navigation requested, first layout, first usable content. React profiling diagnoses commits; final timings must be taken with profiling/debug overlays off. On Windows use RN/Expo tooling and owner screen recordings for perceptual comparison; do not claim an Instruments trace was captured without a Mac.

Proposed targets, to confirm on the supported device baseline: p95 visible tap acknowledgement <= 100 ms; p95 warm destination usable <= 300 ms excluding the intentional transition duration; no app-owned > 50 ms JS tasks during normal taps. Aim at the device's active refresh cadence (about 16.7 ms at 60 Hz / 8.3 ms at 120 Hz), without promising 120 Hz regardless of thermal/OS settings. Record p50/p95 and worst cases rather than a single average. Set scan-overlap budgets after the baseline and keep the same comparison scenarios.

Acceptance: reproducible before traces and ranked hot paths, without private filenames/IDs in committed artifacts. Device measurements awaiting owner test.

### Wave 1 — Fix safety and lifecycle foundations

**P3-SAFE-001 — Authoritative protection and execution policy (M; F10/F12). P0 before removal.**

Unify protection reads/writes across viewer, review, plan and command service. Include current catalog protection at the final boundary; surface failed persistence. Gate release/sample/preference at the service and add an execution lock.

Acceptance: mark → viewer Protect → plan excludes asset; blocked call never reaches mocked Photos deletion; preference changes and concurrent submissions fail closed. Test both protection entry points and restart after persistence failure. Personal-photo removal is never part of this test.

**P3-SAFE-002 — Immutable review evidence and honest outcomes (L; F11). P0 before removal. Depends on SAFE-001.**

Capture the reviewed asset version, keeper and resource/size evidence in the plan. Unknown versions cannot silently qualify. Revalidate access and evidence before submitting; changed evidence requires skip/review and refreshed hashing when applicable.

Persist submitted operation intent, distinguish confirmed missing from unreadable/unknown, and reconcile ambiguous outcomes. Failure after submission must not claim nothing was removed. Retain audit outcome even if the result screen closes.

Acceptance: changed source/keeper, null version, permission revoked, canceled OS dialog, failed verification and failed history writes produce accurate conservative reports. Device deletion proof remains only on owner-created fixtures with explicit go-ahead.

**P3-JOB-004 — Single job coordinator and awaited cancellation (L; F13).**

Retain runner done handles, generation IDs and one active job across launch checks, manual scans, clear-data and removal-sensitive operations. Cancel/drain before clearing or replacing; ignore late events and stale results. Perform interrupted-job recovery once at bootstrap, not on every load. Serialize checkpoints and catch finish failures. Publish succeeded only after result persistence/grouping succeeds.

Acceptance: stop mid-native-batch, clear while writing, restart while finishing, app background/resume and rapid double-start cannot resurrect data or publish an old generation. Use deterministic delayed dependency tests.

**P3-PRIV-001 — Asset/access reconciliation and safe missing states (M; F15). Depends on JOB-004.**

Atomically reconcile accessible assets, findings and selections on changes. Use graceful missing-item lookups in UI; gate display and commands on access. Persisted results must never imply permission is still current.

Acceptance: revoke full access, narrow limited selection, externally delete keeper/member while plan is open, then return. No crash, inaccessible media is masked, affected removal plans are invalidated.

**P3-PRIV-002 — Clear-data contract and owned temporary storage (M; F14/F17). Depends on JOB-004.**

Inventory database/WAL, image cache, native outputs and image-manipulator outputs; define owners, size/age limits and startup cleanup. Clear in-memory drafts/viewer state and owned files after jobs drain. Do not delete Photos assets. Verify protection/backup behavior on device and describe logical erasure honestly.

Acceptance: clear during and after each tool leaves no app-owned result restored later; failures are visible/retryable; repeat tool use reaches a storage plateau. Device protection and cache measurements awaiting owner test.

**P3-SEC-001 — Dependency advisory triage (M; F20).**

Trace all five direct advisories to runtime/build/CI call sites. Prioritize malformed link parsing; verify candidate patches against installed SDK constraints. Pin compatible resolutions only with evidence; no forced major fixes.

Acceptance: documented runtime reachability or non-reachability, updated advisory inventory, compatible lockfile if fixes are applied; npm run check + doctor + bundle:ios. Any remaining risk has a concrete owner and mitigation, not a blanket "safe" statement.

### Wave 2 — Make taps and openings consistently responsive

**P3-PERF-003 — Press feedback and tab lifecycle (M; F01/F02/F06). Depends on PERF-002; tab change depends on owner decision.**

Prototype the shared press-feedback improvement on the measured hot path. Preserve native/assistive activation and canceled scroll gestures. Avoid unnecessary route work before the destination's first frame. Isolate scan status and background tab subscriptions.

If standard tabs are approved, use stable Expo Router navigation and preserve tab scroll/selection. If swipe remains, keep UI-thread dragging, adjacent-page readiness, reduced motion and interrupted-gesture recovery. Update ADR/MOTION/tour instructions together.

Acceptance: measured improvement on affected paths without double navigation, stuck pressed state, duplicate haptics or lost tab position; VoiceOver and largest text pass on device.

**P3-PERF-004 — Bound rendered plan/group content (M; F03).**

Virtualize plan rows and long strips; use compact group previews or a dedicated member list. Size the initial render window to the viewport. Add fixed-row layout hints only where heights truly are fixed; do not break Dynamic Type to force them.

Acceptance: synthetic 1,000-selected-item plan and 500-member group render a bounded number of thumbnails near the viewport, remain fully reviewable and preserve keeper labels/counts. Native opening/scroll performance awaiting owner test.

**P3-PERF-005 — Cancellable grouping and cached derived results (L; F04/F06). Depends on JOB-004.**

Move expensive grouping out of synchronous result publication. Start with time-budgeted chunks and generation cancellation; share normalized vectors and versioned result indexes. Updating exact-copy results should not redo visual grouping. Evaluate native execution only if traces still justify it.

Acceptance: same groups/keepers on golden fixtures, explicit no-chaining cases, cancellation during grouping, operation-count stress cases for dense bursts; short JS slices under measured budgets. Any changed grouping rule requires quality evaluation, not just a faster benchmark.

**P3-PERF-006 — Lightweight launch and catalog access (M/L; F05/F09).**

Load summary and visible metadata first, avoid eager full-vector parsing, preserve unchanged item identities. Stream metadata batches instead of collecting all pages before useful publication. Consider SQL pagination for Library and filters as dataset grows.

Acceptance: first useful screen does not wait for full analysis hydration; 1k/10k/50k metadata fixtures have documented time/memory growth, bounded image loading and no stale recycled images. Do not replace the list library without A/B evidence.

**P4-EDIT-002 — Preview scheduler and output lifecycle (M; F08/F17).**

Single-flight previews, latest pending recipe, bounded files, stale-result cleanup and explicit loading reset. Apply operation ownership to export/tool/movie hooks. Prevent duplicate saves and late completion after dismissal; preserve a recoverable result after a save failure where possible.

Acceptance: rapid slider edits, Reset during processing, leave/reopen, save failure, low disk and late completion cannot show stale results or leak temporary files. Device preview latency/memory awaiting owner test.

### Wave 3 — Deliver the requested deep-clean launch experience

**P3-SCAN-001 — Full launch scan with responsive browsing (L; F07/F21/F23). Depends on JOB-004, PRIV-001, PERF-005 and PERF-006.**

After the explicit first-run permission explanation, show usable shell/cached results immediately and start one full scan for that cold session. Pipeline: refresh metadata → fresh visual/quality analysis → fresh exact-resource checks → grouping/verified coverage → publish results. Include supported video-size measurement with retryable failed/cloud status.

Add an explicit force-full mode to runners; current successful-result reuse must not silently defeat this requirement. Show each stage's real progress; skip unsupported/iCloud-only resources honestly. Expo Go must explain native-only checks and must not call its limited fallback a complete deep scan.

Keep Library/Studio usable. Pause or reduce scan work during intensive edits and active gestures, resume at safe boundaries, and offer Pause/Stop without restarting on every foreground event. Avoid automatic media downloads. Persist checkpoints for recovery. Native callbacks must be bounded before unattended launch scans are enabled.

Add an ADR and update user-started-only wording in scan docs/privacy explanation to describe automatic analysis after consent, while retaining explicit review for all removal. No background execution guarantee: report suspension/interruption honestly.

Acceptance: permission denied/limited, no network, cold launch, ordinary foreground return, stop, re-launch and active editing all behave deterministically. Full-scan counters prove unchanged photos are rechecked. No deep-clean-complete claim while a required stage is missing. Device runtime/thermal/navigation behavior awaiting owner test.

**P3-QUAL-001 — Evaluate keeper and similar-moment quality (M; F04/F23/F25).**

Use licensed/owner-created held-out fixtures: same room/different pose, dance sequences, sharp subject/soft background, closed eyes/winks, small faces, screenshots, crops, edits and Live Photos. Measure false merges separately from missed groups, and record keeper disagreement. Do not turn weighted quality scores into confidence percentages.

Acceptance: fixture report and versioned thresholds; favorite/protected keepers respected; explainable reason for each suggestion; ambiguous moments remain separate or ask for review. Full scan does not mean more aggressive unsafe grouping.

**P1-UI-012 — Calm cleanup, review and viewer presentation (M; F23/F25/F26).**

One primary next step per screen; dated scan summary with expandable coverage; persistent unobtrusive job bar. Clear Keep/Mark/Skip controls, correct kept counts and media nouns, measured/unknown size distinctions. Consolidate repeated scan cards, make detailed tour optional, refine viewer/Studio hierarchy.

Acceptance: source-backed screens for loading/partial/empty/error/limited access; owner and dad can find a suggested keeper, change it, review a plan and edit a copy without a verbal walkthrough. Largest Dynamic Type, VoiceOver and reduced motion awaiting owner test.

### Wave 4 — Reliable creations and a real photo manager

**P6-VID-003 — Native cancellation and output verification (L; F16/F17).**

Replace unbounded waits with cancellation/status-aware control, handle every frame failure, reopen outputs, return real container/dimensions/duration/audio details and select correct share MIME/UTI. Add autorelease/resource lifetime controls where profiling demonstrates need. Keep missing-slide handling explicit; recommend preflight and choosing retry/exclude rather than a surprise black slide.

Acceptance: cancel during load/writer backpressure, low disk, missing source, codec/preset fallback, rotated video, trim boundaries and slideshow frame count. Native compile and actual playback/A-V sync require the next explicitly authorized build and owner test.

**P4-EXP-002 — Export capability and consent gate (M; F18).**

Define supported source/output matrix for alpha, HDR, high bit depth, animation, Live/RAW paired resources and metadata. Preserve when supported, otherwise show explicit conversion choice or block. Resolve cloud status before enabling network-capable work. Make previews and final output verified, not merely successful writes.

Acceptance: transparent PNG, HEIC, HDR, animated image, Live Photo, iCloud-only photo and malformed output fixtures; unknown cloud state never masquerades as local.

**P4-ORG-001 — Albums, favorites and useful selection actions (L; F24). Depends on PRIV-001.**

First: filters by date/type/favorite and a usable selected-item toolbar. Then implement Photos album creation/membership and favorite changes with current SDK documentation, permission checks and platform adapters. Keep Protect as separate app state. No fake album controls.

Acceptance: actual Photos changes round-trip, cancel/failure are visible, limited access remains valid, and album membership changes never delete assets.

**P4-SRCH-001 — On-device text/subject/people search feasibility (L; new owner scope).**

Spike OCR/subject indexing and person grouping separately. Reuse safe job scheduling and local data lifecycle, but do not assume existing face-quality metrics identify people. Define supported languages, accuracy, storage budget and indexing cost. Decide whether "people" means photos containing people, grouping the same person, or user-named people before enabling identity features.

Acceptance: measured fixture results and capability matrix; unsupported searches are not offered as working. No remote AI dependency or photo upload without a later explicit decision.

**P3-HARD-001 — Diagnostics, boundary validation and documentation consistency (M; F19/F22/F26).**

Redact shared diagnostics by default, guard developer routes, validate database/native payloads, classify errors, and reconcile ADR/status/test-count drift. Centralize reusable spacing/motion values and remove raw control exceptions where appropriate. Verify current repository visibility separately if the owner wants it changed.

Acceptance: default reports contain no private asset identifiers, invalid stored data degrades safely, safety failures are actionable, release route guards tested, docs match actual capabilities.

### Wave 5 — Final regression and release evidence

**P3-QA-002 — Release-like performance and safety gate (M). Depends on relevant waves above.**

Run npm run check after each slice; run npm run doctor and npm run bundle:ios for dependency/config changes. Add focused lifecycle, repository and integration tests where the audit found missing coverage. Do not treat a larger test count as device proof.

Repeat Wave 0 traces after improvements, at idle and during the full launch scan. Test Expo Go fallback separately from native development and release-like builds. Run 10-minute browse/review/edit loops for memory/storage growth and thermal degradation. Test light/dark, maximum text, Reduce Motion/Transparency/Increase Contrast, interrupted gestures, lost access and low storage.

No cloud build automatically. Once source work and checks are reviewable, request the owner's explicit go-ahead for the native build. Only mark native/device checks complete with actual results. Keep release removal disabled until purpose-made fixture proof and a new ADR explicitly permit enabling it.

## First recommended delivery slice

Do PERF-002 baseline instrumentation and SAFE-001 first, then JOB-004. Triage SEC-001 before any dependency update.

The first visible improvements should be responsive common press feedback, quieter offscreen work and bounded plan/group mounts. Then address startup/grouping and introduce the full launch scan. Adding automatic full scans before those foundations would amplify the currently reported lag.

## Decisions still open

- Keep tab swiping or adopt standard instant tabs? Preserve current behavior pending answer.
- Person search semantics and naming: decide during SRCH-001; local face quality analysis is not identity recognition.
- iCloud batch-download policy: default remains no automatic originals download; show skipped coverage.
- Device support floor and dad's phone model: gather during PERF-002 to set realistic budgets.
- EAS build and deletion test authorization: separate explicit go-aheads, not implied by this plan.
