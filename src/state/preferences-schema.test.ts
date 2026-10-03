import { defaultPreferences, sanitizePreferences } from './preferences-schema';

test('valid stored preferences are kept as-is', () => {
  const stored = { appearance: 'dark', lessMotion: true, haptics: false, onboardingSeen: true };
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
    onboardingSeen: false,
  });
});

test('preferences saved before onboarding existed show the introduction once', () => {
  const beforeOnboarding = { appearance: 'dark', lessMotion: false, haptics: true };
  expect(sanitizePreferences(beforeOnboarding).onboardingSeen).toBe(false);
  expect(sanitizePreferences(beforeOnboarding).appearance).toBe('dark');
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
