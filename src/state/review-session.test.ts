import type { GroupFinding } from '@/domain/findings';
import { toggleSelected } from '@/domain/review-selection';

import { selectionFor, toReviewGroup, useReviewSession } from './review-session';

const group: GroupFinding = {
  kind: 'group',
  id: 'g1',
  category: 'similar',
  title: 'Pier',
  memberIds: ['a', 'b', 'c'],
  keeperId: 'a',
  keeperReason: 'sharpest',
};

const review = () => useReviewSession.getState();

function select(id: string) {
  const state = review();
  state.setGroupSelection(
    group.id,
    toggleSelected(toReviewGroup(group, state), selectionFor(group, state), id),
  );
}

beforeEach(() => review().reset());

test('selections persist in the session until reset', () => {
  select('b');
  expect([...selectionFor(group, review()).selectedIds]).toEqual(['b']);
  review().reset();
  expect(selectionFor(group, review()).selectedIds.size).toBe(0);
});

test('protecting a selected photo deselects it everywhere and blocks reselection', () => {
  select('b');
  review().toggleItem('b');
  review().toggleProtected('b');
  expect(selectionFor(group, review()).selectedIds.has('b')).toBe(false);
  expect(review().itemSelectedIds.has('b')).toBe(false);
  select('b');
  review().toggleItem('b');
  expect(selectionFor(group, review()).selectedIds.has('b')).toBe(false);
  expect(review().itemSelectedIds.has('b')).toBe(false);
});

test('unprotecting makes a photo selectable again', () => {
  review().toggleProtected('b');
  review().toggleProtected('b');
  select('b');
  expect(selectionFor(group, review()).selectedIds.has('b')).toBe(true);
});

test('choosing a new keeper deselects it and frees the old keeper', () => {
  select('b');
  select('c');
  review().setGroupKeeper(group, 'c');
  const selection = selectionFor(group, review());
  expect(selection.keeperId).toBe('c');
  expect([...selection.selectedIds]).toEqual(['b']);
});

test('skipping clears the selection but remembers a chosen keeper; unskip restores the group', () => {
  review().setGroupKeeper(group, 'b');
  select('c');
  review().skip(group.id);
  expect(review().skippedIds.has(group.id)).toBe(true);
  expect(selectionFor(group, review())).toMatchObject({ keeperId: 'b' });
  expect(selectionFor(group, review()).selectedIds.size).toBe(0);
  review().unskip(group.id);
  expect(review().skippedIds.has(group.id)).toBe(false);
});
