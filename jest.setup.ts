// Worklets and Reanimated need their official mocks under Jest: there is no
// native UI runtime in Node. These mocks run animations synchronously, so
// tests verify state and accessibility, never animation feel.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  // The official mock predates the CSS animation API; fill in the pieces the
  // app uses. Easing and stylesheet values are inert data in tests.
  return {
    ...mock,
    useReducedMotion: () => false,
    cubicBezier: (x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2 }),
    css: { create: <T>(styles: T) => styles, keyframes: <T>(frames: T) => frames },
  };
});

// Accessibility-aware matchers such as toBeChecked() and toBeOnTheScreen().
require('@testing-library/react-native/dist/matchers/extend-expect');

// expo-sqlite is native. Preferences use its key-value store; give tests an
// in-memory stand-in with the same synchronous API.
jest.mock('expo-sqlite/kv-store', () => {
  const memory = new Map<string, string>();
  const Storage = {
    getItemSync: (key: string) => memory.get(key) ?? null,
    setItemSync: (key: string, value: string) => void memory.set(key, value),
    removeItemSync: (key: string) => memory.delete(key),
  };
  return { __esModule: true, Storage, default: Storage };
});
