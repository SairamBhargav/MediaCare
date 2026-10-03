import { buildActionPlan, type ReviewChoices } from './action-plan';
import type { Finding } from './findings';

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
    keeperReason: 'first saved',
  },
  { kind: 'item', id: 'i1', category: 'blurry', assetId: 'a', reason: 'soft' },
  { kind: 'item', id: 'i2', category: 'blurry', assetId: 'b', reason: 'soft' },
  { kind: 'item', id: 'i3', category: 'large', assetId: 'f', reason: 'panorama' },
];

function choices(overrides: Partial<ReviewChoices> = {}): ReviewChoices {
  return { groupSelections: {}, itemSelectedIds: new Set(), ...overrides };
}

test('an empty review produces an empty plan', () => {
  const plan = buildActionPlan(findings, choices(), bytesOf);
  expect(plan).toMatchObject({ groups: [], items: [], assetIds: [], bytes: 0 });
});

test('selected group members and flagged photos are planned with honest bytes', () => {
  const plan = buildActionPlan(
    findings,
    choices({
      groupSelections: { g1: new Set(['b', 'c']), g2: new Set(['e']) },
      itemSelectedIds: new Set(['f']),
    }),
    bytesOf,
  );
  expect([...plan.assetIds].sort()).toEqual(['b', 'c', 'e', 'f']);
  expect(plan.bytes).toBe(80 + 60 + 40 + 900);
  expect(plan.groups.map((group) => group.keeperId)).toEqual(['a', 'd']);
});

test('a keeper flagged elsewhere is never planned, and the exclusion is reported', () => {
  const plan = buildActionPlan(findings, choices({ itemSelectedIds: new Set(['a']) }), bytesOf);
  expect(plan.assetIds).toEqual([]);
  expect(plan.excludedKeeperIds).toEqual(['a']);
});

test('the keeper override is respected: the new keeper is protected, the old one may go', () => {
  const plan = buildActionPlan(
    findings,
    choices({ groupSelections: { g1: new Set(['a', 'b']) }, keeperOverrides: { g1: 'b' } }),
    bytesOf,
  );
  expect(plan.groups[0]).toMatchObject({ keeperId: 'b', removeIds: ['a'] });
});

test('protected photos and skipped groups never appear', () => {
  const plan = buildActionPlan(
    findings,
    choices({
      groupSelections: { g1: new Set(['b', 'c']), g2: new Set(['e']) },
      protectedIds: new Set(['c']),
      skippedIds: new Set(['g2']),
    }),
    bytesOf,
  );
  expect(plan.assetIds).toEqual(['b']);
});

test('a photo selected in a group and as a flagged item is listed and counted once', () => {
  const plan = buildActionPlan(
    findings,
    choices({ groupSelections: { g1: new Set(['b']) }, itemSelectedIds: new Set(['b']) }),
    bytesOf,
  );
  expect(plan.assetIds).toEqual(['b']);
  expect(plan.items).toEqual([]);
  expect(plan.bytes).toBe(80);
});

test('every planned group keeps at least one photo', () => {
  // Even if every member is somehow selected, the keeper stays.
  const plan = buildActionPlan(
    findings,
    choices({ groupSelections: { g1: new Set(['a', 'b', 'c']), g2: new Set(['d', 'e']) } }),
    bytesOf,
  );
  for (const group of plan.groups) {
    expect(group.removeIds).not.toContain(group.keeperId);
    expect(group.removeIds.length).toBeLessThan(group.finding.memberIds.length);
  }
});
