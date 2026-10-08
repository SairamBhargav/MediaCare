import { toPhotoItem, type PhotoItem, type PhotoRecord } from './media';
import {
  VISUAL_THRESHOLDS,
  chooseKeeper,
  featureDistance,
  layoutDistance,
  normalize,
  poseDistance,
  qualityFlags,
  similarFindings,
  similarSets,
  type Pose,
  type VisualFace,
  type VisualScores,
} from './visual-findings';

function photo(id: string, at: number, overrides: Partial<PhotoRecord> = {}): PhotoItem {
  return toPhotoItem({
    id,
    kind: 'photo',
    creationTime: at,
    modificationTime: 1,
    width: 4032,
    height: 3024,
    durationMs: null,
    isFavorite: false,
    subtypes: [],
    filename: `${id}.HEIC`,
    ...overrides,
  });
}

const face = (overrides: Partial<VisualFace> = {}): VisualFace => ({
  quality: 0.5,
  leftEyeOpen: 0.3,
  rightEyeOpen: 0.3,
  width: 0.2,
  height: 0.2,
  ...overrides,
});

function scores(print: number[] | null, overrides: Partial<VisualScores> = {}): VisualScores {
  return {
    featurePrint: print ? normalize(print) : null,
    sharpness: 300,
    sharpnessMaxTile: 800,
    brightness: 0.5,
    darkFraction: 0.01,
    brightFraction: 0.01,
    faces: [],
    poses: [],
    layout: null,
    ...overrides,
  };
}

const T0 = 1_750_000_000_000;

describe('feature distance', () => {
  test('identical prints are 0 apart; opposite are 2; missing is never similar', () => {
    const a = normalize([1, 2, 3]);
    expect(featureDistance(a, normalize([2, 4, 6]))).toBeCloseTo(0);
    expect(featureDistance(normalize([1, 0]), normalize([-1, 0]))).toBeCloseTo(2);
    expect(featureDistance(a, null)).toBe(Number.POSITIVE_INFINITY);
    expect(featureDistance(a, normalize([1, 2]))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('similar sets', () => {
  test('photos that look alike and were taken together form one group', () => {
    const items = [photo('a', T0), photo('b', T0 + 1000), photo('c', T0 + 2000)];
    const map = new Map([
      ['a', scores([1, 0, 0])],
      ['b', scores([0.98, 0.05, 0])],
      ['c', scores([0.97, 0.08, 0.01])],
    ]);
    expect(similarSets(items, map)).toEqual([['a', 'b', 'c']]);
  });

  test('two different photos taken seconds apart are NOT grouped (the timing-only bug)', () => {
    const items = [photo('dog', T0), photo('cake', T0 + 1000)];
    const map = new Map([
      ['dog', scores([1, 0, 0])],
      ['cake', scores([0, 1, 0])],
    ]);
    expect(similarSets(items, map)).toEqual([]);
  });

  test('look-alikes taken hours apart are not grouped; unanalyzed photos are left out', () => {
    const items = [photo('a', T0), photo('b', T0 + 3 * 3600_000), photo('c', T0 + 1000)];
    const map = new Map([
      ['a', scores([1, 0, 0])],
      ['b', scores([1, 0, 0])],
    ]);
    expect(similarSets(items, map)).toEqual([]);
  });

  test('a chain of poses does not merge: each photo must look like every member (dance case)', () => {
    // pose1~pose2 and pose2~pose3 are close, but pose1 and pose3 are clearly different.
    const items = [photo('pose1', T0), photo('pose2', T0 + 1000), photo('pose3', T0 + 2000)];
    const map = new Map([
      ['pose1', scores([1, 0, 0])],
      ['pose2', scores([1, 0.27, 0])],
      ['pose3', scores([1, 0.56, 0])],
    ]);
    // Only the closest pair at most; never all three together.
    const sets = similarSets(items, map);
    expect(sets.some((set) => set.includes('pose1') && set.includes('pose3'))).toBe(false);
  });

  test('same scene, different moment (0.42 apart on device) is no longer similar', () => {
    // Two unit vectors 0.42 apart.
    const angle = 2 * Math.asin(0.42 / 2);
    const items = [photo('a', T0), photo('b', T0 + 1000)];
    const map = new Map([
      ['a', scores([1, 0])],
      ['b', scores([Math.cos(angle), Math.sin(angle)])],
    ]);
    expect(similarSets(items, map)).toEqual([]);
  });

  test('screenshots and videos are never in similar groups', () => {
    const items = [
      photo('a', T0, { subtypes: ['screenshot'] }),
      photo('b', T0 + 500, { subtypes: ['screenshot'] }),
      photo('v', T0 + 600, { kind: 'video', durationMs: 1000 }),
    ];
    const map = new Map(items.map((item) => [item.id, scores([1, 0, 0])]));
    expect(similarSets(items, map)).toEqual([]);
  });
});

describe('keeper', () => {
  test('a favorite always wins', () => {
    const items = [photo('a', T0), photo('b', T0 + 1, { isFavorite: true })];
    const map = new Map([
      ['a', scores([1], { sharpnessMaxTile: 2000 })],
      ['b', scores([1], { sharpnessMaxTile: 10 })],
    ]);
    expect(chooseKeeper(items, map)).toEqual({
      keeperId: 'b',
      reason: 'Marked as a favorite in Photos',
    });
  });

  test('the sharpest photo wins and the reason says so', () => {
    const items = [photo('soft', T0), photo('sharp', T0 + 1)];
    const map = new Map([
      ['soft', scores([1], { sharpnessMaxTile: 80 })],
      ['sharp', scores([1], { sharpnessMaxTile: 900 })],
    ]);
    const keeper = chooseKeeper(items, map);
    expect(keeper.keeperId).toBe('sharp');
    expect(keeper.reason).toMatch(/^Sharpest/);
  });

  test('closed eyes outweigh a little extra sharpness', () => {
    const items = [photo('blink', T0), photo('open', T0 + 1)];
    const map = new Map([
      [
        'blink',
        scores([1], {
          sharpnessMaxTile: 1000,
          faces: [face({ leftEyeOpen: 0.02, rightEyeOpen: 0.03 })],
        }),
      ],
      ['open', scores([1], { sharpnessMaxTile: 800, faces: [face()] })],
    ]);
    const keeper = chooseKeeper(items, map);
    expect(keeper.keeperId).toBe('open');
    expect(keeper.reason).toMatch(/eyes open/i);
  });

  test('similar findings carry the keeper and its reason', () => {
    const items = [photo('a', T0), photo('b', T0 + 1000)];
    const map = new Map([
      ['a', scores([1, 0], { sharpnessMaxTile: 100 })],
      ['b', scores([1, 0.01], { sharpnessMaxTile: 700 })],
    ]);
    const [group] = similarFindings(items, map);
    expect(group).toMatchObject({ category: 'similar', memberIds: ['a', 'b'], keeperId: 'b' });
    expect(group.keeperReason).toMatch(/Sharpest/);
  });
});

describe('quality flags', () => {
  const T = VISUAL_THRESHOLDS;

  test('blurry everywhere is flagged; a sharp subject on a soft background is not', () => {
    const items = [photo('blurry', T0), photo('bokeh', T0 + 1)];
    const map = new Map([
      ['blurry', scores(null, { sharpness: 10, sharpnessMaxTile: T.blurMaxTile - 1 })],
      ['bokeh', scores(null, { sharpness: 15, sharpnessMaxTile: 600 })],
    ]);
    const flags = qualityFlags(items, map);
    expect(flags.map((flag) => [flag.assetId, flag.category])).toEqual([['blurry', 'blurry']]);
    expect(flags[0].reason).toMatch(/sharpness \d+/);
  });

  test('closed eyes are flagged with how many people; tiny background faces are ignored', () => {
    const items = [photo('group', T0), photo('crowd', T0 + 1)];
    const closed = face({ leftEyeOpen: 0.05, rightEyeOpen: 0.04 });
    const map = new Map([
      ['group', scores(null, { faces: [closed, face(), face()] })],
      ['crowd', scores(null, { faces: [face({ ...closed, width: 0.05, height: 0.05 })] })],
    ]);
    const flags = qualityFlags(items, map);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ category: 'eyes-closed', assetId: 'group' });
    expect(flags[0].reason).toBe('Eyes may be closed (1 of 3 people)');
  });

  test('one eye winking or unknown eyes are not "closed"', () => {
    const items = [photo('wink', T0), photo('unknown', T0 + 1)];
    const map = new Map([
      ['wink', scores(null, { faces: [face({ leftEyeOpen: 0.02 })] })],
      ['unknown', scores(null, { faces: [face({ leftEyeOpen: -1, rightEyeOpen: -1 })] })],
    ]);
    expect(qualityFlags(items, map)).toEqual([]);
  });

  test('very dark and blown-out photos are flagged with the measurement', () => {
    const items = [photo('dark', T0), photo('bright', T0 + 1), photo('ok', T0 + 2)];
    const map = new Map([
      ['dark', scores(null, { brightness: 0.05, darkFraction: 0.8 })],
      ['bright', scores(null, { brightFraction: 0.6 })],
      ['ok', scores(null)],
    ]);
    const flags = qualityFlags(items, map);
    expect(flags.map((flag) => [flag.assetId, flag.reason])).toEqual([
      ['dark', 'Very dark (80% near black)'],
      ['bright', 'Mostly blown out (60% near white)'],
    ]);
  });
});

describe('pose and layout checks', () => {
  // A standing dancer and the same dancer in an arabesque (leg raised, arm out).
  const standing: Pose = {
    head: [0.5, 0.9],
    neck: [0.5, 0.8],
    left_hand: [0.4, 0.5],
    right_hand: [0.6, 0.5],
    left_foot: [0.45, 0.1],
    right_foot: [0.55, 0.1],
    root: [0.5, 0.5],
  };
  const arabesque: Pose = {
    head: [0.45, 0.85],
    neck: [0.47, 0.75],
    left_hand: [0.1, 0.8],
    right_hand: [0.9, 0.7],
    left_foot: [0.5, 0.1],
    right_foot: [0.95, 0.55],
    root: [0.5, 0.5],
  };
  const standingAgain: Pose = Object.fromEntries(
    Object.entries(standing).map(([name, [x, y]]) => [name, [x + 0.01, y - 0.01]]),
  );

  test('the same pose (slightly shifted) is close; a different pose is far', () => {
    expect(poseDistance([standing], [standingAgain])!).toBeLessThan(
      VISUAL_THRESHOLDS.poseDifferent,
    );
    expect(poseDistance([standing], [arabesque])!).toBeGreaterThan(VISUAL_THRESHOLDS.poseDifferent);
  });

  test('no person, or too few shared joints: pose does not decide', () => {
    expect(poseDistance([], [standing])).toBeNull();
    expect(poseDistance([{ head: [0.5, 0.9] }], [{ head: [0.5, 0.9] }])).toBeNull();
  });

  test('the dance case: same studio and look, different pose → not similar', () => {
    const items = [photo('p1', T0), photo('p2', T0 + 1500)];
    const map = new Map([
      ['p1', scores([1, 0, 0], { poses: [standing] })],
      ['p2', scores([1, 0.1, 0], { poses: [arabesque] })],
    ]);
    expect(similarSets(items, map)).toEqual([]);
  });

  test('a real repeat shot (same pose) is still similar', () => {
    const items = [photo('r1', T0), photo('r2', T0 + 500)];
    const map = new Map([
      ['r1', scores([1, 0, 0], { poses: [standing] })],
      ['r2', scores([1, 0.1, 0], { poses: [standingAgain] })],
    ]);
    expect(similarSets(items, map)).toEqual([['r1', 'r2']]);
  });

  test('layout: same framing is close; subject moved across the frame is far', () => {
    const left = Array.from({ length: 64 }, (_, index) => (index % 8 < 4 ? 0.8 : 0.2));
    const right = Array.from({ length: 64 }, (_, index) => (index % 8 < 4 ? 0.2 : 0.8));
    const brighter = left.map((value) => value + 0.1);
    expect(layoutDistance(left, brighter)!).toBeCloseTo(0);
    expect(layoutDistance(left, right)!).toBeGreaterThan(VISUAL_THRESHOLDS.layoutDifferent);
    expect(layoutDistance(null, left)).toBeNull();
  });
});
