# ADR-0008: No removal in release builds until proven

Date: 2026-10-09 · Status: accepted

## Context

Safe removal (P3-DEL-001) is built: off by default, revalidated, confirmed by iOS, outcomes recorded. It has not yet been exercised on purpose-made test photos on a device. The first TestFlight build goes to family testers whose libraries are real and personal (STATUS.md, ROADMAP release boundaries).

## Decision

`REMOVAL_IN_THIS_BUILD = __DEV__` (`src/features/clean/removal-gate.ts`). Release builds (TestFlight, App Store) hide the "Allow removing photos" switch and the removal plan can't run, whatever the stored preference says. Development builds keep the switch so the owner can prove removal on purpose-made photos.

## Consequences

- Testers can review findings and use the plan as a list, then remove photos in the Photos app themselves if they want.
- Turning removal on for testers is a one-line change plus a new build, made only after the device proof and the owner's go-ahead, recorded in a new ADR.
