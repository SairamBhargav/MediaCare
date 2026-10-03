import { useLibrarySession } from './library-session';

const session = () => useLibrarySession.getState();

beforeEach(() => session().reset());

test('selection only changes in Select mode', () => {
  session().toggle('a');
  expect(session().selected.size).toBe(0);

  session().setSelecting(true);
  session().toggle('a');
  session().toggle('b');
  session().toggle('a');
  expect([...session().selected]).toEqual(['b']);
});

test('entering or leaving Select mode clears the selection', () => {
  session().setSelecting(true);
  session().toggle('a');
  session().setSelecting(false);
  expect(session().selected.size).toBe(0);
  session().setSelecting(true);
  expect(session().selected.size).toBe(0);
});

test('retain drops photos that left the library and keeps the rest', () => {
  session().setSelecting(true);
  session().toggle('a');
  session().toggle('b');
  const before = session().selected;
  session().retain(new Set(['a', 'b', 'c']));
  expect(session().selected).toBe(before);
  session().retain(new Set(['b']));
  expect([...session().selected]).toEqual(['b']);
});

test('remembers the resting scroll offset, never negative', () => {
  session().rememberOffset(1234);
  expect(session().scrollOffset).toBe(1234);
  session().rememberOffset(-40);
  expect(session().scrollOffset).toBe(0);
});
