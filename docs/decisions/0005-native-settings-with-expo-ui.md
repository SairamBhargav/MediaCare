# ADR-0005: Settings uses @expo/ui native controls

Date: 2026-10-02 · Status: accepted, verify on device

## Context

Settings is a short, fixed list of toggles and choices: exactly what iOS's own Settings app does well. `@expo/ui` (in the SDK 57 template) renders a real SwiftUI `Form`, and its universal layer is documented as working in Expo Go since SDK 56.

## Decision

Render the Settings body with `@expo/ui` `Host` + `FieldGroup` + `Switch` + `Picker`; keep the sheet's header in our own components. Custom RN components remain the design system for everything content-led (photos, cards, review).

## Consequences

Native switch/menu behavior, Dynamic Type and VoiceOver for free. Risk R7: if a control misbehaves in Expo Go on the owner's iPhone, replace that row with an RN equivalent.
