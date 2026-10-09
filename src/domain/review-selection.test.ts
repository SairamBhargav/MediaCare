import {
  canSelect,
  clearSelection,
  createReviewSelection,
  selectAllExceptKeeper,
  selectRest,
  setKeeper,
  toggleSelected,
  type ReviewGroup,
} from './review-selection';

const group: ReviewGroup = {
  memberIds: ['a', 'b', 'c', 'd'],
  keeperId: 'a',
  protectedIds: new Set(['d']),
};

test('starts with nothing selected', () => {
  expect(createReviewSelection(group).selectedIds.size).toBe(0);
});

test('rejects a keeper that is not in the group', () => {
  expect(() => createReviewSelection({ ...group, keeperId: 'z' })).toThrow();
});

test('toggles a normal member on and off', () => {
  const start = createReviewSelection(group);
  const on = toggleSelected(group, start, 'b');
  expect([...on.selectedIds]).toEqual(['b']);
  const off = toggleSelected(group, on, 'b');
  expect(off.selectedIds.size).toBe(0);
});

test('never selects the keeper', () => {
  const selection = toggleSelected(group, createReviewSelection(group), 'a');
  expect(selection.selectedIds.has('a')).toBe(false);
  expect(canSelect(group, selection, 'a')).toBe(false);
});

test('never selects a protected item', () => {
  const selection = toggleSelected(group, createReviewSelection(group), 'd');
  expect(selection.selectedIds.has('d')).toBe(false);
});

test('ignores ids outside the group', () => {
  const start = createReviewSelection(group);
  expect(toggleSelected(group, start, 'zzz')).toBe(start);
});

test('select all leaves the keeper and protected items out', () => {
  const all = selectAllExceptKeeper(group, createReviewSelection(group));
  expect([...all.selectedIds].sort()).toEqual(['b', 'c']);
});

test('promoting a selected item to keeper deselects it, so one item is always kept', () => {
  const all = selectAllExceptKeeper(group, createReviewSelection(group));
  const next = setKeeper(group, all, 'b');
  expect(next.keeperId).toBe('b');
  expect(next.selectedIds.has('b')).toBe(false);
  // The previous keeper is now an ordinary, unselected member.
  expect(next.selectedIds.has('a')).toBe(false);
  expect(canSelect(group, next, 'a')).toBe(true);
});

test('clear removes all selections without changing the keeper', () => {
  const all = selectAllExceptKeeper(group, createReviewSelection(group));
  const cleared = clearSelection(all);
  expect(cleared.selectedIds.size).toBe(0);
  expect(cleared.keeperId).toBe('a');
});

describe('selectRest', () => {
  const bigGroup: ReviewGroup = {
    memberIds: ['k', 'a', 'b', 'c', 'p'],
    keeperId: 'k',
    protectedIds: new Set(['p']),
  };

  test('marks everything but the keeper, protected photos and the also-keep suggestion', () => {
    const rest = selectRest(bigGroup, createReviewSelection(bigGroup), ['b']);
    expect([...rest.selectedIds].sort()).toEqual(['a', 'c']);
  });

  test('without suggestions it is the same as selecting all but the keeper', () => {
    const selection = createReviewSelection(bigGroup);
    expect(selectRest(bigGroup, selection).selectedIds).toEqual(
      selectAllExceptKeeper(bigGroup, selection).selectedIds,
    );
  });

  test('an also-keep photo can still be marked by hand', () => {
    const rest = selectRest(bigGroup, createReviewSelection(bigGroup), ['b']);
    expect(toggleSelected(bigGroup, rest, 'b').selectedIds.has('b')).toBe(true);
  });
});
