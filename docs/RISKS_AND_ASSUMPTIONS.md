# Risks and assumptions

Ranked by impact × likelihood. Review at each phase exit.

## Risks

| #   | Risk                                                                                     | Impact                                                | Likelihood | Evidence today                                                | Mitigation                                                                                     |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| R1  | Original photo bytes are not reachable through Expo APIs (only renditions)               | Exact-duplicate feature cannot be truthful in Expo Go | High       | `getUri()` semantics undocumented for edited/HEIC/Live/iCloud | Spike S1; native PhotoKit module in a dev build; until then, no exact-duplicate claims         |
| R2  | Hashing/analysis in JS blocks the JS thread on large libraries                           | Janky UI, slow scans                                  | High       | General RN constraint                                         | Native or worker-runtime implementation; bounded batches; foreground checkpoints               |
| R3  | Deletion behaves differently than expected (dialog, partial failure, iCloud propagation) | Data-loss perception, trust                           | Medium     | Not tested                                                    | Spike S4 on disposable assets; revalidation; per-item results; plain-language warnings         |
| R4  | Expo Go on the App Store moves to SDK 58 before Phase 1 ends                             | Can't load the app in Expo Go                         | Medium     | SDK 58 is in `next`                                           | Upgrade via `expo-upgrade` task; or EAS dev build earlier                                      |
| R5  | No Mac makes native debugging slow                                                       | Phase 3 delays                                        | Medium     | Known                                                         | Small native surface, good logging, EAS logs, rented remote Mac only for hard cases            |
| R6  | Apple Developer membership / EAS build quota not available when Phase 3 starts           | Blocks dev build                                      | Medium     | Owner decision pending                                        | Decide by end of Phase 2; everything else proceeds in Expo Go                                  |
| R7  | `@expo/ui` SwiftUI controls render or behave unexpectedly in Expo Go                     | Settings looks off                                    | Low–Med    | Docs say Expo Go supported (SDK 56+)                          | Device check P1-DEV-001; fall back to RN rows per control                                      |
| R8  | Custom JS tab bar feels less native than system tab bar (e.g. iOS 26 Liquid Glass)       | Polish gap                                            | Medium     | ADR-0002                                                      | Re-evaluate `NativeTabs` + `BottomAccessory` once stable; tab bar is isolated in one component |
| R9  | Animation smoothness judged in Expo Go misleads                                          | Wrong design decisions                                | Medium     | Expo Go is dev-mode                                           | Judge feel on preview build in Phase 3; Expo Go only for direction                             |
| R10 | Blur/similarity heuristics produce embarrassing false positives (intentional bokeh, art) | Trust                                                 | Medium     | Not built                                                     | Explainable flags, Keep/Ignore, held-out evaluation before showing scores                      |
| R11 | Scope creep from the full vision (video, AI, passport)                                   | Nothing ships                                         | High       | 26 features in PRD                                            | Strict phase gates; only current phase implemented                                             |
| R12 | Storage savings over-claimed                                                             | Trust, review rejection                               | Medium     | Rules in PRIVACY_AND_SAFETY                                   | Separate accounting terms; "unknown" when unmeasurable                                         |

## Assumptions (confirm or correct)

| #   | Assumption                                                                                       | Status                                                           | Who confirms           |
| --- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------- |
| A1  | Owner has a physical iPhone available for testing                                                | **Verified**: iPhone 17, iOS 26.6.2, Expo Go SDK 57 (2026-10-03) | —                      |
| A2  | Expo Go from the App Store currently supports SDK 57                                             | Assumed; SDK 57 is npm `latest`                                  | Owner, on first launch |
| A3  | Owner is on Windows 11 with Node 22 and npm                                                      | Verified on this machine (Node 22.23.3, npm 10.9.9)              | —                      |
| A4  | GitHub repo `SairamBhargav/MediaCare` should be **private** until a license and release decision | **False on 2026-10-02: repo is public**                          | Owner (repo settings)  |
| A5  | No paid services until Phase 3                                                                   | Assumed                                                          | Owner                  |
| A6  | Primary language English; US locale for passport rules first                                     | Assumed                                                          | Owner                  |
| A7  | iPhone-only for now; iPad runs in iPhone compatibility mode (`supportsTablet: false`)            | Decided (reversible)                                             | —                      |

## Owner decisions pending

| Decision                                               | Needed by                 | Default if not decided                                                                                            |
| ------------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Apple Developer Program membership                     | Phase 3 start             | Stay in Expo Go; Phase 3 blocked                                                                                  |
| Bundle identifier (e.g. `com.sairambhargav.mediacare`) | First `eas build`         | Not set; EAS will prompt                                                                                          |
| Final brand name                                       | Before TestFlight         | Keep "MediaCare"                                                                                                  |
| Repository license                                     | Before any public release | None: all rights reserved (the template's MIT license file was removed because it named Expo as copyright holder) |
| Any cloud processing / budget                          | Phase 5                   | None                                                                                                              |
