import { formatBytes } from './bytes';

/** What the compare view needs to know about one photo. */
export type ComparablePhoto = {
  readonly id: string;
  readonly capturedAt: string | null;
  /** Exact instant when known; preferred over the ISO string, which drops milliseconds. */
  readonly capturedMs?: number | null;
  readonly width: number;
  readonly height: number;
  /** Null when not measured; then no size difference is claimed. */
  readonly bytes: number | null;
};

function instantOf(photo: ComparablePhoto): number | null {
  if (photo.capturedMs !== undefined && photo.capturedMs !== null) return photo.capturedMs;
  if (!photo.capturedAt) return null;
  const ms = Date.parse(photo.capturedAt);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Plain-language differences between a photo and the keeper, e.g.
 * "2 s later", "240 KB larger", "Same dimensions". Pure and deterministic so
 * the explanation a person reads can be tested.
 */
export function describeDifferences(photo: ComparablePhoto, keeper: ComparablePhoto): string[] {
  if (photo.id === keeper.id) return ['This is the keeper'];
  const lines: string[] = [];

  const photoAt = instantOf(photo);
  const keeperAt = instantOf(keeper);
  const seconds =
    photoAt !== null && keeperAt !== null ? Math.round((photoAt - keeperAt) / 1000) : Number.NaN;
  const subSecond = photoAt !== null && keeperAt !== null ? photoAt - keeperAt : 0;
  if (Number.isFinite(seconds)) {
    if (seconds === 0 && subSecond === 0) lines.push('Taken at the same moment');
    else if (seconds === 0) lines.push(`Less than a second ${subSecond > 0 ? 'later' : 'earlier'}`);
    else lines.push(`${formatDuration(Math.abs(seconds))} ${seconds > 0 ? 'later' : 'earlier'}`);
  }

  if (photo.bytes !== null && keeper.bytes !== null) {
    const bytes = photo.bytes - keeper.bytes;
    if (bytes === 0) lines.push('Same file size');
    else lines.push(`${formatBytes(Math.abs(bytes))} ${bytes > 0 ? 'larger' : 'smaller'}`);
  }

  lines.push(
    photo.width === keeper.width && photo.height === keeper.height
      ? 'Same dimensions'
      : `${photo.width} × ${photo.height} vs ${keeper.width} × ${keeper.height}`,
  );
  return lines;
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}
