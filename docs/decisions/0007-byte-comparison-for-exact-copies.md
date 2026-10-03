# ADR-0007: Byte comparison, not SHA-256, to confirm exact copies

Date: 2026-10-03 · Status: accepted

## Context

P2-DUP-001 hashes camera-original files with MD5 (`File.info({ md5: true })`, already in the app). MD5 alone isn't strong enough to call two photos exact copies, so STATUS.md asked for a stronger second check: SHA-256 via expo-crypto if it works in Expo Go SDK 57, otherwise a full byte comparison.

## Decision

Confirm candidates (equal size and MD5) with a full byte-by-byte comparison using expo-file-system's `FileHandle.readBytes` in 256 KB chunks. Don't add expo-crypto.

## Consequences

- Stronger than SHA-256: it proves the files are identical rather than that their hashes agree.
- No new dependency, and memory stays bounded. expo-crypto's `digest` needs the whole file in memory as one buffer.
- It runs only for candidate pairs, which are rare, so the cost is small. Any doubt (a size mismatch, a short read, an error) counts as "not identical".
- Phase 3's native module may replace both steps with streaming SHA-256 over `PHAssetResource` data.
