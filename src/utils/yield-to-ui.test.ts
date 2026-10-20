import { AppState } from 'react-native';

import { yieldToUi } from './yield-to-ui';

// The React Native Jest mock doesn't model currentState; set it per test.
const setState = (value: string) =>
  Object.defineProperty(AppState, 'currentState', { value, configurable: true, writable: true });

afterEach(() => {
  jest.useRealTimers();
});

test('in the foreground it waits for a timer turn', async () => {
  jest.useFakeTimers();
  setState('active');
  let done = false;
  const wait = yieldToUi().then(() => {
    done = true;
  });
  await Promise.resolve();
  expect(done).toBe(false);
  jest.runAllTimers();
  await wait;
  expect(done).toBe(true);
});

test('in the background it continues without a timer', async () => {
  jest.useFakeTimers();
  setState('background');
  await expect(yieldToUi()).resolves.toBeUndefined();
});
