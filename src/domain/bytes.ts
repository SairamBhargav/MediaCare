/**
 * Byte formatting. iOS reports storage in decimal (SI) units, so the UI uses
 * SI by default: 1 MB = 1,000,000 bytes. IEC units (1 MiB = 1,048,576 bytes)
 * are available where precision about binary sizes matters (docs/PRD.md,
 * compression targets).
 */
export type ByteUnitSystem = 'si' | 'iec';

const UNITS: Record<ByteUnitSystem, { base: number; units: readonly string[] }> = {
  si: { base: 1000, units: ['bytes', 'KB', 'MB', 'GB', 'TB'] },
  iec: { base: 1024, units: ['bytes', 'KiB', 'MiB', 'GiB', 'TiB'] },
};

export function formatBytes(bytes: number, system: ByteUnitSystem = 'si'): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new RangeError(`Byte count must be a finite, non-negative number; received ${bytes}`);
  }
  const { base, units } = UNITS[system];
  if (bytes < base) {
    return bytes === 1 ? '1 byte' : `${Math.round(bytes)} bytes`;
  }
  let value = bytes;
  let unitIndex = 0;
  while (value >= base && unitIndex < units.length - 1) {
    value /= base;
    unitIndex += 1;
  }
  // One decimal below 10 (e.g. "2.4 MB"), whole numbers above ("312 MB").
  let rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  // Rounding can carry into the next unit ("999.95 KB" -> "1000 KB").
  if (rounded >= base && unitIndex < units.length - 1) {
    rounded = 1;
    unitIndex += 1;
  }
  return `${rounded} ${units[unitIndex]}`;
}

/** Sum of logical sizes, counting each asset id once even if listed twice. */
export function sumUniqueBytes(items: readonly { id: string; bytes: number }[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    total += item.bytes;
  }
  return total;
}

/** Like `formatBytes`, but says so plainly when a size has not been measured. */
export function formatSize(bytes: number | null): string {
  return bytes === null ? 'Size not measured' : formatBytes(bytes);
}
