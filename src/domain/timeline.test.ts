import { captureLocalDate, chunkRows, formatMonth, gridColumns, groupByMonth } from './timeline';

describe('captureLocalDate', () => {
  test('uses the wall-clock date where the photo was taken, not the device zone', () => {
    // 23:30 in New York is already the 28th in UTC; the photo still belongs to the 27th.
    expect(captureLocalDate('2026-09-27T23:30:00-04:00')).toEqual({
      year: 2026,
      month: 9,
      day: 27,
    });
    // 00:30 in Tokyo is still the 26th in UTC; the photo belongs to the 27th.
    expect(captureLocalDate('2026-09-27T00:30:00+09:00')).toEqual({
      year: 2026,
      month: 9,
      day: 27,
    });
  });

  test('keeps the wall-clock date when the offset is unknown', () => {
    expect(captureLocalDate('2026-09-27T23:30:00')).toEqual({ year: 2026, month: 9, day: 27 });
  });

  test('missing, malformed or impossible dates are undated, never invented', () => {
    expect(captureLocalDate(null)).toBeNull();
    expect(captureLocalDate('yesterday')).toBeNull();
    expect(captureLocalDate('2026-02-30T10:00:00Z')).toBeNull();
  });
});

test('formatMonth is not shifted by time zones', () => {
  expect(formatMonth({ year: 2026, month: 1 })).toBe('January 2026');
  expect(formatMonth({ year: 2025, month: 12 })).toBe('December 2025');
});

describe('groupByMonth', () => {
  const items = [
    { id: 'aug', capturedAt: '2026-08-02T09:00:00-04:00' },
    { id: 'sep-early', capturedAt: '2026-09-01T08:00:00-04:00' },
    { id: 'none', capturedAt: null },
    { id: 'sep-late', capturedAt: '2026-09-30T23:59:00-04:00' },
    { id: 'bad', capturedAt: 'not a date' },
    { id: 'sep-late-twin', capturedAt: '2026-09-30T23:59:00-04:00' },
  ];

  test('newest month first, newest photo first, ties keep their order', () => {
    const sections = groupByMonth(items);
    expect(sections.map((section) => section.title)).toEqual([
      'September 2026',
      'August 2026',
      'Undated',
    ]);
    expect(sections[0].items.map((item) => item.id)).toEqual([
      'sep-late',
      'sep-late-twin',
      'sep-early',
    ]);
  });

  test('undated photos are kept, together, at the end', () => {
    const undated = groupByMonth(items).at(-1)!;
    expect(undated.key).toBe('undated');
    expect(undated.items.map((item) => item.id)).toEqual(['none', 'bad']);
  });

  test('a late-evening photo stays in its own month across a UTC boundary', () => {
    const [section] = groupByMonth([{ id: 'x', capturedAt: '2026-09-30T22:00:00-07:00' }]);
    expect(section.title).toBe('September 2026');
  });
});

test('chunkRows splits into full rows with a short last row', () => {
  expect(chunkRows([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  expect(chunkRows([], 3)).toEqual([]);
});

test('gridColumns adapts to width and very large text', () => {
  expect(gridColumns(393, 1)).toBe(3);
  expect(gridColumns(320, 1)).toBe(3);
  expect(gridColumns(393, 2)).toBe(2);
  expect(gridColumns(744, 1)).toBe(5);
  expect(gridColumns(1024, 1)).toBe(6);
});
