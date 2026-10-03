# ADR-0001: Expo SDK 57 as the baseline

Date: 2026-10-02 · Status: accepted

## Context

The owner tests in Expo Go on an iPhone. Expo Go from the App Store loads only the SDK version it was built for (generally the newest). On 2026-10-02 npm's `latest` tag for `expo` is 57.0.26; 58 is only published as `next`.

## Decision

Scaffold with `create-expo-app --template default@sdk-57` and install every SDK-managed package via `npx expo install`. Commit the lockfile. React Native 0.86.3, Reanimated 4.5.1 and Worklets 0.10.1 come from the SDK and are never bumped independently.

## Consequences

- Matches the expected App Store Expo Go (to confirm on device, assumption A2).
- When Expo Go moves to SDK 58, upgrading is a dedicated task (Expo's upgrade guide, `npx expo install --fix`), not an incidental bump.
