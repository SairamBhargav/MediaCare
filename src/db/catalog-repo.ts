import type { PhotoRecord } from '@/domain/media';

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

export async function saveScanJob(job: {
  id: string;
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
     VALUES (?, 'library-scan', ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, processed = excluded.processed,
       total = excluded.total, updated_at = excluded.updated_at, finished_at = excluded.finished_at,
       error = excluded.error`,
    job.id,
    job.status,
    job.processed,
    job.total,
    job.startedAt,
    Date.now(),
    job.finishedAt ?? null,
    job.error ?? null,
  );
}

export async function loadLastScanJob(): Promise<ScanJobRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<ScanJobRow>(
    "SELECT id, status, processed, total, started_at, updated_at, finished_at, error FROM jobs WHERE kind = 'library-scan' ORDER BY started_at DESC LIMIT 1",
  );
}

/** A scan left "running" by a closed app is reported as interrupted, never as done. */
export async function markInterruptedScans() {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE jobs SET status = 'interrupted', updated_at = ? WHERE kind = 'library-scan' AND status IN ('running', 'paused')",
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
    'DELETE FROM assets; DELETE FROM asset_flags; DELETE FROM jobs; DELETE FROM derivatives;',
  );
}
