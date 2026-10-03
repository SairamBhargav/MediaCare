/**
 * The app's view of one photo or video, whether it comes from the sample
 * library or from the iPhone's Photos library. Pure types and helpers.
 *
 * Honest-data rules:
 *  - `bytes` is null when the size has not been measured. Real photos are
 *    cataloged without reading their files, so their size is unknown until
 *    something (an export) measures it.
 *  - Photos reports a capture *instant* without the original time zone, so
 *    real capture dates are expressed in this iPhone's current zone and
 *    labelled as such (`dateSource`).
 */
export type MediaKind = 'photo' | 'video';

export type PhotoItem = {
  readonly id: string;
  readonly source: 'photos';
  readonly kind: MediaKind;
  /** ISO 8601 with this device's offset at catalog time, or null if Photos has no date. */
  readonly capturedAt: string | null;
  /** Exact capture instant in ms (Photos keeps milliseconds; the ISO string drops them). */
  readonly capturedMs: number | null;
  readonly dateSource: 'photos-creation-time' | 'unknown';
  readonly width: number;
  readonly height: number;
  readonly bytes: null;
  readonly durationMs: number | null;
  readonly isFavorite: boolean;
  readonly subtypes: readonly string[];
  readonly filename: string | null;
  /** Photos' modification time, used to notice edits since the last scan. */
  readonly version: number | null;
  readonly description: string;
};

/** Raw fields as stored in the catalog or read from Photos metadata. */
export type PhotoRecord = {
  id: string;
  kind: MediaKind;
  creationTime: number | null;
  modificationTime: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  isFavorite: boolean;
  subtypes: readonly string[];
  filename: string | null;
};

function pad(value: number, length = 2): string {
  return String(Math.trunc(Math.abs(value))).padStart(length, '0');
}

/**
 * ISO 8601 for an instant in the device's local zone, with offset, e.g.
 * "2026-09-27T19:42:10-04:00". The timeline reads the wall-clock part, so
 * this is the date a person on this iPhone would expect.
 */
export function toLocalIso(ms: number, offsetMinutes = -new Date(ms).getTimezoneOffset()): string {
  const local = new Date(ms + offsetMinutes * 60_000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  return (
    `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}` +
    `${sign}${pad(offsetMinutes / 60)}:${pad(offsetMinutes % 60)}`
  );
}

const describeDate = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** VoiceOver description, e.g. "Screenshot, September 27, 2026 at 7:42 PM". */
export function describeRecord(record: PhotoRecord): string {
  const what =
    record.kind === 'video'
      ? `Video${record.durationMs ? `, ${formatDuration(record.durationMs)}` : ''}`
      : record.subtypes.includes('screenshot')
        ? 'Screenshot'
        : record.subtypes.includes('panorama')
          ? 'Panorama'
          : 'Photo';
  const when =
    record.creationTime === null ? 'no date' : describeDate.format(new Date(record.creationTime));
  return `${what}, ${when}`;
}

export function toPhotoItem(record: PhotoRecord): PhotoItem {
  return {
    id: record.id,
    source: 'photos',
    kind: record.kind,
    capturedAt: record.creationTime === null ? null : toLocalIso(record.creationTime),
    capturedMs: record.creationTime,
    dateSource: record.creationTime === null ? 'unknown' : 'photos-creation-time',
    width: record.width ?? 0,
    height: record.height ?? 0,
    bytes: null,
    durationMs: record.durationMs,
    isFavorite: record.isFavorite,
    subtypes: record.subtypes,
    filename: record.filename,
    version: record.modificationTime,
    description: describeRecord(record),
  };
}
