/**
 * Chronology for the Library. Pure.
 *
 * A photo's day and month are the *capture-local* ones: the wall-clock date
 * where it was taken, read from the stored timestamp ("2026-09-27T23:30:00-04:00"
 * is the 27th, even on a phone now set to UTC). This matches how people
 * remember photos and how Photos shows them. Unknown offsets keep the
 * wall-clock date and are never guessed or shifted. Missing or invalid dates
 * go to an "Undated" section instead of being invented.
 */
export type Dated = { readonly id: string; readonly capturedAt: string | null };

export type LocalDate = { readonly year: number; readonly month: number; readonly day: number };

export type MonthSection<T extends Dated> = {
  /** "2026-09", or "undated". Stable key for lists. */
  readonly key: string;
  readonly title: string;
  readonly items: readonly T[];
};

const ISO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/;

/** Capture-local calendar date of an ISO timestamp, or null if missing or invalid. */
export function captureLocalDate(iso: string | null): LocalDate | null {
  if (!iso) return null;
  const match = ISO_LOCAL.exec(iso);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // Reject impossible dates like 2026-02-30 without involving any time zone.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

const monthTitle = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "September 2026". Formatted in UTC from the local date, so no zone can shift it. */
export function formatMonth({ year, month }: Pick<LocalDate, 'year' | 'month'>): string {
  return monthTitle.format(new Date(Date.UTC(year, month - 1, 1)));
}

/**
 * Month sections, newest first; items within a month newest first by
 * capture-local wall clock; ties keep input order. Undated items come last.
 */
export function groupByMonth<T extends Dated>(items: readonly T[]): MonthSection<T>[] {
  const months = new Map<string, { date: LocalDate; items: { item: T; sortKey: string }[] }>();
  const undated: T[] = [];

  for (const item of items) {
    const date = captureLocalDate(item.capturedAt);
    if (!date || !item.capturedAt) {
      undated.push(item);
      continue;
    }
    const key = `${date.year}-${String(date.month).padStart(2, '0')}`;
    const bucket = months.get(key) ?? { date, items: [] };
    // The wall-clock prefix sorts correctly as a string within a month.
    bucket.items.push({ item, sortKey: item.capturedAt.slice(0, 19) });
    months.set(key, bucket);
  }

  const sections: MonthSection<T>[] = [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, bucket]) => ({
      key,
      title: formatMonth(bucket.date),
      items: bucket.items
        .map((entry, index) => ({ ...entry, index }))
        .sort((a, b) => b.sortKey.localeCompare(a.sortKey) || a.index - b.index)
        .map((entry) => entry.item),
    }));

  if (undated.length > 0) sections.push({ key: 'undated', title: 'Undated', items: undated });
  return sections;
}

/** Splits items into rows of `columns` for a virtualized grid. */
export function chunkRows<T>(items: readonly T[], columns: number): T[][] {
  const size = Math.max(1, Math.floor(columns));
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/**
 * Grid columns for a width and Dynamic Type scale: 3 on a typical phone,
 * more on wide screens, fewer when text is very large so tiles stay usable.
 */
export function gridColumns(width: number, fontScale: number): number {
  const base = width >= 900 ? 6 : width >= 680 ? 5 : width >= 500 ? 4 : 3;
  if (fontScale >= 1.6) return Math.max(2, base - 1);
  return base;
}
