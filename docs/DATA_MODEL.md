# Data model

Planned catalog for Phase 2–3, stored in SQLite (`expo-sqlite`) with hand-written, versioned migrations (ADR-0003). Nothing here is implemented yet except the pure review-selection rules in `src/domain/review-selection.ts`. (Preferences already use `expo-sqlite/kv-store`, a separate key-value database, not this catalog.)

## Identity and resource semantics (read this first)

An iOS Photos asset is **not** a file. For one asset there can be:

- the **local identifier** (stable-ish id, can disappear when the asset is deleted or access is revoked),
- the **original resource** (camera bytes: HEIC/JPEG/RAW),
- an **edited rendition** (after Photos edits; originals are retained by Photos),
- **paired resources** (Live Photo video, RAW+JPEG),
- **previews/thumbnails** we render.

Rules:

1. Every fingerprint records **which representation** it was computed from. A hash of a preview or a converted picker result is never treated as a hash of the original.
2. "Exact duplicate" means identical bytes of the same representation type for **all** required resources of the asset. Compound assets (Live Photo, RAW pair, unknown resource set) are excluded from exact-duplicate removal until their full resource set is compared.
3. App-level **Protected** is separate from the Photos **favorite** flag. If favorites cannot be read, the UI says so instead of claiming favorites were excluded.
4. Cached URIs may expire. Resolve again before use; never trust a stale path.

## Entities

```
asset 1─* resource 1─* fingerprint
asset *─* similarity_group (via group_member)
asset 1─* finding
asset 1─* derivative (as source)        job 1─* job_item
action_plan 1─* action_item ─ result     setting (key/value)
```

### asset

| Column                        | Type         | Notes                                                          |
| ----------------------------- | ------------ | -------------------------------------------------------------- |
| id                            | TEXT PK      | App id (uuid)                                                  |
| source                        | TEXT         | `photos` · `picker` · `sample`                                 |
| source_id                     | TEXT         | Photos local identifier                                        |
| source_version                | TEXT         | Modification date / change token; changes invalidate analysis  |
| media_type                    | TEXT         | `photo` · `video`                                              |
| subtypes                      | TEXT (JSON)  | live, hdr, panorama, screenshot, burst…                        |
| width, height, orientation    | INTEGER      |                                                                |
| duration_ms                   | INTEGER NULL | video                                                          |
| captured_at                   | TEXT NULL    | ISO 8601 with offset if known                                  |
| captured_at_source            | TEXT         | `user` · `exif` · `photos_creation` · `file_mtime` · `unknown` |
| tz_known                      | INTEGER      | 0 if offset unknown (kept unknown, not guessed)                |
| is_favorite                   | INTEGER NULL | NULL = could not read                                          |
| is_protected                  | INTEGER      | App-level protection                                           |
| availability                  | TEXT         | `local` · `cloud_only` · `unavailable` · `gone`                |
| logical_bytes                 | INTEGER NULL | Size of original resource if known                             |
| last_seen_at, last_scanned_at | TEXT         |                                                                |
|                               |              | INDEX(captured_at), UNIQUE(source, source_id)                  |

### resource

`id, asset_id → asset, kind (original|edited|preview|paired_video|raw), locator (nullable, may expire), version, bytes, uti/format, identity_evidence (how we know it is the original)`. INDEX(asset_id, kind).

### fingerprint

`id, resource_id → resource, asset_version, algorithm (sha256|dhash64|phash64|embedding:v1), implementation_version, params (JSON: normalization size, color space), value (BLOB/TEXT), computed_at`. INDEX(algorithm, value) for exact lookups; perceptual lookups use bucketed prefixes (no all-pairs scans).

### finding

`id, asset_id, type (exact_duplicate|similar|blur|exposure|corrupt|large|red_eye), region (JSON, nullable), time_range (video, nullable), evidence (JSON), score, score_meaning (e.g. "laplacian variance at 512px, not a probability"), detector_version, decision (none|keep|ignore|protect|review_removal), decided_at`.

### similarity_group / group_member

Group: `id, method (sha256|phash|embedding), representative_asset_id, recommended_keeper_id, keeper_rationale (JSON), created_with_version, dismissed_at`.
Member: `group_id, asset_id, pair_evidence_vs_representative (JSON), user_keeper (bool)`. Similarity is not transitive: evidence is always pairwise against the representative.

### derivative (edit recipe + output)

`id, source_asset_id, source_version, recipe (JSON operations), processing_versions, output_locator, output_asset_id (if saved to Photos), format, width, height, bytes, verified (decoded OK + constraints met), verification_report, created_at`.

### job / job_item (checkpoints)

Job: `id, kind (index|hash|analyze|export|cleanup), inputs (JSON), versions, status (queued|running|paused|interrupted|succeeded|failed|canceled), stage, processed, total (nullable = indeterminate), retry_key (unique), error, timestamps`.
Item: `job_id, asset_id, status, result, error`. On launch, `running` jobs become `interrupted` and resume from the last committed item. A job marked running never implies success.

### action_plan / action_item

Plan: `id, created_at, scope_summary, logical_bytes, warnings (iCloud sync, compound assets), confirmed_at`.
Item: `plan_id, asset_id, expected_source_version, expected_bytes, keeper_asset_id, precheck (ok|changed|missing|keeper_missing), result (removed|cancelled|failed|already_gone), os_error`. Retries are idempotent by `(plan_id, asset_id)`.

### setting

`key TEXT PK, value TEXT (JSON)`. Appearance, motion, haptics, consent, cache limits. Never media content.

## Storage accounting fields

Tracked separately and never conflated: potential savings (logical bytes of selected originals), derivative bytes added, bytes moved to Recently Deleted (OS-reported where available), bytes confirmed removed, app cache/temp usage, unknown/unmeasurable. Overlapping findings are de-duplicated by asset (`sumUniqueBytes`).

## Migrations and invalidation

- `src/db/migrations/0001_init.sql`, `0002_*.sql`… applied in a transaction on launch; `PRAGMA user_version` tracks the version; foreign keys on.
- Bounded transactions (≤ 500 rows) during indexing so the UI stays responsive.
- Asset `source_version` change → delete its fingerprints and findings, re-queue analysis.
- Detector/algorithm version bump → mark affected findings stale; recompute lazily.
- User dismissals persist until the involved assets or the algorithm version change.
- "Clear app data" deletes the catalog and caches only; it never touches Photos.
