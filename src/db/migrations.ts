/**
 * Versioned schema migrations, applied in order inside one exclusive
 * transaction; `PRAGMA user_version` records the applied version. Append
 * new migrations; never edit an applied one. Design notes: docs/DATA_MODEL.md.
 *
 * The catalog holds metadata only (dates, dimensions, flags). It never
 * stores image bytes, thumbnails or locations.
 */
export const MIGRATIONS: readonly string[] = [
  // 1: assets, user flags that survive rescans, scan jobs, derivatives (copies made).
  `
  CREATE TABLE assets (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    creation_time INTEGER,
    modification_time INTEGER,
    width INTEGER,
    height INTEGER,
    duration_ms INTEGER,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    subtypes TEXT NOT NULL DEFAULT '[]',
    filename TEXT,
    last_seen_scan TEXT
  );
  CREATE INDEX idx_assets_creation ON assets (creation_time DESC);

  CREATE TABLE asset_flags (
    asset_id TEXT PRIMARY KEY NOT NULL,
    is_protected INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE jobs (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    processed INTEGER NOT NULL DEFAULT 0,
    total INTEGER,
    started_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    finished_at INTEGER,
    error TEXT
  );

  CREATE TABLE derivatives (
    id TEXT PRIMARY KEY NOT NULL,
    source_asset_id TEXT NOT NULL,
    output_asset_id TEXT,
    recipe TEXT NOT NULL,
    format TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    bytes INTEGER NOT NULL,
    source_bytes INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_derivatives_created ON derivatives (created_at DESC);
  `,
];
