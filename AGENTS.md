This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## MediaCare project rules

Read these before any work session: `STATUS.md` → `docs/ROADMAP.md` → the relevant tasks in `docs/BACKLOG.md` → `docs/decisions/`. State the phase and task IDs you are working on, implement the next incomplete tasks, then update `STATUS.md`, `docs/BACKLOG.md`, `CHANGELOG.md` and (when evidence changes) `docs/CAPABILITIES.md`.

- iPhone first; the owner develops on Windows without a Mac and tests in **Expo Go** on a physical iPhone. Keep the Expo Go path working unless an ADR says otherwise.
- Never hardcode colors, font sizes or spacing outside `src/theme/`. Text goes through `AppText`; pressables through `PressableScale`/`Button`/`IconButton`.
- Motion follows `docs/MOTION.md`: Reanimated on the UI thread, `.get()/.set()` on shared values, a reduced-motion path for every animation (`useReduceMotion()`), one haptic per user action via `src/utils/haptics.ts`.
- Safety rules in `docs/PRIVACY_AND_SAFETY.md` are non-negotiable: no automatic removal, keeper always kept, revalidate before any destructive call, honest storage numbers, sample data always labelled.
- No fabricated functionality: no fake progress, made-up savings, random confidence scores or stubbed AI presented as real.
- Don't start EAS cloud builds, submit to TestFlight, or add paid services without the owner's explicit go-ahead.
- Done means `npm run check` passes, plus `npm run doctor` and `npm run bundle:ios` for dependency or config changes. Report device-only items as "awaiting owner test", never as tested.
