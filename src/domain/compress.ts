/**
 * Compression planning. Pure: the encoder is injected, so the search is
 * deterministic and testable without a device.
 *
 * Quality-first: one encode at the chosen quality and maximum long edge.
 * Size-limit: find the highest quality that fits `targetBytes`, within a
 * bounded number of encodes. Dimensions shrink only if the user allowed it,
 * never below `minLongEdge`. If nothing fits, the result says so plainly
 * instead of quietly overshooting.
 */
export type Encoded = {
  readonly uri: string;
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
  readonly quality: number;
  readonly longEdge: number;
};

/** Encode at `quality` (0–1) with the long edge capped at `longEdge` pixels. */
export type EncodeFn = (quality: number, longEdge: number) => Promise<Encoded>;

/** Resize instruction that caps the long edge, or null if the image is already small enough. */
export function capLongEdge(
  width: number,
  height: number,
  longEdge: number,
): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= longEdge) return null;
  return width >= height ? { width: longEdge } : { height: longEdge };
}

export type TargetOptions = {
  targetBytes: number;
  sourceLongEdge: number;
  allowResize: boolean;
  encode: EncodeFn;
  minQuality?: number;
  maxQuality?: number;
  /** Encodes allowed per dimension step. */
  attemptsPerSize?: number;
  /** Never shrink the long edge below this. */
  minLongEdge?: number;
  /** Each resize step multiplies the long edge by this. */
  resizeStep?: number;
};

export type TargetResult =
  | { readonly status: 'fits'; readonly best: Encoded; readonly attempts: number }
  | { readonly status: 'not-achievable'; readonly smallest: Encoded; readonly attempts: number };

/** Highest quality at one size that fits, by bisection. */
async function searchQuality(
  longEdge: number,
  {
    targetBytes,
    encode,
    minQuality,
    maxQuality,
    attemptsPerSize,
  }: Required<
    Pick<TargetOptions, 'targetBytes' | 'encode' | 'minQuality' | 'maxQuality' | 'attemptsPerSize'>
  >,
): Promise<{ best: Encoded | null; smallest: Encoded; attempts: number }> {
  let attempts = 0;
  const top = await encode(maxQuality, longEdge);
  attempts += 1;
  if (top.bytes <= targetBytes) return { best: top, smallest: top, attempts };

  const bottom = await encode(minQuality, longEdge);
  attempts += 1;
  if (bottom.bytes > targetBytes) return { best: null, smallest: bottom, attempts };

  let best = bottom;
  let low = minQuality;
  let high = maxQuality;
  while (attempts < attemptsPerSize) {
    const mid = Math.round(((low + high) / 2) * 100) / 100;
    if (mid <= low || mid >= high) break;
    const candidate = await encode(mid, longEdge);
    attempts += 1;
    if (candidate.bytes <= targetBytes) {
      best = candidate;
      low = mid;
    } else {
      high = mid;
    }
  }
  return { best, smallest: bottom, attempts };
}

export async function compressToTarget({
  targetBytes,
  sourceLongEdge,
  allowResize,
  encode,
  minQuality = 0.4,
  maxQuality = 0.92,
  attemptsPerSize = 6,
  minLongEdge = 1080,
  resizeStep = 0.75,
}: TargetOptions): Promise<TargetResult> {
  if (!(targetBytes > 0)) throw new RangeError('Target size must be positive');
  const settings = { targetBytes, encode, minQuality, maxQuality, attemptsPerSize };
  let attempts = 0;
  let longEdge = sourceLongEdge;
  let smallest: Encoded | null = null;

  for (;;) {
    const result = await searchQuality(longEdge, settings);
    attempts += result.attempts;
    if (!smallest || result.smallest.bytes < smallest.bytes) smallest = result.smallest;
    if (result.best) return { status: 'fits', best: result.best, attempts };

    const next = Math.round(longEdge * resizeStep);
    if (!allowResize || next < Math.min(minLongEdge, sourceLongEdge)) break;
    longEdge = next;
  }
  return { status: 'not-achievable', smallest, attempts };
}

export type SavingsVerdict =
  | { readonly kind: 'smaller'; readonly saved: number; readonly percent: number }
  | { readonly kind: 'not-smaller'; readonly extra: number }
  | { readonly kind: 'unknown' };

/** Compares a copy with its source. Never calls a bigger copy an optimization. */
export function savings(sourceBytes: number | null, copyBytes: number): SavingsVerdict {
  if (sourceBytes === null || sourceBytes <= 0) return { kind: 'unknown' };
  if (copyBytes >= sourceBytes) return { kind: 'not-smaller', extra: copyBytes - sourceBytes };
  const saved = sourceBytes - copyBytes;
  return { kind: 'smaller', saved, percent: Math.round((saved / sourceBytes) * 100) };
}
