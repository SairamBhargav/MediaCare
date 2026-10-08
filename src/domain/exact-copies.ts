import type { GroupFinding } from './findings';
import type { PhotoItem } from './media';

/**
 * Exact copies (P2-DUP-001): photos whose files are identical, byte for
 * byte. Pure rules; the job that reads files lives in
 * services/scan/copy-check.ts.
 *
 * What makes a claim honest here:
 *  - Only files proven to be the camera original are fingerprinted. The
 *    file iOS hands over must sit in the camera roll folder
 *    (`…/DCIM/100APPLE/IMG_0212.HEIC`) and carry the photo's own file name.
 *    Edited photos come back as a rendered `FullSizeRender` file elsewhere,
 *    so they fail this test and are reported, not guessed about.
 *  - Live Photos are excluded: they are a photo plus a video, and only the
 *    photo half would be compared.
 *  - Photos stored only in iCloud are skipped so nothing downloads.
 *  - Equal size and MD5 only make a *candidate*. A pair is called an exact
 *    copy only after a full byte-by-byte comparison.
 *
 * In the MediaCare app build a stronger method is used (ORIGINALS_METHOD):
 * every file Photos keeps for a photo (original, edits, a Live Photo's
 * video) is streamed through SHA-256 natively. Two photos are exact copies
 * only if all of those files are identical, so edited and Live Photos are
 * covered too.
 */

/** Bump when anything about how fingerprints are taken changes; old ones are then ignored. */
export const FINGERPRINT_IMPLEMENTATION = 'getUri-dcim-original/md5/v1';
export const FINGERPRINT_REPRESENTATION = 'camera-original-file';
export const FINGERPRINT_ALGORITHM = 'md5';

/** Larger files aren't hashed: in Expo Go hashing runs on the app's main JS thread. */
export const MAX_FINGERPRINT_BYTES = 64_000_000;

export type SkipReason =
  | 'unavailable'
  | 'video'
  | 'live-photo'
  | 'no-filename'
  | 'in-icloud'
  | 'not-original-file'
  | 'too-large'
  | 'unreadable';

export const SKIP_REASON_TEXT: Record<SkipReason | 'not-yet', string> = {
  unavailable: 'In iCloud only or couldn’t be read (nothing downloaded)',
  video: 'Videos aren’t checked',
  'live-photo': 'Live Photos aren’t checked yet (photo and video together)',
  'no-filename': 'No file name from Photos',
  'in-icloud': 'Stored in iCloud only (not downloaded)',
  'not-original-file': 'Edited, or not the original camera file',
  'too-large': 'Over 64 MB',
  unreadable: 'Couldn’t be read',
  'not-yet': 'Not checked yet',
};

/** Reasons decided from metadata alone, before touching any file. */
export function metadataSkipReason(item: PhotoItem): SkipReason | null {
  if (item.kind !== 'photo') return 'video';
  if (item.subtypes.includes('livePhoto')) return 'live-photo';
  if (!item.filename) return 'no-filename';
  return null;
}

/** How fingerprints are taken; stored rows from another method are ignored. */
export type FingerprintMethod = {
  implementation: string;
  representation: string;
  algorithm: string;
  /** Reasons decided from metadata alone. */
  metadataSkip: (item: PhotoItem) => SkipReason | null;
  /** True when equal digests prove identical files (SHA-256 of every resource). */
  digestIsProof: boolean;
};

/** Expo Go and older builds: the camera-original file via getUri, MD5 + byte comparison. */
export const FILE_MD5_METHOD: FingerprintMethod = {
  implementation: FINGERPRINT_IMPLEMENTATION,
  representation: FINGERPRINT_REPRESENTATION,
  algorithm: FINGERPRINT_ALGORITHM,
  metadataSkip: metadataSkipReason,
  digestIsProof: false,
};

/** MediaCare app build: SHA-256 of every Photos resource (original, edits, Live Photo video). */
export const ORIGINALS_METHOD: FingerprintMethod = {
  implementation: 'photokit-resources/sha256/v1',
  representation: 'all-original-resources',
  algorithm: 'sha256',
  metadataSkip: (item) => (item.kind !== 'photo' ? 'video' : null),
  digestIsProof: true,
};

/** One resource as hashed natively (PHAssetResourceType raw value). */
export type HashedResource = { type: number; bytes: number; sha256: string };

/**
 * A single comparable key for a photo's whole resource set, and its total
 * bytes. Order-independent: resources are sorted by type, then digest.
 */
export function resourceSetDigest(resources: readonly HashedResource[]): {
  digest: string;
  bytes: number;
} {
  const parts = resources
    .map((resource) => `${resource.type}:${resource.bytes}:${resource.sha256}`)
    .sort();
  return {
    digest: parts.join('|'),
    bytes: resources.reduce((sum, resource) => sum + resource.bytes, 0),
  };
}

/** Camera roll folder: …/DCIM/100APPLE/<name>, …/DCIM/101APPLE/<name>, … */
const CAMERA_ROLL_FILE = /\/DCIM\/\d{3}[A-Z_]+\/([^/]+)$/;

/**
 * True only when the file iOS returned is the photo's original camera file:
 * in the camera roll folder, not under Photos' edit storage ("Mutations"),
 * with exactly the file name Photos reports for the asset.
 */
export function provesCameraOriginal(uri: string, filename: string | null): boolean {
  if (!filename) return false;
  let path: string;
  try {
    path = decodeURIComponent(uri.replace(/^file:\/\//, ''));
  } catch {
    return false;
  }
  if (path.includes('/Mutations/')) return false;
  const match = CAMERA_ROLL_FILE.exec(path);
  return match !== null && match[1] === filename;
}

/** A stored fingerprint, or a stored reason a photo wasn't fingerprinted. */
export type FingerprintRow = {
  assetId: string;
  /** Photos' modification time when checked; a different value means the photo changed. */
  assetVersion: number | null;
  status: 'hashed' | 'skipped';
  skipReason: SkipReason | null;
  implementation: string;
  byteSize: number | null;
  digest: string | null;
  /** Id of the confirmed exact-copy set this file belongs to, if any. */
  matchGroup: string | null;
  checkedAt: number;
};

/** Whether a stored row still describes the photo as it is now. */
export function isCurrent(
  row: FingerprintRow,
  item: PhotoItem,
  implementation: string = FINGERPRINT_IMPLEMENTATION,
): boolean {
  return row.implementation === implementation && row.assetVersion === item.version;
}

/**
 * Rows worth reusing without reading the file again. Skips that can change
 * on their own (iCloud download state, read errors) are always rechecked.
 */
export function isReusable(
  row: FingerprintRow,
  item: PhotoItem,
  implementation: string = FINGERPRINT_IMPLEMENTATION,
): boolean {
  if (!isCurrent(row, item, implementation)) return false;
  return (
    row.status === 'hashed' ||
    row.skipReason === 'not-original-file' ||
    row.skipReason === 'too-large'
  );
}

/** Candidate sets: two or more hashed files with the same size and digest. */
export function candidateSets(rows: readonly FingerprintRow[]): string[][] {
  const byKey = new Map<string, string[]>();
  for (const row of rows) {
    if (row.status !== 'hashed' || row.digest === null || row.byteSize === null) continue;
    const key = `${row.byteSize}:${row.digest}`;
    const ids = byKey.get(key);
    if (ids) ids.push(row.assetId);
    else byKey.set(key, [row.assetId]);
  }
  return [...byKey.values()].filter((ids) => ids.length >= 2).map((ids) => ids.sort());
}

/**
 * Splits a candidate set into sets of files that are really identical,
 * comparing each file with the first file of each set found so far. Only
 * sets of two or more are returned; a candidate that matches nothing (a hash
 * collision, or a file that changed mid-check) is dropped.
 */
export async function confirmSet(
  ids: readonly string[],
  identical: (a: string, b: string) => Promise<boolean>,
): Promise<string[][]> {
  const sets: string[][] = [];
  for (const id of ids) {
    let placed = false;
    for (const set of sets) {
      if (await identical(set[0], id)) {
        set.push(id);
        placed = true;
        break;
      }
    }
    if (!placed) sets.push([id]);
  }
  return sets.filter((set) => set.length >= 2);
}

/** Byte comparison of two chunks. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

/** Confirmed sets from stored rows: current rows sharing a match group. */
export function confirmedSets(
  rows: readonly FingerprintRow[],
  byId: ReadonlyMap<string, PhotoItem>,
  implementation: string = FINGERPRINT_IMPLEMENTATION,
): string[][] {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const item = byId.get(row.assetId);
    if (
      !item ||
      row.matchGroup === null ||
      row.status !== 'hashed' ||
      !isCurrent(row, item, implementation)
    ) {
      continue;
    }
    const members = groups.get(row.matchGroup);
    if (members) members.push(row.assetId);
    else groups.set(row.matchGroup, [row.assetId]);
  }
  return [...groups.values()].filter((ids) => ids.length >= 2);
}

const setTitle = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

/**
 * Review groups for confirmed exact copies. The files are identical, so any
 * one keeps the picture: the suggested keeper is a favorite if there is
 * one, otherwise the earliest in the library, and the reason says so.
 */
export function exactCopyFindings(
  sets: readonly (readonly string[])[],
  byId: ReadonlyMap<string, PhotoItem>,
): GroupFinding[] {
  const findings: GroupFinding[] = [];
  for (const set of sets) {
    const members = set
      .map((id) => byId.get(id))
      .filter((item): item is PhotoItem => item !== undefined)
      .sort(
        (a, b) =>
          (a.capturedMs ?? Number.POSITIVE_INFINITY) - (b.capturedMs ?? Number.POSITIVE_INFINITY) ||
          a.id.localeCompare(b.id),
      );
    if (members.length < 2) continue;
    const favorite = members.find((member) => member.isFavorite);
    const keeper = favorite ?? members[0];
    findings.push({
      kind: 'group',
      id: `exact-${members[0].id}`,
      category: 'exact',
      title:
        members[0].capturedMs !== null
          ? `${members.length} identical files · ${setTitle.format(new Date(members[0].capturedMs))}`
          : `${members.length} identical files`,
      memberIds: members.map((member) => member.id),
      keeperId: keeper.id,
      keeperReason: favorite
        ? 'Marked as a favorite in Photos. The files are identical, byte for byte'
        : 'Earliest in your library. The files are identical byte for byte, so any one keeps the photo',
    });
  }
  return findings;
}

export type CopyCoverage = {
  /** Photos fingerprinted and current. */
  checked: number;
  /** Photos in confirmed exact-copy sets. */
  inSets: number;
  /** Not checked, by reason, largest first. */
  notChecked: { reason: SkipReason | 'not-yet'; count: number }[];
};

/** What the last check covered, from the catalog and stored rows. Never guessed. */
export function copyCoverage(
  items: readonly PhotoItem[],
  rows: ReadonlyMap<string, FingerprintRow>,
  sets: readonly (readonly string[])[],
  method: FingerprintMethod = FILE_MD5_METHOD,
): CopyCoverage {
  let checked = 0;
  const counts = new Map<SkipReason | 'not-yet', number>();
  const bump = (reason: SkipReason | 'not-yet') =>
    counts.set(reason, (counts.get(reason) ?? 0) + 1);

  for (const item of items) {
    const early = method.metadataSkip(item);
    if (early) {
      bump(early);
      continue;
    }
    const row = rows.get(item.id);
    if (!row || !isCurrent(row, item, method.implementation)) bump('not-yet');
    else if (row.status === 'hashed') checked += 1;
    else bump(row.skipReason ?? 'unreadable');
  }

  return {
    checked,
    inSets: sets.reduce((sum, set) => sum + set.length, 0),
    notChecked: [...counts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}
