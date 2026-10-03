# Stack and dependencies

Selected 2026-10-02 against the npm `latest` tag. Every SDK-managed package was installed with `npx expo install` so versions match **Expo SDK 57**. The lockfile (`package-lock.json`) is committed; CI installs with `npm ci`.

## Compatibility set

| Item             | Version                                | Notes                                                                                    |
| ---------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Expo SDK         | 57.0.x (`expo ~57.0.26`)               | Latest stable on npm at bootstrap (`sdk-58` exists only as `next`)                       |
| React Native     | 0.86.3                                 | New Architecture (required by Reanimated 4)                                              |
| React            | 19.2.3                                 | React Compiler enabled (`experiments.reactCompiler`)                                     |
| TypeScript       | ~6.0.3, `strict`                       | TS 6 no longer auto-includes `@types/*`; `tsconfig` lists `"types": ["jest"]`            |
| Node             | 22 LTS (22.23.3 used)                  | `engines.node >= 22`                                                                     |
| Package manager  | npm 10                                 | One manager only; do not mix yarn/pnpm/bun                                               |
| Expo Go (iPhone) | Must be the build that supports SDK 57 | **Assumption to confirm on device**: the App Store Expo Go supports the current SDK only |

Rule: never bump React Native, Reanimated or Worklets independently. SDK upgrades are their own task (`npx expo install expo@^58` then `npx expo install --fix`, following Expo's upgrade guide).

## Runtime dependencies

| Package                                                                                                                        | Version  | Purpose                                                   | Expo Go                      | Native build needs | License | Risk / fallback                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------- | ---------------------------- | ------------------ | ------- | ------------------------------------------------------------------------------------------------------- |
| expo                                                                                                                           | ~57.0.26 | SDK runtime, CLI, modules                                 | ✅                           | —                  | MIT     | —                                                                                                       |
| expo-router                                                                                                                    | ~57.0.24 | File-based routes, stack, JS tabs                         | ✅                           | —                  | MIT     | Stable `Tabs` + `Stack` only; `unstable-native-tabs` deliberately not used (ADR-0002)                   |
| react-native-reanimated                                                                                                        | 4.5.1    | UI-thread animation, CSS transitions, springs             | ✅                           | New Arch           | MIT     | Core `Animated` is not a fallback for gestures; keep Reanimated                                         |
| react-native-worklets                                                                                                          | 0.10.1   | Worklet runtime for Reanimated 4                          | ✅                           | —                  | MIT     | Version pinned by SDK                                                                                   |
| react-native-gesture-handler                                                                                                   | ~2.32.0  | Pan/pinch/swipe, `GestureHandlerRootView` at root         | ✅                           | —                  | MIT     | v3 hook API is a later migration                                                                        |
| react-native-safe-area-context                                                                                                 | ~5.7.0   | Insets for status bar / home indicator                    | ✅                           | —                  | MIT     | —                                                                                                       |
| react-native-screens                                                                                                           | ~4.26.0  | Native stack and modal presentation                       | ✅                           | —                  | MIT     | —                                                                                                       |
| expo-image                                                                                                                     | ~57.0.5  | Thumbnail/display pipeline (Phase 2)                      | ✅                           | —                  | MIT     | Rendering only, not pixel analysis                                                                      |
| expo-blur                                                                                                                      | ~57.0.3  | Tab bar material                                          | ✅                           | —                  | MIT     | Solid `chromeSolid` under Reduce Transparency                                                           |
| expo-linear-gradient                                                                                                           | ~57.0.2  | Synthetic sample artwork, caption fades                   | ✅                           | —                  | MIT     | —                                                                                                       |
| expo-haptics                                                                                                                   | ~57.0.3  | Selection/success feedback, gated by preference           | ✅                           | —                  | MIT     | Silently no-op where unavailable                                                                        |
| expo-symbols                                                                                                                   | ~57.0.3  | SF Symbols (iOS), Material Symbols fallback               | ✅                           | —                  | MIT     | `Icon` wrapper owns the name map                                                                        |
| @expo/ui                                                                                                                       | ~57.0.21 | Native SwiftUI Form controls in Settings                  | ✅ (SDK 56+ universal layer) | —                  | MIT     | If a control misbehaves on device, replace that row with RN `Switch`/custom row                         |
| expo-constants                                                                                                                 | ~57.0.20 | App version/SDK in Settings                               | ✅                           | —                  | MIT     | —                                                                                                       |
| expo-status-bar, expo-splash-screen, expo-system-ui, expo-linking, expo-font, expo-web-browser, expo-device, expo-glass-effect | ~57.0.x  | Template-provided platform plumbing                       | ✅                           | —                  | MIT     | `expo-glass-effect`, `expo-device`, `expo-web-browser` unused today; prune in P1-UI-008 if still unused |
| zustand                                                                                                                        | ^5.0.15  | Small UI/session state (preferences, selection mode)      | ✅ (pure JS)                 | —                  | MIT     | Never holds media bytes or the catalog                                                                  |
| react-native-web, react-dom                                                                                                    | template | Web target exists but is **not** evidence of iOS behavior | n/a                          | —                  | MIT     | Keep for tooling; no product promise on web                                                             |

## Development dependencies

| Package                                                       | Purpose                                                                          | License    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------- |
| jest ^29.7 + jest-expo ^57.0.5                                | Test runner with Expo preset                                                     | MIT        |
| @testing-library/react-native ^14 + test-renderer ^1          | Component tests through the accessibility tree (v14: async `render`/`fireEvent`) | MIT        |
| @types/jest ^29.5                                             | Matches Jest 29                                                                  | MIT        |
| eslint-config-expo (via `expo lint`) + eslint-config-prettier | Lint; Prettier owns formatting                                                   | MIT        |
| prettier ^3                                                   | Formatting (`.prettierrc.json`)                                                  | MIT        |
| typescript ~6.0                                               | Types                                                                            | Apache-2.0 |

`jest.setup.ts` mocks Worklets/Reanimated with their official mocks plus the CSS-animation helpers the official mock lacks (`cubicBezier`, `css.create`, `useReducedMotion`). Tests therefore verify state and accessibility, never animation feel.

## Planned, not installed (add when the phase starts)

| Package                   | Phase                                                   | Purpose                                                                                          | Expo Go?                                                                                                    |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| expo-media-library        | 2                                                       | Permissions, Query, Asset, delete                                                                | ✅ in Expo Go, but full behavior must be verified on device; production Info.plist strings need a dev build |
| expo-image-picker         | 2                                                       | Selected-file fallback                                                                           | ✅                                                                                                          |
| expo-image-manipulator    | 2                                                       | Crop/rotate/resize/encode JPEG/PNG                                                               | ✅                                                                                                          |
| expo-file-system          | 2                                                       | Temp files, export verification, cache cleanup                                                   | ✅                                                                                                          |
| expo-sqlite               | **installed ~57.0.3** (kv-store, Phase 1); catalog in 2 | Preferences via `expo-sqlite/kv-store` now; catalog + migrations in Phase 2                      | ✅                                                                                                          |
| expo-sharing              | 2                                                       | Share exports                                                                                    | ✅                                                                                                          |
| zod                       | 2                                                       | Validate job/config/import boundaries                                                            | pure JS                                                                                                     |
| expo-dev-client           | 3                                                       | Development build                                                                                | requires EAS build                                                                                          |
| local Expo module (Swift) | 3                                                       | Original resource bytes via PhotoKit `PHAssetResourceManager`, streaming SHA-256, pixel analysis | dev build only                                                                                              |
| expo-video, expo-audio    | 6                                                       | Video playback, soundtrack preview                                                               | ✅ playback only                                                                                            |
| @shopify/flash-list       | evaluate in 2                                           | Large grids if FlatList measurements fall short                                                  | check SDK compatibility first                                                                               |

## Rejected alternatives

| Option                               | Why not                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| Flutter / SwiftUI-only / web wrapper | Owner requirement: React Native + Expo + TypeScript                                |
| NativeWind / Tamagui / UI kit        | Fights the bespoke visual direction; tokens + small primitives are enough          |
| Redux / multiple state libraries     | Overkill; SQLite is the catalog of record, Zustand only for UI state               |
| Drizzle/TypeORM                      | Hand-written SQL migrations are small and transparent at this size (ADR-0003)      |
| `@gorhom/bottom-sheet`               | Native modal/formSheet presentation and `@expo/ui` BottomSheet cover current needs |
| Lottie / Skia                        | No current need; add only for a specific illustration or canvas case               |
| `NativeTabs` (unstable)              | See ADR-0002                                                                       |
