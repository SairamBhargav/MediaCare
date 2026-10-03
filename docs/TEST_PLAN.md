# Test plan

Evidence levels, in increasing strength: automated local checks → mocked component tests → device check in Expo Go → device check in a release-like build. Reports always state which level each claim reached. A browser screenshot, a mocked test or a successful cloud compile never proves native photo behavior.

## 1. Automated checks (every change; CI on push)

| Check                  | Command                | Proves                                   |
| ---------------------- | ---------------------- | ---------------------------------------- |
| Types                  | `npm run typecheck`    | Strict TS across app and tests           |
| Lint                   | `npm run lint`         | Expo ESLint rules (hooks, imports)       |
| Format                 | `npm run format:check` | Prettier                                 |
| Unit + component tests | `npm test`             | Domain rules; accessible UI state        |
| Dependency health      | `npm run doctor`       | SDK-compatible versions, config          |
| iOS bundle             | `npm run bundle:ios`   | Metro/Hermes can build the iOS JS bundle |

Current suite (2026-10-02): 58 tests: contrast pairs for both palettes, byte formatting and unique-byte sums, review-selection invariants, and the sample review's checkbox/summary behavior.

## 2. Domain and safety cases (required as features land)

Exact vs re-encoded copies · distinct asset vs resource identity · misleading filenames · keeper and protected never selected (done) · overlapping findings counted once (done for bytes) · missing originals · stale source versions at execution · cancelled system dialog · partial deletion success · interrupted job and resume · retry idempotency · dates with missing offset kept unknown · invalid metadata · size-limit "not achievable" · export fails verification · insufficient disk.

## 3. Fixtures

- Phase 0: synthetic gradient samples (`src/demo`).
- Phase 1: 12–20 licensed real photos for visual QA (P1-UI-007) with `assets/fixtures/LICENSES.md`.
- Phase 2+: an on-device **disposable test album** (never the owner's real memories) containing: rotated JPEG, transparent PNG, HEIC, large panorama, portrait with intentional background blur, low-texture image, low light, red objects outside eyes, varied skin tones, edited rendition, Live Photo, RAW+JPEG pair, screenshots, a corrupted file, an iCloud-only original, an unsupported type. Exact duplicates are created by saving the same file twice.
- Evaluation sets for blur/similarity/red-eye: separate development and held-out sets; report sample sizes and precision/recall. Heuristic scores are never shown as probabilities.

## 4. Device checks (owner, physical iPhone)

Record: iPhone model, iOS version, Expo Go version / build type, date.

**Phase 0 smoke test**

1. `npm start`, scan QR, app opens on Clean.
2. Switch tabs: instant, no slide; tab bar translucent over scrolled content.
3. Clean: tap sample photos; keeper ("Keep") does not toggle; summary updates; Select all → 3 selected; Clear.
4. Library: scroll the grid fast; tap **Select**, select several, scroll away and back: selection persists; **Done** clears.
5. Studio: placeholder reads correctly.
6. Settings (gear on Clean): Theme Light/Dark/System applies everywhere including the sheet; Less motion and Haptics switches work; swipe down and Done both close.
7. Settings → Developer → Components & Motion gallery opens.
8. Run the MOTION.md device feel checklist.
9. Accessibility: VoiceOver on Clean (tiles announced as checkboxes with names; keeper as image; summary announced), largest text size (Settings → Accessibility → Display & Text Size → Larger Text) on all three tabs: nothing clipped or overlapping.

Report failures with a screenshot or screen recording and the step number.

**Later phases** add: permission states (denied / limited / full, changes while app is backgrounded), HEIC/orientation, export fidelity, deletion semantics on disposable assets, interrupted scans (force-quit mid-scan), memory over a 1k → 10k asset library.

## 5. Visual and motion QA

Both themes · Reduce Motion · Reduce Transparency · Increase Contrast (P1) · largest Dynamic Type · rapid repeated taps · interrupting sheets mid-gesture · back-swipe vs horizontal compare swipe · scrolling real thumbnails while a job runs · low-power mode. Short screen recordings for key flows accompany each phase's design checkpoint.

## 6. Performance

Benchmark a 1,000-asset library, then scale metadata/thumbnail work toward 10,000 on the baseline device. Record device, iOS, SDK, build type, input sizes, memory and scan time. No universal speed promise without evidence. Performance sign-off only on preview/release builds.

## 7. Release checklist (Phase 3+)

App-specific photo permission strings · privacy disclosures/manifest per current Apple requirements · credentials handled by EAS, never committed · export correctness · crash recovery and interrupted jobs · help/support copy · signed-device behavior · current App Store requirements researched at that time.
