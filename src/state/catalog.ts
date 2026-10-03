import { create } from 'zustand';

import {
  clearCatalog,
  deleteAssets,
  loadAssets,
  loadFingerprints,
  loadLastScanJob,
  loadProtectedIds,
  markInterruptedScans,
  setProtected as persistProtected,
  type ScanJobRow,
} from '@/db/catalog-repo';
import { confirmedSets, type FingerprintRow } from '@/domain/exact-copies';
import { toPhotoItem, type PhotoItem } from '@/domain/media';
import { useLibrarySession } from '@/state/library-session';
import {
  getAccess,
  manageSelection,
  requestAccess,
  watchLibrary,
  type PhotoAccess,
} from '@/services/media/photo-library';

/**
 * The real library as MediaCare knows it: catalog rows loaded into memory
 * (metadata only, a few hundred bytes per item), app-level protection, the
 * last scan, current photo access, and whether Photos changed since.
 */
export type CatalogState = {
  access: PhotoAccess | 'unknown';
  loaded: boolean;
  items: readonly PhotoItem[];
  byId: ReadonlyMap<string, PhotoItem>;
  protectedIds: ReadonlySet<string>;
  lastScan: ScanJobRow | null;
  /** Stored fingerprints (or skip reasons) from "Find exact copies", by asset id. */
  fingerprints: ReadonlyMap<string, FingerprintRow>;
  /** Confirmed exact-copy sets whose members haven't changed since they were checked. */
  copySets: readonly (readonly string[])[];
  lastCopyCheck: ScanJobRow | null;
  /** Photos reported changes (or access changed) since the catalog was last loaded. */
  libraryChanged: boolean;
  load: () => Promise<void>;
  refreshAccess: () => Promise<PhotoAccess>;
  requestAccess: () => Promise<PhotoAccess>;
  manageSelection: () => Promise<void>;
  setProtected: (id: string, value: boolean) => void;
  clear: () => Promise<void>;
};

let unwatch: (() => void) | null = null;

export const useCatalog = create<CatalogState>()((set, get) => ({
  access: 'unknown',
  loaded: false,
  items: [],
  byId: new Map(),
  protectedIds: new Set(),
  lastScan: null,
  fingerprints: new Map(),
  copySets: [],
  lastCopyCheck: null,
  libraryChanged: false,

  load: async () => {
    await markInterruptedScans();
    const [records, protectedIds, lastScan, fingerprintRows, lastCopyCheck, access] =
      await Promise.all([
        loadAssets(),
        loadProtectedIds(),
        loadLastScanJob(),
        loadFingerprints().catch(() => [] as FingerprintRow[]),
        loadLastScanJob('copy-check').catch(() => null),
        getAccess().catch(() => 'unknown' as const),
      ]);
    const items = records.map(toPhotoItem);
    const byId = new Map(items.map((item) => [item.id, item]));
    set({
      items,
      byId,
      protectedIds,
      lastScan,
      fingerprints: new Map(fingerprintRows.map((row) => [row.assetId, row])),
      copySets: confirmedSets(fingerprintRows, byId),
      lastCopyCheck,
      access,
      loaded: true,
      libraryChanged: false,
    });
    startWatching();
  },

  refreshAccess: async () => {
    const access = await getAccess();
    set({ access });
    return access;
  },

  requestAccess: async () => {
    const access = await requestAccess();
    set({ access });
    if (access === 'full' || access === 'limited') startWatching();
    return access;
  },

  manageSelection: async () => {
    await manageSelection();
    // Selection changes arrive as a library change event; mark it now too.
    set({ libraryChanged: true });
  },

  setProtected: (id, value) => {
    const next = new Set(get().protectedIds);
    if (value) next.add(id);
    else next.delete(id);
    set({ protectedIds: next });
    persistProtected(id, value).catch(() => {});
  },

  clear: async () => {
    await clearCatalog();
    set({
      items: [],
      byId: new Map(),
      protectedIds: new Set(),
      lastScan: null,
      fingerprints: new Map(),
      copySets: [],
      lastCopyCheck: null,
    });
    useLibrarySession.getState().reset();
  },
}));

function startWatching() {
  if (unwatch) return;
  try {
    const subscription = watchLibrary((event) => {
      const deleted = event.deletedAssets ?? [];
      if (deleted.length > 0) {
        deleteAssets(deleted).catch(() => {});
        const gone = new Set(deleted);
        const items = useCatalog.getState().items.filter((item) => !gone.has(item.id));
        useCatalog.setState({ items, byId: new Map(items.map((item) => [item.id, item])) });
      }
      const changed =
        !event.hasIncrementalChanges ||
        (event.insertedAssets?.length ?? 0) > 0 ||
        (event.updatedAssets?.length ?? 0) > 0;
      if (changed) useCatalog.setState({ libraryChanged: true });
      // Access may have changed (limited selection edited, or revoked in Settings).
      if (!event.hasIncrementalChanges)
        useCatalog
          .getState()
          .refreshAccess()
          .catch(() => {});
    });
    unwatch = () => subscription.remove();
  } catch {
    // Not available on this platform; the catalog still works from scans.
  }
}

export function hasPhotoAccess(access: CatalogState['access']): boolean {
  return access === 'full' || access === 'limited';
}
