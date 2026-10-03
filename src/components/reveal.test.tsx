import { renderHook } from '@testing-library/react-native';

import { usePreferences } from '@/state/preferences';

import { resetSessionReveal, useSessionReveal } from './reveal';

beforeEach(() => {
  resetSessionReveal();
  usePreferences.getState().setLessMotion(false);
});

test('waits while the screen is covered, then reveals when first shown', async () => {
  const { result, rerender } = await renderHook(
    ({ focused }: { focused: boolean }) => useSessionReveal(focused),
    { initialProps: { focused: false } },
  );
  expect(result.current).toEqual({ ready: false, animate: true });
  await rerender({ focused: true });
  expect(result.current).toEqual({ ready: true, animate: true });
});

test('plays once per session: a remount shows content without animating', async () => {
  const first = await renderHook(() => useSessionReveal(true));
  expect(first.result.current.animate).toBe(true);
  await first.unmount();

  const second = await renderHook(() => useSessionReveal(false));
  expect(second.result.current).toEqual({ ready: true, animate: false });
});

test('never animates with reduced motion', async () => {
  usePreferences.getState().setLessMotion(true);
  const { result } = await renderHook(() => useSessionReveal(true));
  expect(result.current).toEqual({ ready: true, animate: false });
});
