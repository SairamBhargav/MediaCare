# ADR-0003: SQLite catalog with hand-written migrations, no ORM

Date: 2026-10-02 · Status: accepted (implementation in Phase 2)

## Context

The app needs an indexed, persistent catalog of assets, resources, fingerprints, findings, groups, jobs and actions (DATA_MODEL.md), working in Expo Go.

## Decision

`expo-sqlite` with numbered `.sql` migrations tracked by `PRAGMA user_version`, foreign keys on, thin typed repository functions in `src/db/`. Zustand holds UI state only. Preferences move to `expo-sqlite/kv-store`.

## Alternatives

Drizzle (nice types, extra tooling and migration generator), WatermelonDB (needs native setup beyond Expo Go), AsyncStorage/JSON (no indexes, unsafe at 10k+ rows).

## Consequences

Transparent SQL that is easy to review for safety-critical queries; slightly more boilerplate. Revisit if the schema grows past what hand-written repositories handle cleanly.
