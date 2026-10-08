import type { PhotoItem } from './media';
import { normalize, type Pose, type VisualFace, type VisualScores } from './visual-findings';

/**
 * Stored visual analysis per photo (migration 3), and how native results
 * become rows. A row counts only while the photo's version and the
 * analysis implementation are unchanged. Pure.
 */
export type VisualStatus = 'ok' | 'in-icloud' | 'missing' | 'unsupported' | 'failed';

export type VisualRow = {
  assetId: string;
  assetVersion: number | null;
  implementation: string;
  status: VisualStatus;
  featurePrint: number[] | null;
  sharpness: number | null;
  sharpnessMaxTile: number | null;
  brightness: number | null;
  darkFraction: number | null;
  brightFraction: number | null;
  faces: VisualFace[];
  poses: Pose[];
  layout: number[] | null;
  analyzedAt: number;
};

/** Shape of one native result (see modules/media-analysis). */
export type NativeAnalysis = {
  id: string;
  status: string;
  featurePrint?: number[];
  faces?: {
    quality: number;
    leftEyeOpen: number;
    rightEyeOpen: number;
    width: number;
    height: number;
  }[];
  sharpness?: number;
  sharpnessMaxTile?: number;
  brightness?: number;
  darkFraction?: number;
  brightFraction?: number;
  poses?: Record<string, [number, number]>[];
  layout?: number[];
};

const STATUSES: readonly VisualStatus[] = ['ok', 'in-icloud', 'missing', 'unsupported', 'failed'];

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function rowFromNative(
  result: NativeAnalysis,
  item: PhotoItem,
  implementation: string,
  now: number,
): VisualRow {
  const status = (STATUSES as readonly string[]).includes(result.status)
    ? (result.status as VisualStatus)
    : 'failed';
  const sharpnessMaxTile = num(result.sharpnessMaxTile);
  // An "ok" without the core measurement isn't usable.
  const usable = status === 'ok' && sharpnessMaxTile !== null;
  return {
    assetId: item.id,
    assetVersion: item.version,
    implementation,
    status: usable ? 'ok' : status === 'ok' ? 'failed' : status,
    featurePrint:
      usable && Array.isArray(result.featurePrint) && result.featurePrint.length > 0
        ? result.featurePrint.map((value) => Math.round(value * 1e5) / 1e5)
        : null,
    sharpness: usable ? num(result.sharpness) : null,
    sharpnessMaxTile: usable ? sharpnessMaxTile : null,
    brightness: usable ? num(result.brightness) : null,
    darkFraction: usable ? num(result.darkFraction) : null,
    brightFraction: usable ? num(result.brightFraction) : null,
    faces: usable
      ? (result.faces ?? []).map((face) => ({
          quality: num(face.quality) ?? -1,
          leftEyeOpen: num(face.leftEyeOpen) ?? -1,
          rightEyeOpen: num(face.rightEyeOpen) ?? -1,
          width: num(face.width) ?? 0,
          height: num(face.height) ?? 0,
        }))
      : [],
    poses: usable
      ? (result.poses ?? []).filter((pose) => typeof pose === 'object' && pose !== null)
      : [],
    layout:
      usable && Array.isArray(result.layout) && result.layout.length > 0
        ? result.layout.map((value) => Math.round(value * 1e4) / 1e4)
        : null,
    analyzedAt: now,
  };
}

/** Rows that describe the photo as it is now, with the current analysis. */
export function isCurrentVisual(row: VisualRow, item: PhotoItem, implementation: string): boolean {
  return row.implementation === implementation && row.assetVersion === item.version;
}

/** Reuse without analyzing again: only current successes (iCloud and failures are retried). */
export function isReusableVisual(row: VisualRow, item: PhotoItem, implementation: string): boolean {
  return row.status === 'ok' && isCurrentVisual(row, item, implementation);
}

export function toScores(row: VisualRow): VisualScores | null {
  if (row.status !== 'ok' || row.sharpnessMaxTile === null) return null;
  return {
    featurePrint: row.featurePrint ? normalize(row.featurePrint) : null,
    sharpness: row.sharpness ?? 0,
    sharpnessMaxTile: row.sharpnessMaxTile,
    brightness: row.brightness ?? 0.5,
    darkFraction: row.darkFraction ?? 0,
    brightFraction: row.brightFraction ?? 0,
    faces: row.faces,
    poses: row.poses,
    layout: row.layout,
  };
}

/** Photos the visual analysis looks at: photos, not screenshots. */
export function isAnalyzable(item: PhotoItem): boolean {
  return item.kind === 'photo' && !item.subtypes.includes('screenshot');
}

/** Current scores by asset id, for photos still in the catalog. */
export function currentScores(
  items: readonly PhotoItem[],
  rows: ReadonlyMap<string, VisualRow>,
  implementation: string,
): Map<string, VisualScores> {
  const map = new Map<string, VisualScores>();
  for (const item of items) {
    const row = rows.get(item.id);
    if (!row || !isCurrentVisual(row, item, implementation)) continue;
    const scores = toScores(row);
    if (scores) map.set(item.id, scores);
  }
  return map;
}

export type VisualCoverage = {
  analyzed: number;
  notAnalyzed: { reason: 'in-icloud' | 'failed' | 'not-yet'; count: number }[];
};

export const VISUAL_REASON_TEXT: Record<VisualCoverage['notAnalyzed'][number]['reason'], string> = {
  'in-icloud': 'Stored in iCloud only (not downloaded)',
  failed: 'Couldn’t be read',
  'not-yet': 'Not looked at yet',
};

export function visualCoverage(
  items: readonly PhotoItem[],
  rows: ReadonlyMap<string, VisualRow>,
  implementation: string,
): VisualCoverage {
  let analyzed = 0;
  const counts = new Map<'in-icloud' | 'failed' | 'not-yet', number>();
  const bump = (reason: 'in-icloud' | 'failed' | 'not-yet') =>
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  for (const item of items) {
    if (!isAnalyzable(item)) continue;
    const row = rows.get(item.id);
    if (!row || !isCurrentVisual(row, item, implementation)) bump('not-yet');
    else if (row.status === 'ok') analyzed += 1;
    else bump(row.status === 'in-icloud' ? 'in-icloud' : 'failed');
  }
  return {
    analyzed,
    notAnalyzed: [...counts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}
