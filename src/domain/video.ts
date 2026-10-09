/**
 * Video copies, trims and slideshows (F20, F22). Pure helpers: export
 * presets with plain names, trim validation, and slideshow shapes. Sizes
 * are only ever what the native module measured; nothing is estimated.
 */
export type VideoPreset = {
  id: string;
  label: string;
  detail: string;
  /** AVAssetExportSession preset name. */
  native: string;
};

export const VIDEO_PRESETS: readonly VideoPreset[] = [
  {
    id: '1080',
    label: 'High (1080p)',
    detail: 'Sharp on any screen. Usually a little smaller.',
    native: 'AVAssetExportPreset1920x1080',
  },
  {
    id: '720',
    label: 'Medium (720p)',
    detail: 'Good for sharing. Often much smaller.',
    native: 'AVAssetExportPreset1280x720',
  },
  {
    id: '540',
    label: 'Small (540p)',
    detail: 'For messages and email. Smallest.',
    native: 'AVAssetExportPreset960x540',
  },
];

/** Keeps the original quality; used when only trimming. */
export const TRIM_ONLY_PRESET = 'AVAssetExportPresetPassthrough';

/** Shortest clip a trim may produce, in seconds. */
export const MIN_CLIP_SECONDS = 1;

/** Clamps a trim to the video and keeps it at least MIN_CLIP_SECONDS long. */
export function clampTrim(
  start: number,
  end: number,
  duration: number,
): { start: number; end: number } {
  const total = Math.max(0, duration);
  if (total <= MIN_CLIP_SECONDS) return { start: 0, end: total };
  let s = Math.min(Math.max(0, start), total - MIN_CLIP_SECONDS);
  let e = Math.max(Math.min(total, end), MIN_CLIP_SECONDS);
  if (e - s < MIN_CLIP_SECONDS) {
    if (s + MIN_CLIP_SECONDS <= total) e = s + MIN_CLIP_SECONDS;
    else s = e - MIN_CLIP_SECONDS;
  }
  return { start: round(s), end: round(e) };
}

export function isTrimmed(range: { start: number; end: number }, duration: number): boolean {
  return range.start > 0.05 || range.end < duration - 0.05;
}

function round(seconds: number) {
  return Math.round(seconds * 10) / 10;
}

/** "1:05.3" style for trim handles. */
export function formatSeconds(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}

export type SlideshowShape = { id: string; label: string; width: number; height: number };

export const SLIDESHOW_SHAPES: readonly SlideshowShape[] = [
  { id: 'wide', label: 'Wide (TV)', width: 1920, height: 1080 },
  { id: 'tall', label: 'Tall (phone)', width: 1080, height: 1920 },
  { id: 'square', label: 'Square', width: 1080, height: 1080 },
];

export const SLIDESHOW_PACES: readonly { id: string; label: string; seconds: number }[] = [
  { id: 'quick', label: 'Quick', seconds: 2 },
  { id: 'normal', label: 'Normal', seconds: 3.5 },
  { id: 'slow', label: 'Slow', seconds: 5 },
];

export const MIN_SLIDESHOW_PHOTOS = 2;
export const MAX_SLIDESHOW_PHOTOS = 60;

export function slideshowSeconds(photos: number, secondsPerPhoto: number): number {
  return photos * secondsPerPhoto;
}

/** Compares a new file with its source honestly; null source means unmeasured. */
export function sizeChange(
  sourceBytes: number | null,
  outputBytes: number,
): { kind: 'smaller'; percent: number } | { kind: 'not-smaller' } | { kind: 'unknown' } {
  if (sourceBytes === null || sourceBytes <= 0) return { kind: 'unknown' };
  if (outputBytes >= sourceBytes) return { kind: 'not-smaller' };
  return { kind: 'smaller', percent: Math.round((1 - outputBytes / sourceBytes) * 100) };
}
