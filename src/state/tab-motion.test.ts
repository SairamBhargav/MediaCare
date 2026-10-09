import { noteTabMove, takeTabMove } from './tab-motion';

test('a move to a tab on the right slides in from the right, once', () => {
  noteTabMove('index', 'library');
  expect(takeTabMove()).toBe(1);
  expect(takeTabMove()).toBe(0);
});

test('a move to the left, the same tab, or an unknown screen', () => {
  noteTabMove('studio', 'index');
  expect(takeTabMove()).toBe(-1);
  noteTabMove('library', 'library');
  expect(takeTabMove()).toBe(0);
  noteTabMove('index', 'settings');
  expect(takeTabMove()).toBe(0);
});
