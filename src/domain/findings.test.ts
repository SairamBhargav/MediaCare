import { candidateIds, summarizeCategories, totalReclaimableBytes, type Finding } from './findings';

const bytes: Record<string, number> = { a: 100, b: 80, c: 60, d: 500, e: 40, f: 900 };
const bytesOf = (id: string) => bytes[id];

const findings: Finding[] = [
  {
    kind: 'group',
    id: 'g1',
    category: 'similar',
    title: 'Pier',
    memberIds: ['a', 'b', 'c'],
    keeperId: 'a',
    keeperReason: 'sharpest',
  },
  {
    kind: 'group',
    id: 'g2',
    category: 'exact',
    title: 'Copies',
    memberIds: ['d', 'e'],
    keeperId: 'd',
    keeperReason: 'oldest copy',
  },
  // "b" is also flagged blurry: it must not be counted twice in the total.
  { kind: 'item', id: 'i1', category: 'blurry', assetId: 'b', reason: 'little sharp detail' },
  { kind: 'item', id: 'i2', category: 'large', assetId: 'f', reason: '900 bytes' },
];

test('a group keeper is never a removal candidate', () => {
  expect(candidateIds(findings[0])).toEqual(['b', 'c']);
});

test('category summaries count keepers as involved photos but not as reclaimable bytes', () => {
  const [similar, exact, blurry, large] = summarizeCategories(findings, bytesOf);
  expect(similar).toMatchObject({ category: 'similar', findingCount: 1, photoCount: 3 });
  expect(similar.reclaimableBytes).toBe(80 + 60);
  expect(exact.reclaimableBytes).toBe(40);
  expect(blurry.reclaimableBytes).toBe(80);
  expect(large.reclaimableBytes).toBe(900);
});

test('categories come back in a fixed order and empty ones are omitted', () => {
  const onlyLarge = summarizeCategories([findings[3]], bytesOf);
  expect(onlyLarge.map((summary) => summary.category)).toEqual(['large']);
  expect(summarizeCategories([], bytesOf)).toEqual([]);
});

test('previews lead with keepers so the card shows the best photo', () => {
  const [similar] = summarizeCategories(findings, bytesOf);
  expect(similar.previewAssetIds[0]).toBe('a');
});

test('the total counts an asset once even when two categories flag it', () => {
  // b (80) + c (60) + e (40) + f (900); b appears in both similar and blurry.
  expect(totalReclaimableBytes(findings, bytesOf)).toBe(1080);
});
