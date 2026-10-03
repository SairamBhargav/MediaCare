import { formatBytes, sumUniqueBytes } from './bytes';

describe('formatBytes', () => {
  test.each([
    [0, '0 bytes'],
    [1, '1 byte'],
    [999, '999 bytes'],
    [1000, '1 KB'],
    [1_500_000, '1.5 MB'],
    [1_000_000, '1 MB'],
    [312_400_000, '312 MB'],
    [999_950, '1 MB'],
    [2_450_000_000, '2.5 GB'],
  ])('SI: %d -> %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  test('IEC units distinguish MiB from MB', () => {
    expect(formatBytes(1_048_576, 'iec')).toBe('1 MiB');
    expect(formatBytes(1_000_000, 'iec')).toBe('977 KiB');
  });

  test('rejects invalid input instead of rendering a misleading size', () => {
    expect(() => formatBytes(-1)).toThrow(RangeError);
    expect(() => formatBytes(Number.NaN)).toThrow(RangeError);
  });
});

describe('sumUniqueBytes', () => {
  test('counts an asset once even if two findings include it', () => {
    expect(
      sumUniqueBytes([
        { id: 'a', bytes: 100 },
        { id: 'b', bytes: 50 },
        { id: 'a', bytes: 100 },
      ]),
    ).toBe(150);
  });
});
