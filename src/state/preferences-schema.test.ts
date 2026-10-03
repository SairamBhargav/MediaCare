import { defaultPreferences, sanitizePreferences } from './preferences-schema';

test('valid stored preferences are kept as-is', () => {
  const stored = { appearance: 'dark', lessMotion: true, haptics: false };
  expect(sanitizePreferences(stored)).toEqual(stored);
});

test.each([null, undefined, 'dark', 42, []])(
  'non-object input %p falls back to defaults',
  (input) => {
    expect(sanitizePreferences(input)).toEqual(defaultPreferences);
  },
);

test('invalid fields fall back individually; valid ones survive', () => {
  expect(sanitizePreferences({ appearance: 'sepia', lessMotion: 'yes', haptics: false })).toEqual({
    appearance: 'system',
    lessMotion: false,
    haptics: false,
  });
});

test('unknown extra fields are dropped', () => {
  expect(sanitizePreferences({ ...defaultPreferences, telemetry: true })).toEqual(
    defaultPreferences,
  );
});

test('returns a fresh object so callers cannot mutate the defaults', () => {
  const result = sanitizePreferences(null);
  result.haptics = false;
  expect(defaultPreferences.haptics).toBe(true);
});
