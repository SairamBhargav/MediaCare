import {
  FACE_THRESHOLDS,
  decodePrint,
  encodePrint,
  faceCrop,
  groupFaces,
  peopleSummaries,
  type FaceRecord,
  type Person,
} from './people';

/** A unit vector near `axis`; `wobble` tilts it toward `toward` (the next axis by default). */
function print(axis: number, wobble = 0, toward = (axis + 1) % 8): Float32Array {
  const values = new Float32Array(8);
  values[axis] = 1;
  values[toward] += wobble;
  const length = Math.hypot(...values);
  return values.map((value) => value / length);
}

let nextId = 1;
function face(overrides: Partial<FaceRecord> = {}): FaceRecord {
  const id = nextId++;
  return {
    id,
    assetId: `photo${id}`,
    box: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
    quality: 0.8,
    applePrint: null,
    modelPrint: null,
    personId: null,
    confirmed: false,
    rejectedPersonId: null,
    ...overrides,
  };
}

const person = (id: number, name: string | null = null): Person => ({
  id,
  name,
  hidden: false,
  createdAt: 0,
});

test('fingerprints survive the base64 round trip the native module uses', () => {
  const values = [0.5, -0.25, 1e-3, 3.75, 0];
  const decoded = decodePrint(encodePrint(values));
  expect(Array.from(decoded!)).toEqual(values.map((value) => Math.fround(value)));
  expect(decodePrint('not base64!')).toBeNull();
  expect(decodePrint(null)).toBeNull();
});

test('model fingerprints split two people and keep each together', async () => {
  const bob = [0, 0.1, 0.2].map((w) => face({ modelPrint: print(0, w) }));
  const ann = [0, 0.15].map((w) => face({ modelPrint: print(3, w) }));
  const { newPeople, toExisting } = await groupFaces([...bob, ...ann]);
  expect(toExisting.size).toBe(0);
  const groups = newPeople.map((group) => group.sort()).sort((a, b) => a[0] - b[0]);
  expect(groups).toEqual([bob.map((f) => f.id), ann.map((f) => f.id)]);
});

test('a borderline model match needs Apple’s fingerprint to agree', async () => {
  // Cosine between axis 0 and a 45° tilt ≈ 0.707; pick a tilt landing between modelMaybe and modelSure.
  const tilt = Math.tan(Math.acos((FACE_THRESHOLDS.modelSure + FACE_THRESHOLDS.modelMaybe) / 2));
  const anchor = face({ quality: 0.9, modelPrint: print(0), applePrint: print(0) });
  const agrees = face({ quality: 0.5, modelPrint: print(0, tilt), applePrint: print(0, 0.1) });
  // Tilted the other way: borderline for the anchor, unlike the face above.
  const disagrees = face({ quality: 0.5, modelPrint: print(0, tilt, 2), applePrint: print(5) });
  const { newPeople } = await groupFaces([anchor, agrees, disagrees]);
  expect(newPeople).toContainEqual([anchor.id, agrees.id]);
  expect(newPeople).toContainEqual([disagrees.id]);
});

test('Apple-only fingerprints use the strict bar', async () => {
  const a = face({ applePrint: print(0) });
  const near = face({ applePrint: print(0, 0.1) }); // cosine ≈ 0.995
  const loose = face({ applePrint: print(0, 0.8) }); // cosine ≈ 0.78
  const { newPeople } = await groupFaces([a, near, loose]);
  expect(newPeople).toContainEqual([a.id, near.id]);
  expect(newPeople).toContainEqual([loose.id]);
});

test('new faces join existing people, but never one they were rejected from', async () => {
  const known = face({ modelPrint: print(0), personId: 7, confirmed: true });
  const again = face({ modelPrint: print(0, 0.05) });
  const notBob = face({ modelPrint: print(0, 0.05), rejectedPersonId: 7 });
  const { toExisting, newPeople } = await groupFaces([known, again, notBob]);
  expect(toExisting.get(again.id)).toBe(7);
  expect(toExisting.has(notBob.id)).toBe(false);
  expect(newPeople).toEqual([[notBob.id]]);
});

test('blurry faces and faces without fingerprints are left out', async () => {
  const blurry = face({ quality: 0.1, modelPrint: print(0) });
  const small = face({ quality: 0.9 });
  expect((await groupFaces([blurry, small])).newPeople).toEqual([]);
});

test('People shows named people first, then by photo count; one-off strangers are hidden', () => {
  const faces = [
    face({ personId: 1, assetId: 'a' }),
    face({ personId: 1, assetId: 'b' }),
    face({ personId: 1, assetId: 'c' }),
    face({ personId: 2, assetId: 'a', quality: 0.5 }),
    face({ personId: 2, assetId: 'd', quality: 0.95 }),
    face({ personId: 3, assetId: 'x' }),
    face({ personId: 4, assetId: 'y' }),
  ];
  const summaries = peopleSummaries(
    [person(1), person(2, 'Bob'), person(3), person(4, 'Ann')],
    faces,
  );
  expect(summaries.map((s) => s.person.id)).toEqual([2, 4, 1]);
  expect(summaries[0].assetIds).toEqual(['a', 'd']);
  expect(summaries[0].cover.quality).toBe(0.95);
});

test('faceCrop centres the face in the circle with a margin', () => {
  // A 1000×500 photo; face in the top-left quarter (origin bottom-left).
  const crop = faceCrop({ x: 0.1, y: 0.6, width: 0.1, height: 0.2 }, 1000, 500, 80, 1);
  // Face is 100×100 px → scale 0.8; its centre (150, 150 from top) lands at (40, 40).
  expect(crop.width).toBeCloseTo(800);
  expect(crop.height).toBeCloseTo(400);
  expect(crop.left + 150 * 0.8).toBeCloseTo(40);
  expect(crop.top + 150 * 0.8).toBeCloseTo(40);
});
