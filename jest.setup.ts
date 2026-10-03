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

// Safe-area insets come from native; use the library's official mock.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Photos library and SQLite are native. Tests that need behavior use injected
// fakes (see library-scan.test.ts); everything else gets inert stand-ins:
// no access, an empty library, an empty database.
jest.mock('expo-media-library', () => ({
  AssetField: { CREATION_TIME: 'creationTime', MEDIA_TYPE: 'mediaType' },
  MediaType: { IMAGE: 'image', VIDEO: 'video', AUDIO: 'audio', UNKNOWN: 'unknown' },
  Query: jest.fn(),
  Asset: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({
    granted: false,
    canAskAgain: true,
    status: 'undetermined',
  })),
  requestPermissionsAsync: jest.fn(async () => ({
    granted: false,
    canAskAgain: false,
    status: 'denied',
  })),
  presentPermissionsPicker: jest.fn(async () => {}),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-sqlite', () => {
  const db: Record<string, unknown> = {};
  Object.assign(db, {
    execAsync: jest.fn(async () => {}),
    runAsync: jest.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => ({ user_version: 1 })),
    withExclusiveTransactionAsync: jest.fn(async (task: (txn: unknown) => Promise<void>) => {
      await task(db);
    }),
    prepareAsync: jest.fn(async () => ({
      executeAsync: jest.fn(async () => ({})),
      finalizeAsync: jest.fn(async () => {}),
    })),
  });
  return { openDatabaseAsync: jest.fn(async () => db) };
});
