import { photoUri } from './photo-library';

test('asset ids that already are ph:// URLs are used as-is', () => {
  expect(photoUri('ph://26687849-33F9-4402-8EC0-A622CD011D70/L0/001')).toBe(
    'ph://26687849-33F9-4402-8EC0-A622CD011D70/L0/001',
  );
});

test('a bare local identifier gets the ph:// prefix', () => {
  expect(photoUri('26687849-33F9-4402-8EC0-A622CD011D70/L0/001')).toBe(
    'ph://26687849-33F9-4402-8EC0-A622CD011D70/L0/001',
  );
});
