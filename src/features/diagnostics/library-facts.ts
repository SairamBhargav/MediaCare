import type { PhotoItem } from '@/domain/media';

/**
 * Counts from catalog metadata only (no file access), for the on-device
 * diagnostics report that answers open capability questions
 * (docs/CAPABILITIES.md, spikes S1/S3).
 */
export type LibraryFacts = {
  total: number;
  photos: number;
  videos: number;
  favorites: number;
  undated: number;
  bySubtype: Record<string, number>;
  byExtension: Record<string, number>;
};

export function extensionOf(filename: string | null): string {
  if (!filename) return 'unknown';
  const dot = filename.lastIndexOf('.');
  return dot < 0 || dot === filename.length - 1 ? 'none' : filename.slice(dot + 1).toUpperCase();
}

function bump(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1;
}

export function libraryFacts(items: readonly PhotoItem[]): LibraryFacts {
  const facts: LibraryFacts = {
    total: items.length,
    photos: 0,
    videos: 0,
    favorites: 0,
    undated: 0,
    bySubtype: {},
    byExtension: {},
  };
  for (const item of items) {
    if (item.kind === 'video') facts.videos += 1;
    else facts.photos += 1;
    if (item.isFavorite) facts.favorites += 1;
    if (item.capturedMs === null) facts.undated += 1;
    for (const subtype of item.subtypes) bump(facts.bySubtype, subtype);
    bump(facts.byExtension, extensionOf(item.filename));
  }
  return facts;
}

function sorted(record: Record<string, number>): string {
  const entries = Object.entries(record).sort((a, b) => b[1] - a[1]);
  return entries.length === 0
    ? 'none'
    : entries.map(([key, count]) => `${key} ${count}`).join(', ');
}

export function formatFacts(facts: LibraryFacts): string {
  return [
    `Items: ${facts.total} (photos ${facts.photos}, videos ${facts.videos})`,
    `Favorites: ${facts.favorites}`,
    `Undated: ${facts.undated}`,
    `File types (by name): ${sorted(facts.byExtension)}`,
    `Subtypes: ${sorted(facts.bySubtype)}`,
  ].join('\n');
}
