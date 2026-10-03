# ADR-0006: Synthetic sample media for demo mode

Date: 2026-10-02 · Status: accepted

## Context

Phase 0–1 must demonstrate the cleanup journey without photo access, without committing anyone's private photos, and without unclear image licenses.

## Decision

Generate deterministic gradient "photos" in code (`src/demo/sample-library.ts`), each with a VoiceOver description and illustrative sizes, always labelled "Sample". Licensed real photos for visual QA arrive separately (P1-UI-007) with a license file.

## Consequences

Zero licensing/privacy risk and a tiny bundle. Gradients don't stress-test the UI like real photos (busy detail, bright skies), so visual QA with real fixtures is still required before Phase 1 exits.
