# Privacy and safety

These rules override convenience. Code reviews check them.

## Access

- No account. No upload of photos, thumbnails, filenames, hashes, locations or face data to any MediaCare server. There is no server.
- Photo access is requested only after an explicit user action, with an explanation first. **Limited access is a valid mode**, not an error; offer "Manage selected photos" and never nag.
- iCloud-optimized originals may need network to read. The app asks before fetching large batches, bounds temporary storage, and shows how many items need download. Local-first means "no upload to us", not "always offline".
- Sample mode uses synthetic images only and is labelled everywhere.

## Removal (Phase 3+)

1. Nothing is removed automatically, ever, for any reason (blurry, duplicate, low score).
2. Every cleanup group keeps at least one verified accessible original. The keeper can't be selected (enforced in `src/domain/review-selection.ts` and tested).
3. Protected items and, when readable, favorites are never selected by default; if favorites can't be read, the UI says so.
4. Before execution, the user sees an **action plan**: exact items, keeper, reason, logical bytes, compound-asset warnings, and this warning: _"If iCloud Photos is on, removing here also removes these from your other devices."_ (We can't always detect sync settings, so we always say it.)
5. Before calling the OS: revalidate existence, version, size and keeper presence; re-hash changed sources; skip anything that changed and report it.
6. Deletion goes through the iOS Photos API, which shows its own confirmation. Cancel, denial and partial success are recorded per item.
7. Recovery: we point to **Photos → Albums → Recently Deleted**. The retention period is Apple's; check it rather than hard-coding a promise. No fake in-app restore. "Undo" exists only for unsubmitted review choices.
8. Compound assets (Live Photos, RAW+JPEG, bursts, unknown resource sets) are excluded from exact-duplicate removal until their full resource set is compared.
9. We never edit the Photos database, never move files to "sort" them, and never touch paths outside granted sources.

## Editing and exports

- Originals are never modified. Outputs are new files with lineage (source, operations, versions).
- Copies made with the Phase 2 exporter keep orientation but **not** the capture date or location (verified on device 2026-10-03). The app says so before you make a copy. Preserving metadata needs native code (Phase 3).
- An export is accepted only after it decodes and meets requested constraints (dimensions, bytes). Insufficient disk is handled; temp files are cleaned.
- Transparency, HDR, high bit depth, animation and paired media are never flattened silently. A transparent PNG becomes JPEG only with a chosen background and confirmation.
- GPS: "Remove location when sharing" is offered separately from archival metadata preservation.

## Honest storage accounting

Different numbers, never mixed up:

| Term shown                    | Meaning                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| "Could free up to X"          | Logical bytes of selected originals, de-duplicated by asset             |
| "Moved X to Recently Deleted" | What the OS reports removed into Recently Deleted                       |
| "Freed X"                     | Only when a measured free-space change confirms it; otherwise not shown |
| "Copy is X (saved Y)"         | Real encoded bytes; a copy **adds** storage while the original exists   |
| "Unknown"                     | When we can't measure. Never guessed                                    |

MB = 1,000,000 bytes (matches iOS Settings). MiB is shown only where explicitly relevant.

## Local data

- The catalog is sensitive. It lives in the app sandbox with iOS data protection; caches are bounded.
- "Clear app data" removes the catalog, caches and temp files. It never deletes Photos assets, and the UI says so.
- Telemetry, if ever added: opt-in, aggregate, no media content, filenames, hashes, locations or face data; crash reports scrubbed of the same.
- No training on private media.

## Remote processing (only if chosen later)

Before any upload: name the processor, what files, expected cost, retention, and how to cancel/delete. Short retention target, documented backup limitations. No claim of end-to-end secrecy from a server that must decode images. Secrets stay on the backend, never in `EXPO_PUBLIC_*`.

## Passport / ID workflow (Phase 5)

Rules are versioned by country, document type, channel and age group, with official URL and review date. Only officially permitted geometric formatting is enabled. No beautification, generated backgrounds, face reconstruction or red-eye retouching inside the compliance flow (current U.S. guidance rejects digitally altered photos; advise a retake). Never promise acceptance.
