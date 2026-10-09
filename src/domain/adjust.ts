/**
 * Manual photo adjustments (F16): the settings a person chooses in the
 * Adjust tool, and pure helpers for crop shapes after rotation. The native
 * module applies them; originals never change.
 */
export type Adjustments = {
  quarterTurns: number;
  flip: boolean;
  /** Degrees, clockwise positive. */
  straighten: number;
  /** Crop shape: `original` keeps the whole photo. */
  aspect: AspectId;
  exposure: number;
  contrast: number;
  saturation: number;
  warmth: number;
};

export type AspectId = 'original' | 'square' | '4:5' | '3:2' | '16:9' | '9:16';

export const ASPECTS: readonly { id: AspectId; label: string; ratio: number | null }[] = [
  { id: 'original', label: 'Original', ratio: null },
  { id: 'square', label: 'Square', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
];

export const NEUTRAL: Adjustments = {
  quarterTurns: 0,
  flip: false,
  straighten: 0,
  aspect: 'original',
  exposure: 0,
  contrast: 1,
  saturation: 1,
  warmth: 0,
};

/** Slider definitions: range, neutral value and how to show the value. */
export const SLIDERS = {
  exposure: { label: 'Brightness', min: -1.5, max: 1.5, step: 0.1, neutral: 0 },
  contrast: { label: 'Contrast', min: 0.6, max: 1.4, step: 0.05, neutral: 1 },
  saturation: { label: 'Color', min: 0, max: 1.8, step: 0.1, neutral: 1 },
  warmth: { label: 'Warmth', min: -1, max: 1, step: 0.1, neutral: 0 },
  straighten: { label: 'Straighten', min: -15, max: 15, step: 0.5, neutral: 0 },
} as const;

export type SliderKey = keyof typeof SLIDERS;

export function clampSlider(key: SliderKey, value: number): number {
  const { min, max, step } = SLIDERS[key];
  const stepped = Math.round(value / step) * step;
  return Math.round(Math.min(max, Math.max(min, stepped)) * 1000) / 1000;
}

/** Shown beside a slider: a signed whole number from -100 to 100. */
export function sliderPercent(key: SliderKey, value: number): string {
  const { min, max, neutral } = SLIDERS[key];
  if (key === 'straighten') return `${value > 0 ? '+' : ''}${value.toFixed(1)}°`;
  const span = value >= neutral ? max - neutral : neutral - min;
  const percent = Math.round(((value - neutral) / span) * 100);
  return `${percent > 0 ? '+' : ''}${percent}`;
}

export function isNeutral(adjustments: Adjustments): boolean {
  return (
    ((adjustments.quarterTurns % 4) + 4) % 4 === 0 &&
    !adjustments.flip &&
    adjustments.straighten === 0 &&
    adjustments.aspect === 'original' &&
    adjustments.exposure === 0 &&
    adjustments.contrast === 1 &&
    adjustments.saturation === 1 &&
    adjustments.warmth === 0
  );
}

/** Width and height after the quarter turns. */
export function turnedSize(width: number, height: number, quarterTurns: number) {
  return ((quarterTurns % 4) + 4) % 2 === 1 ? { width: height, height: width } : { width, height };
}

/** Largest centered crop with the chosen shape, normalized (top-left origin). */
export function centeredCrop(
  width: number,
  height: number,
  aspect: AspectId,
): { cropX: number; cropY: number; cropWidth: number; cropHeight: number } {
  const ratio = ASPECTS.find((option) => option.id === aspect)?.ratio ?? null;
  if (ratio === null || width <= 0 || height <= 0) {
    return { cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 };
  }
  const current = width / height;
  if (current > ratio) {
    const cropWidth = ratio / current;
    return { cropX: (1 - cropWidth) / 2, cropY: 0, cropWidth, cropHeight: 1 };
  }
  const cropHeight = current / ratio;
  return { cropX: 0, cropY: (1 - cropHeight) / 2, cropWidth: 1, cropHeight };
}

/** The native module's options for these adjustments on a photo of this size. */
export function toNativeOptions(
  adjustments: Adjustments,
  width: number,
  height: number,
  maxSide: number,
) {
  const turned = turnedSize(width, height, adjustments.quarterTurns);
  return {
    quarterTurns: ((adjustments.quarterTurns % 4) + 4) % 4,
    flip: adjustments.flip,
    straighten: adjustments.straighten,
    ...centeredCrop(turned.width, turned.height, adjustments.aspect),
    exposure: adjustments.exposure,
    contrast: adjustments.contrast,
    saturation: adjustments.saturation,
    warmth: adjustments.warmth,
    maxSide,
  };
}
