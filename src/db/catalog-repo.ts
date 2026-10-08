import {
  FINGERPRINT_ALGORITHM,
  FINGERPRINT_REPRESENTATION,
  type FingerprintRow,
  type SkipReason,
} from '@/domain/exact-copies';
import type { PhotoRecord } from '@/domain/media';
import type { VisualRow, VisualStatus } from '@/domain/visual-records';

import { getDatabase } from './database';

/**
 * Catalog repository: the only module that writes SQL for assets, flags,
 * jobs and derivatives. Batches are written in bounded transactions so the
 * UI stays responsive during a scan.
 */
type AssetRow = {
  id: string;
  kind: string;
  creation_time: number | null;
  modification_time: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  is_favorite: number;
  subtypes: string;
  filename: string | null;
};

function parseSubtypes(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function toRecord(row: AssetRow): PhotoRecord {
  return {
    id: row.id,
    kind: row.kind === 'video' ? 'video' : 'photo',
    creationTime: row.creation_time,
    modificationTime: row.modification_time,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    isFavorite: row.is_favorite === 1,
    subtypes: parseSubtypes(row.subtypes),
    filename: row.filename,
  };
}

export async function loadAssets(): Promise<PhotoRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AssetRow>(
    'SELECT id, kind, creation_time, modification_time, width, height, duration_ms, is_favorite, subtypes, filename FROM assets ORDER BY creation_time DESC',
  );
  return rows.map(toRecord);
}

/** Version per asset id, so a rescan can skip assets that haven't changed. */
export async function loadVersions(): Promise<Map<string, number | null>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; modification_time: number | null }>(
    'SELECT id, modification_time FROM assets',
  );
  return new Map(rows.map((row) => [row.id, row.modification_time]));
}

/** Insert or update a batch and mark it as seen by this scan. */
export async function upsertAssets(records: readonly PhotoRecord[], scanId: string) {
  if (records.length === 0) return;
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const statement = await txn.prepareAsync(
      `INSERT INTO assets (id, kind, creation_time, modification_time, width, height, duration_ms, is_favorite, subtypes, filename, last_seen_scan)
       VALUES ($id, $kind, $creation, $modification, $width, $height, $duration, $favorite, $subtypes, $filename, $scan)
       ON CONFLICT(id) DO UPDATE SET
         kind = excluded.kind,
         creation_time = excluded.creation_time,
         modification_time = excluded.modification_time,
         width = excluded.width,
         height = excluded.height,
         duration_ms = excluded.duration_ms,
         is_favorite = excluded.is_favorite,
         subtypes = excluded.subtypes,
         filename = COALESCE(excluded.filename, assets.filename),
         last_seen_scan = excluded.last_seen_scan`,
    );
    try {
      for (const record of records) {
        await statement.executeAsync({
          $id: record.id,
          $kind: record.kind,
          $creation: record.creationTime,
          $modification: record.modificationTime,
          $width: record.width,
          $height: record.height,
          $duration: record.durationMs,
          $favorite: record.isFavorite ? 1 : 0,
          $subtypes: JSON.stringify(record.subtypes),
          $filename: record.filename,
          $scan: scanId,
        });
      }
    } finally {
      await statement.finalizeAsync();
    }
  });
}

/** Mark unchanged assets as seen without rewriting them. */
export async function markSeen(ids: readonly string[], scanId: string) {
  if (ids.length === 0) return;
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const statement = await txn.prepareAsync(
      'UPDATE assets SET last_seen_scan = $scan WHERE id = $id',
    );
    try {
      for (const id of ids) await statement.executeAsync({ $scan: scanId, $id: id });
    } finally {
      await statement.finalizeAsync();
    }
  });
}

/**
 * After a *complete* scan, drop assets the scan didn't see: they were
 * deleted in Photos or are no longer shared with MediaCare (limited access).
 * Never called after a stopped or failed scan.
 */
export async function removeUnseen(scanId: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'DELETE FROM assets WHERE last_seen_scan IS NULL OR last_seen_scan != ?',
    scanId,
  );
  await removeOrphanFingerprints();
  return result.changes;
}

export async function deleteAssets(ids: readonly string[]) {
  if (ids.length === 0) return;
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const statement = await txn.prepareAsync('DELETE FROM assets WHERE id = $id');
    try {
      for (const id of ids) await statement.executeAsync({ $id: id });
    } finally {
      await statement.finalizeAsync();
    }
  });
  await removeOrphanFingerprints();
}

export async function loadProtectedIds(): Promise<Set<string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ asset_id: string }>(
    'SELECT asset_id FROM asset_flags WHERE is_protected = 1',
  );
  return new Set(rows.map((row) => row.asset_id));
}

export async function setProtected(assetId: string, isProtected: boolean) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO asset_flags (asset_id, is_protected, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(asset_id) DO UPDATE SET is_protected = excluded.is_protected, updated_at = excluded.updated_at`,
    assetId,
    isProtected ? 1 : 0,
    Date.now(),
  );
}

export type ScanJobRow = {
  id: string;
  status: string;
  processed: number;
  total: number | null;
  started_at: number;
  updated_at: number;
  finished_at: number | null;
  error: string | null;
};

export type JobKind = 'library-scan' | 'copy-check' | 'visual-analysis';

export async function saveScanJob(job: {
  id: string;
  kind?: JobKind;
  status: string;
  processed: number;
  total: number | null;
  startedAt: number;
  finishedAt?: number | null;
  error?: string | null;
}) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO jobs (id, kind, status, processed, total, started_at, updated_at, finished_at, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, processed = excluded.processed,
       total = excluded.total, updated_at = excluded.updated_at, finished_at = excluded.finished_at,
       error = excluded.error`,
    job.id,
    job.kind ?? 'library-scan',
    job.status,
    job.processed,
    job.total,
    job.startedAt,
    Date.now(),
    job.finishedAt ?? null,
    job.error ?? null,
  );
}

export async function loadLastScanJob(kind: JobKind = 'library-scan'): Promise<ScanJobRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<ScanJobRow>(
    'SELECT id, status, processed, total, started_at, updated_at, finished_at, error FROM jobs WHERE kind = ? ORDER BY started_at DESC LIMIT 1',
    kind,
  );
}

/** A scan left "running" by a closed app is reported as interrupted, never as done. */
export async function markInterruptedScans() {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE jobs SET status = 'interrupted', updated_at = ? WHERE status IN ('running', 'paused')",
    Date.now(),
  );
}

export type DerivativeRow = {
  id: string;
  source_asset_id: string;
  output_asset_id: string | null;
  recipe: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  source_bytes: number | null;
  created_at: number;
};

export async function insertDerivative(row: DerivativeRow) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO derivatives (id, source_asset_id, output_asset_id, recipe, format, width, height, bytes, source_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.source_asset_id,
    row.output_asset_id,
    row.recipe,
    row.format,
    row.width,
    row.height,
    row.bytes,
    row.source_bytes,
    row.created_at,
  );
}

export async function listDerivatives(limit = 20): Promise<DerivativeRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<DerivativeRow>(
    'SELECT * FROM derivatives ORDER BY created_at DESC LIMIT ?',
    limit,
  );
}

/** Clears MediaCare's own catalog. Never touches the Photos library. */
export async function clearCatalog() {
  const db = await getDatabase();
  await db.execAsync(
    'DELETE FROM assets; DELETE FROM asset_flags; DELETE FROM jobs; DELETE FROM derivatives; DELETE FROM fingerprints; DELETE FROM visual_scores; DELETE FROM removals;',
  );
}

type FingerprintDbRow = {
  asset_id: string;
  asset_version: number | null;
  status: string;
  skip_reason: string | null;
  implementation: string;
  byte_size: number | null;
  digest: string | null;
  match_group: string | null;
  checked_at: number;
};

export async function loadFingerprints(): Promise<FingerprintRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FingerprintDbRow>(
    'SELECT asset_id, asset_version, status, skip_reason, implementation, byte_size, digest, match_group, checked_at FROM fingerprints',
  );
  return rows.map((row) => ({
    assetId: row.asset_id,
    assetVersion: row.asset_version,
    status: row.status === 'hashed' ? 'hashed' : 'skipped',
    skipReason: (row.skip_reason as SkipReason | null) ?? null,
    implementation: row.implementation,
    byteSize: row.byte_size,
    digest: row.digest,
    matchGroup: row.match_group,
    checkedAt: row.checked_at,
  }));
}

/** Writes a batch of fingerprints (or skip reasons), replacing older rows. */
export async function saveFingerprints(rows: readonly FingerprintRow[]) {
  if (rows.length === 0) return;
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const statement = await txn.prepareAsync(
      `INSERT INTO fingerprints (asset_id, asset_version, status, skip_reason, representation, algorithm, implementation, byte_size, digest, match_group, checked_at)
       VALUES ($id, $version, $status, $reason, $representation, $algorithm, $implementation, $size, $digest, NULL, $checked)
       ON CONFLICT(asset_id) DO UPDATE SET asset_version = excluded.asset_version, status = excluded.status,
         skip_reason = excluded.skip_reason, representation = excluded.representation, algorithm = excluded.algorithm,
         implementation = excluded.implementation, byte_size = excluded.byte_size, digest = excluded.digest,
         match_group = NULL, checked_at = excluded.checked_at`,
    );
    try {
      for (const row of rows) {
        await statement.executeAsync({
          $id: row.assetId,
          $version: row.assetVersion,
          $status: row.status,
          $reason: row.skipReason,
          $representation: FINGERPRINT_REPRESENTATION,
          $algorithm: FINGERPRINT_ALGORITHM,
          $implementation: row.implementation,
          $size: row.byteSize,
          $digest: row.digest,
          $checked: row.checkedAt,
        });
      }
    } finally {
      await statement.finalizeAsync();
    }
  });
}

/**
 * Records the confirmed exact-copy sets of a finished check: every match
 * group is cleared, then each set's members point at the set's first id.
 */
export async function saveMatchGroups(sets: readonly (readonly string[])[]) {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('UPDATE fingerprints SET match_group = NULL WHERE match_group IS NOT NULL');
    const statement = await txn.prepareAsync(
      'UPDATE fingerprints SET match_group = $group WHERE asset_id = $id',
    );
    try {
      for (const set of sets) {
        for (const id of set) await statement.executeAsync({ $group: set[0], $id: id });
      }
    } finally {
      await statement.finalizeAsync();
    }
  });
}

/** Records what happened to each photo in one removal. */
export async function insertRemovals(
  batchId: string,
  entries: readonly { assetId: string; outcome: string; reason: string | null }[],
) {
  if (entries.length === 0) return;
  const db = await getDatabase();
  const at = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const statement = await txn.prepareAsync(
      'INSERT INTO removals (batch_id, asset_id, outcome, reason, at) VALUES ($batch, $id, $outcome, $reason, $at)',
    );
    try {
      for (const entry of entries) {
        await statement.executeAsync({
          $batch: batchId,
          $id: entry.assetId,
          $outcome: entry.outcome,
          $reason: entry.reason,
          $at: at,
        });
      }
    } finally {
      await statement.finalizeAsync();
    }
  });
}

/** Fingerprints of photos no longer in the catalog are dropped with them. */
async function removeOrphanFingerprints() {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM fingerprints WHERE asset_id NOT IN (SELECT id FROM assets)');
  await db.runAsync('DELETE FROM visual_scores WHERE asset_id NOT IN (SELECT id FROM assets)');
}

type VisualDbRow = {
  asset_id: string;
  asset_version: number | null;
  implementation: string;
  status: string;
  feature_print: string | null;
  sharpness: number | null;
  sharpness_max_tile: number | null;
  brightness: number | null;
  dark_fraction: number | null;
  bright_fraction: number | null;
  faces: string;
  analyzed_at: number;
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadVisualRows(): Promise<VisualRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<VisualDbRow>('SELECT * FROM visual_scores');
  return rows.map((row) => ({
    assetId: row.asset_id,
    assetVersion: row.asset_version,
    implementation: row.implementation,
    status: row.status as VisualStatus,
    featurePrint: parseJson<number[] | null>(row.feature_print, null),
    sharpness: row.sharpness,
    sharpnessMaxTile: row.sharpness_max_tile,
    brightness: row.brightness,
    darkFraction: row.dark_fraction,
    brightFraction: row.bright_fraction,
    faces: parseJson(row.faces, []),
    analyzedAt: row.analyzed_at,
  }));
}

export async function saveVisualRows(rows: readonly VisualRow[]) {
  if (rows.length === 0) return;
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const statement = await txn.prepareAsync(
      `INSERT OR REPLACE INTO visual_scores (asset_id, asset_version, implementation, status, feature_print, sharpness, sharpness_max_tile, brightness, dark_fraction, bright_fraction, faces, analyzed_at)
       VALUES ($id, $version, $implementation, $status, $print, $sharpness, $maxTile, $brightness, $dark, $bright, $faces, $at)`,
    );
    try {
      for (const row of rows) {
        await statement.executeAsync({
          $id: row.assetId,
          $version: row.assetVersion,
          $implementation: row.implementation,
          $status: row.status,
          $print: row.featurePrint ? JSON.stringify(row.featurePrint) : null,
          $sharpness: row.sharpness,
          $maxTile: row.sharpnessMaxTile,
          $brightness: row.brightness,
          $dark: row.darkFraction,
          $bright: row.brightFraction,
          $faces: JSON.stringify(row.faces),
          $at: row.analyzedAt,
        });
      }
    } finally {
      await statement.finalizeAsync();
    }
  });
}
