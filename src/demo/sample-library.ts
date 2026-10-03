/**
 * Sample library for demo mode.
 *
 * These are synthetic gradient "photos" generated in code: no real images, no
 * user data, no licensing questions. Every value here is illustrative and is
 * always rendered with a visible "Sample" label. Sample sizes never feed real
 * storage statistics (docs/PRIVACY_AND_SAFETY.md). Sample findings are
 * hand-authored, not the output of any detector.
 */
import type { IconName } from '@/components/icon';
import type { Finding, GroupFinding, ItemFinding } from '@/domain/findings';

type Gradient = readonly [string, string, string];

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
  readonly colors: Gradient;
  readonly subject: IconName;
  /** `soft` renders the stand-in out of focus, for "possibly blurry" samples. */
  readonly look?: 'soft';
  /** VoiceOver description of the stand-in image. */
  readonly description: string;
};

type Scene = { name: string; colors: Gradient; subject: IconName };

const SCENES = {
  pier: {
    name: 'Golden hour at the pier',
    colors: ['#FFB36B', '#FF5E7A', '#5B2A86'],
    subject: 'sun',
  },
  ocean: { name: 'Ocean morning', colors: ['#9BE7FF', '#3A8DDE', '#1B2F6B'], subject: 'water' },
  forest: { name: 'Forest trail', colors: ['#C9F29B', '#3F9D5B', '#123B2A'], subject: 'leaf' },
  city: { name: 'City at night', colors: ['#3B2F7A', '#13152E', '#F2A541'], subject: 'building' },
  snow: { name: 'Snowy ridge', colors: ['#FFFFFF', '#B8CCE4', '#5B7297'], subject: 'mountain' },
  portrait: {
    name: 'Portrait in warm light',
    colors: ['#FFD7B5', '#E08E6D', '#5A2E2A'],
    subject: 'person',
  },
  desert: { name: 'Desert road', colors: ['#FFE0A3', '#E9A15B', '#8A4B2F'], subject: 'car' },
  lavender: {
    name: 'Lavender field',
    colors: ['#E8D5FF', '#A77BDB', '#4B2A73'],
    subject: 'flower',
  },
} as const satisfies Record<string, Scene>;

const SCENE_LIST: readonly Scene[] = Object.values(SCENES);
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

/** Nudges each gradient stop slightly, so burst shots look alike but not identical. */
function shift(colors: Gradient, amount: number): Gradient {
  const nudge = (hex: string) => {
    const value = parseInt(hex.slice(1), 16);
    const channel = (offset: number) =>
      Math.max(0, Math.min(255, ((value >> offset) & 0xff) + amount));
    return `#${[16, 8, 0].map((offset) => channel(offset).toString(16).padStart(2, '0')).join('')}`;
  };
  return [nudge(colors[0]), nudge(colors[1]), nudge(colors[2])];
}

const assets: SampleAsset[] = [];
const findings: Finding[] = [];

function addAsset(asset: Omit<SampleAsset, 'source'>): SampleAsset {
  const full: SampleAsset = { ...asset, source: 'sample' };
  assets.push(full);
  return full;
}

/** Everyday photos with no finding attached. */
function buildEverydayPhotos() {
  const random = seeded(42);
  MONTHS.forEach((month, monthIndex) => {
    const count = 9 + monthIndex * 2;
    for (let i = 0; i < count; i += 1) {
      const scene = SCENE_LIST[Math.floor(random() * SCENE_LIST.length)];
      const day = 28 - Math.floor((i / count) * 27);
      const portrait = random() > 0.6;
      addAsset({
        id: `sample-${month}-${pad(i)}`,
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
}

/** A burst of near-identical shots: a "similar shots" group. */
function addSimilarGroup(
  key: string,
  scene: Scene,
  capturedAt: (index: number) => string,
  bytes: readonly number[],
  keeperIndex: number,
  keeperReason: string,
) {
  const members = bytes.map((size, index) =>
    addAsset({
      id: `sample-${key}-${index + 1}`,
      capturedAt: capturedAt(index),
      width: 4032,
      height: 3024,
      bytes: size,
      colors:
        index === keeperIndex
          ? scene.colors
          : shift(scene.colors, (index % 2 ? 1 : -1) * 8 * (index + 1)),
      subject: scene.subject,
      description: `Sample image ${index + 1} of ${bytes.length}: ${scene.name.toLowerCase()}`,
    }),
  );
  const group: GroupFinding = {
    kind: 'group',
    id: `sample-group-${key}`,
    category: 'similar',
    title: scene.name,
    memberIds: members.map((asset) => asset.id),
    keeperId: members[keeperIndex].id,
    keeperReason,
  };
  findings.push(group);
}

/** The same file saved more than once: an "exact copies" group. */
function addExactGroup(
  key: string,
  scene: Scene,
  capturedAt: string,
  bytes: number,
  copies: number,
) {
  const members = Array.from({ length: copies }, (_, index) =>
    addAsset({
      id: `sample-${key}-copy-${index + 1}`,
      capturedAt,
      width: 4032,
      height: 3024,
      bytes,
      colors: scene.colors,
      subject: scene.subject,
      description: `Sample image, copy ${index + 1} of ${copies}: ${scene.name.toLowerCase()}`,
    }),
  );
  findings.push({
    kind: 'group',
    id: `sample-group-${key}`,
    category: 'exact',
    title: scene.name,
    memberIds: members.map((asset) => asset.id),
    keeperId: members[0].id,
    keeperReason: 'Identical files; keeping the first one saved',
  });
}

function addItem(category: ItemFinding['category'], asset: SampleAsset, reason: string) {
  findings.push({
    kind: 'item',
    id: `sample-${category}-${asset.id}`,
    category,
    assetId: asset.id,
    reason,
  });
}

function buildFindings() {
  addSimilarGroup(
    'pier',
    SCENES.pier,
    (i) => `2026-09-27T19:42:${pad(10 + i * 2)}-04:00`,
    [3_840_000, 3_610_000, 3_920_000, 3_470_000],
    0,
    'Sharpest of the set, with no clipped highlights',
  );
  addSimilarGroup(
    'portrait',
    SCENES.portrait,
    (i) => `2026-08-14T17:05:${pad(20 + i)}-04:00`,
    [2_910_000, 2_870_000, 3_020_000, 2_950_000, 2_890_000],
    2,
    'Eyes open and in focus',
  );
  addSimilarGroup(
    'lavender',
    SCENES.lavender,
    (i) => `2026-07-02T10:31:${pad(40 + i * 3)}-04:00`,
    [4_120_000, 4_060_000, 4_190_000],
    1,
    'Level horizon and the most detail in the flowers',
  );

  addExactGroup('ocean', SCENES.ocean, '2026-06-21T07:12:00-04:00', 3_350_000, 2);
  addExactGroup('city', SCENES.city, '2026-05-30T22:48:00-04:00', 2_780_000, 3);

  const softScenes = [SCENES.forest, SCENES.city, SCENES.desert, SCENES.snow, SCENES.ocean];
  softScenes.forEach((scene, index) => {
    const asset = addAsset({
      id: `sample-soft-${index + 1}`,
      capturedAt: `2026-0${8 - index}-0${index + 3}T1${index}:15:00-04:00`,
      width: 4032,
      height: 3024,
      bytes: 2_200_000 + index * 180_000,
      colors: scene.colors,
      subject: scene.subject,
      look: 'soft',
      description: `Sample image, out of focus: ${scene.name.toLowerCase()}`,
    });
    addItem(
      'blurry',
      asset,
      index % 2 === 0 ? 'Very little sharp detail anywhere' : 'Looks like camera shake',
    );
  });

  const wideScenes = [SCENES.snow, SCENES.desert, SCENES.ocean, SCENES.forest];
  wideScenes.forEach((scene, index) => {
    const asset = addAsset({
      id: `sample-pano-${index + 1}`,
      capturedAt: `2026-0${7 - index}-1${index}T12:00:00-04:00`,
      width: 16_000,
      height: 3_400,
      bytes: 41_000_000 - index * 6_500_000,
      colors: scene.colors,
      subject: scene.subject,
      description: `Sample panorama: ${scene.name.toLowerCase()}`,
    });
    addItem('large', asset, 'Panorama');
  });
}

buildEverydayPhotos();
buildFindings();

/** Every sample asset, newest first. */
export const sampleLibrary: readonly SampleAsset[] = [...assets].sort((a, b) =>
  b.capturedAt.localeCompare(a.capturedAt),
);

/** Hand-authored sample findings. Labelled "Sample" wherever they appear. */
export const sampleFindings: readonly Finding[] = findings;

const byId = new Map(sampleLibrary.map((asset) => [asset.id, asset]));

export function getSampleAsset(id: string): SampleAsset {
  const asset = byId.get(id);
  if (!asset) throw new Error(`Unknown sample asset ${id}`);
  return asset;
}

export function sampleBytes(id: string): number {
  return getSampleAsset(id).bytes;
}
