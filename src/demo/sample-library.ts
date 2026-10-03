/**
 * Sample library for demo mode.
 *
 * These are synthetic gradient "photos" generated in code: no real images, no
 * user data, no licensing questions. Every value here is illustrative and is
 * always rendered with a visible "Sample" label. Sample sizes never feed real
 * storage statistics (docs/PRIVACY_AND_SAFETY.md).
 */
import type { IconName } from '@/components/icon';

export type SampleAsset = {
  readonly id: string;
  readonly source: 'sample';
  /** ISO 8601 with offset, as a real capture date would be stored. */
  readonly capturedAt: string;
  readonly width: number;
  readonly height: number;
  /** Illustrative logical size. Never presented as a real measurement. */
  readonly bytes: number;
  /** Gradient stops standing in for image content. */
  readonly colors: readonly [string, string, string];
  readonly subject: IconName;
  /** VoiceOver description of the stand-in image. */
  readonly description: string;
};

export type SampleGroup = {
  readonly id: string;
  readonly kind: 'similar';
  readonly title: string;
  readonly memberIds: readonly string[];
  readonly keeperId: string;
  readonly keeperReason: string;
};

type Scene = {
  name: string;
  colors: readonly [string, string, string];
  subject: IconName;
};

const SCENES: readonly Scene[] = [
  { name: 'Golden hour at the pier', colors: ['#FFB36B', '#FF5E7A', '#5B2A86'], subject: 'sun' },
  { name: 'Ocean morning', colors: ['#9BE7FF', '#3A8DDE', '#1B2F6B'], subject: 'water' },
  { name: 'Forest trail', colors: ['#C9F29B', '#3F9D5B', '#123B2A'], subject: 'leaf' },
  { name: 'City at night', colors: ['#3B2F7A', '#13152E', '#F2A541'], subject: 'building' },
  { name: 'Snowy ridge', colors: ['#FFFFFF', '#B8CCE4', '#5B7297'], subject: 'mountain' },
  { name: 'Portrait in warm light', colors: ['#FFD7B5', '#E08E6D', '#5A2E2A'], subject: 'person' },
  { name: 'Desert road', colors: ['#FFE0A3', '#E9A15B', '#8A4B2F'], subject: 'car' },
  { name: 'Lavender field', colors: ['#E8D5FF', '#A77BDB', '#4B2A73'], subject: 'flower' },
];

const MONTHS = ['2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Deterministic pseudo-random sequence so the sample library never changes between runs. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function buildLibrary(): SampleAsset[] {
  const random = seeded(42);
  const assets: SampleAsset[] = [];
  MONTHS.forEach((month, monthIndex) => {
    const count = 9 + monthIndex * 2;
    for (let i = 0; i < count; i += 1) {
      const scene = SCENES[Math.floor(random() * SCENES.length)];
      const day = 28 - Math.floor((i / count) * 27);
      const portrait = random() > 0.6;
      assets.push({
        id: `sample-${month}-${pad(i)}`,
        source: 'sample',
        capturedAt: `${month}-${pad(day)}T${pad(9 + (i % 10))}:${pad(Math.floor(random() * 60))}:00-04:00`,
        width: portrait ? 3024 : 4032,
        height: portrait ? 4032 : 3024,
        bytes: Math.round(1_400_000 + random() * 3_200_000),
        colors: scene.colors,
        subject: scene.subject,
        description: `Sample image: ${scene.name.toLowerCase()}`,
      });
    }
  });
  return assets;
}

function buildSimilarGroup(): { assets: SampleAsset[]; group: SampleGroup } {
  const scene = SCENES[0];
  const variants: readonly (readonly [string, string, string])[] = [
    scene.colors,
    ['#FFBE7A', '#FF6A80', '#5E2F8A'],
    ['#FFA960', '#FF5272', '#552680'],
    ['#FFC285', '#FF7088', '#61348C'],
  ];
  const bytes = [3_840_000, 3_610_000, 3_920_000, 3_470_000];
  const assets = variants.map((colors, index): SampleAsset => ({
    id: `sample-burst-${index + 1}`,
    source: 'sample',
    capturedAt: `2026-09-27T19:42:${pad(10 + index * 2)}-04:00`,
    width: 4032,
    height: 3024,
    bytes: bytes[index],
    colors,
    subject: scene.subject,
    description: `Sample image ${index + 1} of 4: golden hour at the pier`,
  }));
  return {
    assets,
    group: {
      id: 'sample-group-pier',
      kind: 'similar',
      title: scene.name,
      memberIds: assets.map((asset) => asset.id),
      keeperId: assets[0].id,
      keeperReason: 'Sharpest of the set, with no clipped highlights',
    },
  };
}

const similar = buildSimilarGroup();

export const sampleLibrary: readonly SampleAsset[] = [...similar.assets, ...buildLibrary()].sort(
  (a, b) => b.capturedAt.localeCompare(a.capturedAt),
);

export const sampleSimilarGroup: SampleGroup = similar.group;

const byId = new Map(sampleLibrary.map((asset) => [asset.id, asset]));

export function getSampleAsset(id: string): SampleAsset {
  const asset = byId.get(id);
  if (!asset) throw new Error(`Unknown sample asset ${id}`);
  return asset;
}
