import { Storage } from 'expo-sqlite/kv-store';

import { usePreferences } from './preferences';
import { defaultPreferences } from './preferences-schema';

const KEY = 'mediacare.preferences';

function stored(): unknown {
  const raw = Storage.getItemSync(KEY);
  return raw === null ? null : JSON.parse(raw).state;
}

beforeEach(async () => {
  Storage.removeItemSync(KEY);
  usePreferences.setState(defaultPreferences);
  await usePreferences.persist.rehydrate();
});

test('changes are written to device storage as data only', () => {
  usePreferences.getState().setAppearance('dark');
  usePreferences.getState().setHaptics(false);
  expect(stored()).toEqual({
    appearance: 'dark',
    lessMotion: false,
    haptics: false,
    onboardingSeen: false,
  });
});

test('saved preferences are restored on rehydrate', async () => {
  Storage.setItemSync(
    KEY,
    JSON.stringify({ state: { appearance: 'light', lessMotion: true, haptics: true }, version: 1 }),
  );
  await usePreferences.persist.rehydrate();
  const { appearance, lessMotion } = usePreferences.getState();
  expect({ appearance, lessMotion }).toEqual({ appearance: 'light', lessMotion: true });
});

test('corrupted stored values fall back to defaults without throwing', async () => {
  Storage.setItemSync(
    KEY,
    JSON.stringify({ state: { appearance: 'neon', lessMotion: 'maybe' }, version: 1 }),
  );
  await usePreferences.persist.rehydrate();
  const { appearance, lessMotion, haptics, onboardingSeen } = usePreferences.getState();
  expect({ appearance, lessMotion, haptics, onboardingSeen }).toEqual(defaultPreferences);
});

test('unparseable JSON leaves defaults in place', async () => {
  Storage.setItemSync(KEY, '{not json');
  await usePreferences.persist.rehydrate();
  expect(usePreferences.getState().appearance).toBe('system');
});
