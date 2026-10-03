import { sampleLibrary, type SampleAsset } from '@/demo/sample-library';
import type { PhotoItem } from '@/domain/media';
import { useCatalog } from '@/state/catalog';

/** Anything the UI can show as a photo: a synthetic sample or a real Photos item. */
export type MediaItem = SampleAsset | PhotoItem;

const samples = new Map(sampleLibrary.map((asset) => [asset.id, asset]));

export function isSample(item: MediaItem): item is SampleAsset {
  return item.source === 'sample';
}

/** Looks up an item by id in the sample library, then the real catalog. */
export function findMediaItem(id: string): MediaItem | undefined {
  return samples.get(id) ?? useCatalog.getState().byId.get(id);
}

export function getMediaItem(id: string): MediaItem {
  const item = findMediaItem(id);
  if (!item) throw new Error(`Unknown media item ${id}`);
  return item;
}

/** Logical size for totals: known for samples, unmeasured (0) for real items. */
export function knownBytes(id: string): number {
  return findMediaItem(id)?.bytes ?? 0;
}
