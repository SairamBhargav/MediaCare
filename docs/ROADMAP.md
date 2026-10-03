# Roadmap

Phases are ordered by dependency, not by calendar. Each has an exit gate; a phase is done when its gate is met with evidence, not when its code exists. Task details: [BACKLOG.md](BACKLOG.md).

| Phase | Theme                                      | Runs in                       | Exit gate (summary)                                                                                            |
| ----- | ------------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 0     | Planning, feasibility, bootstrap           | Expo Go                       | Checks pass; QR startup documented; shell launches on owner's iPhone; next tasks unambiguous                   |
| 1     | Polished Expo Go experience on sample data | Expo Go                       | Owner explores the full cleanup journey on iPhone and signs off design/motion direction                        |
| 2     | Real iOS media + verified local exports    | Expo Go (+ spike results)     | Browse own media; make a verified smaller copy; originals untouched; spikes S1–S5 answered                     |
| 3     | Dev build + trustworthy photo cleanup MVP  | EAS dev/preview build         | On-device evidence of revalidated, user-confirmed deletion, interrupted-job recovery, release-like performance |
| 4     | Photo quality + richer editing             | Dev build                     | Evaluated similarity/blur/red-eye on held-out fixtures; reproducible derivatives                               |
| 5     | Advanced Studio                            | Dev build (+ optional remote) | Every enabled tool has a validated export pipeline; passport rule set sourced and versioned                    |
| 6     | Basic video                                | Dev build                     | Video catalog, duplicates, compression/trim with verified tracks and A/V sync                                  |
| 7     | Advanced video                             | Research → product            | Quality/thermal/runtime/cost limits met before any feature ships                                               |
| 8     | Wider platforms and growth                 | Per platform                  | Each platform's capability matrix published before release                                                     |

## Phase 0 — Planning, feasibility, bootstrap ✅ (pending device check)

Delivered: planning docs, version-verified stack, capability matrix with spikes, Expo SDK 57 app with tokens, tabs, settings, sample review with selection motion, tests, CI, EAS profiles (unlinked).

Exit gate:

- [x] Dependencies resolve (`npm ci`), Expo Doctor 21/21
- [x] Typecheck, lint, format, 58 tests pass; iOS bundle exports
- [x] QR startup path documented (SETUP_WINDOWS.md)
- [ ] **Owner launches it in Expo Go on their iPhone** and completes the MOTION.md device checklist
- [x] Next tasks listed in STATUS.md

## Phase 1 — Polished Expo Go experience (sample data)

Onboarding, Clean categories, group review and compare, Library timeline + viewer, scan/job presentation with an explicitly **simulated** sample scan, Settings persistence, component gallery completion, light/dark/Reduce Motion/Dynamic Type across all screens. One design checkpoint with the owner after the review flow (P1-REV-003), not repeated sign-offs.

Exit: complete cleanup journey explorable on iPhone; every sample number labelled; demo-only paths recorded in STATUS.md.

## Phase 2 — Real iOS media and local exports

Permissions (full/limited/denied), paginated assets, HEIC display, chronology, SQLite catalog, resumable foreground indexing, Protected state, verified JPEG/PNG crop/resize/compress exports saved as new assets. Spikes S1–S5 completed and CAPABILITIES.md updated. If S1 allows a truthful claim, prototype one real exact-duplicate group.

Exit: user browses accessible media and saves a verified smaller copy; coverage/limitations visible; repo states what stays in Expo Go vs needs Phase 3.

## Phase 3 — Development build and cleanup MVP

Requires: Apple Developer Program membership (owner decision), registered iPhone, EAS project. Native module for original resources + streaming SHA-256 (per S1), exact duplicates, review with keeper protection, revalidated deletion through Photos, Activity + recovery guidance, qualified storage accounting, basic evaluated blur flags. Release-like performance profiling.

Exit: on-device tests with disposable fixtures demonstrate cancellation, permission revocation, revalidation, interrupted jobs, original preservation and actual deletion outcomes; navigation never stalls during a scan.

## Phases 4–8

As specified in the master brief: quality and editing (4), advanced Studio incl. passport with one official rule set (5), basic video (6), advanced video research (7), iPad/Android/other platforms and optional accounts/sync/billing (8). Each phase begins by refreshing CAPABILITIES.md and breaking its features into backlog tasks with acceptance criteria.

## Release boundaries

- Nothing ships to TestFlight before Phase 3 exit.
- No cloud processing, account system, analytics SDK or paywall before an explicit owner decision with a written product case.
- Expo Go support for the sample experience continues through Phase 3 unless an ADR records the end of it.
