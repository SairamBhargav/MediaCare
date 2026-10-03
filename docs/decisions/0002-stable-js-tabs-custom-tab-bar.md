# ADR-0002: Stable JS Tabs with a custom tab bar (not NativeTabs yet)

Date: 2026-10-02 · Status: accepted, revisit at Phase 3

## Context

Expo Router offers `NativeTabs` (system `UITabBarController`, Liquid Glass on iOS 26, and a `BottomAccessory` slot that matches the Apple Music mini-player pattern). In SDK 57 it is still imported from `expo-router/unstable-native-tabs`, and `BottomAccessory` is iOS 26+ only. The brief asks to avoid experimental navigation as a requirement and wants a compact active-job bar above the tab bar.

## Decision

Use the stable `Tabs` from `expo-router` with a custom `TabBar` component (`src/components/tab-bar.tsx`): blur material (solid under Reduce Transparency), SF Symbols, accessibility `tablist`/`tab` roles, instant switching. The job bar will render inside the same bottom chrome, and `useBottomChromeHeight()` gives screens the inset to respect.

## Alternatives

- `NativeTabs` now: most native look, free Liquid Glass; but unstable import path, accessory iOS 26+ only, less control over the job bar on older iOS.
- Default JS tab bar: less control over material and the accessory slot.

## Consequences

- Full control and stable API; slightly less "system" feel on iOS 26.
- Everything tab-bar-specific is in one file, so switching to `NativeTabs` later is contained. Re-evaluate when it leaves `unstable-`.
