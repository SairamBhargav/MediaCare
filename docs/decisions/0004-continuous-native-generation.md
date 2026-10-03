# ADR-0004: Native directories are generated, never hand-edited

Date: 2026-10-02 · Status: accepted

## Context

Without a Mac, nobody can open Xcode to maintain an `ios/` project, and hand edits are lost on regeneration.

## Decision

Use Continuous Native Generation. `ios/` and `android/` are git-ignored and produced by `expo prebuild` on EAS. Native configuration lives in `app.json` and config plugins; custom native code lives in a local Expo module (planned `modules/media-native/`, Swift) added in Phase 3.

## Consequences

Reproducible cloud builds from Windows. Any native need must be expressible as a config plugin or Expo module; that is a deliberate constraint.
