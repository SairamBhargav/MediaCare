import { decodePrint, type FaceRecord, type Grouping, type Person } from '@/domain/people';

import { getDatabase } from './database';

/**
 * People repository (ADR-0011): face scans, faces with their fingerprints,
 * and people. Everything stays in MediaCare's database on this iPhone and
 * is removed by "Clear MediaCare data".
 */

export type FaceScanRow = {
  assetId: string;
  assetVersion: number | null;
  implementation: string;
  status: string;
};

/** One face as the native step returned it, ready to store. */
export type FoundFace = {
  x: number;
  y: number;
  width: number;
  height: number;
  quality: number;
  applePrint: string | null;
  modelPrint: string | null;
};

export type FaceScanResult = {
  assetId: string;
  assetVersion: number | null;
  status: string;
  faces: readonly FoundFace[];
};

export async function loadFaceScans(): Promise<FaceScanRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    asset_id: string;
    asset_version: number | null;
    implementation: string;
    status: string;
  }>('SELECT asset_id, asset_version, implementation, status FROM face_scans');
  return rows.map((row) => ({
    assetId: row.asset_id,
    assetVersion: row.asset_version,
    implementation: row.implementation,
    status: row.status,
  }));
}

type StoredFace = {
  id: number;
  asset_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  quality: number;
  apple_print: string | null;
  model_print: string | null;
  person_id: number | null;
  confirmed: number;
  rejected_person_id: number | null;
};

/** Overlap of two face boxes, 0–1. */
function overlap(a: FoundFace | StoredFace, b: FoundFace | StoredFace): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (width <= 0 || height <= 0) return 0;
  const shared = width * height;
  return shared / (a.width * a.height + b.width * b.height - shared);
}

/**
 * Stores a batch of face scans. A photo looked at again (edited, or a newer
 * method) gets its faces replaced; each new face at the same place as an
 * old one keeps that face's person and the user's corrections.
 */
export async function saveFaceScans(
  results: readonly FaceScanResult[],
  implementation: string,
  now: number,
) {
  if (results.length === 0) return;
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const result of results) {
      const previous = await txn.getAllAsync<StoredFace>(
        'SELECT * FROM faces WHERE asset_id = ?',
        result.assetId,
      );
      await txn.runAsync('DELETE FROM faces WHERE asset_id = ?', result.assetId);
      for (const [index, face] of result.faces.entries()) {
        const match = previous.find((old) => overlap(old, face) > 0.5);
        await txn.runAsync(
          `INSERT INTO faces (asset_id, face_index, x, y, width, height, quality, apple_print, model_print, person_id, confirmed, rejected_person_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          result.assetId,
          index,
          face.x,
          face.y,
          face.width,
          face.height,
          face.quality,
          face.applePrint,
          face.modelPrint,
          match?.person_id ?? null,
          match?.confirmed ?? 0,
          match?.rejected_person_id ?? null,
        );
      }
      await txn.runAsync(
        `INSERT OR REPLACE INTO face_scans (asset_id, asset_version, implementation, status, scanned_at)
         VALUES (?, ?, ?, ?, ?)`,
        result.assetId,
        result.assetVersion,
        implementation,
        result.status,
        now,
      );
    }
  });
}

/**
 * Faces, with fingerprints only when asked (grouping needs them; the
 * People screens don't, and decoding thousands is slow).
 */
export async function loadFaces({ prints = false } = {}): Promise<FaceRecord[]> {
  const db = await getDatabase();
  const columns = prints
    ? '*'
    : 'id, asset_id, x, y, width, height, quality, NULL AS apple_print, NULL AS model_print, person_id, confirmed, rejected_person_id';
  const rows = await db.getAllAsync<StoredFace>(`SELECT ${columns} FROM faces`);
  return rows.map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    box: { x: row.x, y: row.y, width: row.width, height: row.height },
    quality: row.quality,
    applePrint: decodePrint(row.apple_print),
    modelPrint: decodePrint(row.model_print),
    personId: row.person_id,
    confirmed: row.confirmed === 1,
    rejectedPersonId: row.rejected_person_id,
  }));
}

export async function loadPeople(): Promise<Person[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    name: string | null;
    hidden: number;
    created_at: number;
  }>('SELECT * FROM people');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    hidden: row.hidden === 1,
    createdAt: row.created_at,
  }));
}

/** Stores a grouping: new people are created, faces get their person. */
export async function saveGrouping(grouping: Grouping, now: number) {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const [faceId, personId] of grouping.toExisting) {
      await txn.runAsync('UPDATE faces SET person_id = ? WHERE id = ?', personId, faceId);
    }
    for (const faceIds of grouping.newPeople) {
      const { lastInsertRowId } = await txn.runAsync(
        'INSERT INTO people (name, hidden, created_at) VALUES (NULL, 0, ?)',
        now,
      );
      for (const faceId of faceIds) {
        await txn.runAsync('UPDATE faces SET person_id = ? WHERE id = ?', lastInsertRowId, faceId);
      }
    }
  });
}

export async function renamePerson(personId: number, name: string | null) {
  const db = await getDatabase();
  const trimmed = name?.trim() || null;
  await db.runAsync('UPDATE people SET name = ? WHERE id = ?', trimmed, personId);
}

export async function setPersonHidden(personId: number, hidden: boolean) {
  const db = await getDatabase();
  await db.runAsync('UPDATE people SET hidden = ? WHERE id = ?', hidden ? 1 : 0, personId);
}

/** Moves every face of `fromId` to `intoId`; keeps `intoId`'s name, or takes `fromId`'s if it has none. */
export async function mergePeople(fromId: number, intoId: number) {
  if (fromId === intoId) return;
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE people SET name = COALESCE(name, (SELECT name FROM people WHERE id = ?)) WHERE id = ?`,
      fromId,
      intoId,
    );
    await txn.runAsync('UPDATE faces SET person_id = ? WHERE person_id = ?', intoId, fromId);
    await txn.runAsync(
      'UPDATE faces SET rejected_person_id = ? WHERE rejected_person_id = ?',
      intoId,
      fromId,
    );
    await txn.runAsync('DELETE FROM people WHERE id = ?', fromId);
  });
}

/** "Not this person" for the faces of `personId` in these photos; they're never grouped with them again. */
export async function rejectFromPerson(personId: number, assetIds: readonly string[]) {
  if (assetIds.length === 0) return;
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const assetId of assetIds) {
      await txn.runAsync(
        `UPDATE faces SET person_id = NULL, confirmed = 0, rejected_person_id = ?
         WHERE person_id = ? AND asset_id = ?`,
        personId,
        personId,
        assetId,
      );
    }
    await txn.runAsync(
      'DELETE FROM people WHERE id = ? AND NOT EXISTS (SELECT 1 FROM faces WHERE person_id = ?)',
      personId,
      personId,
    );
  });
}
