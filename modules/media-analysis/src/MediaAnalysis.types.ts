/** One face Vision found. Coordinates are normalized (0–1, origin bottom-left). */
export type FaceResult = {
  /** Vision face capture quality, 0–1; -1 if unavailable. */
  quality: number;
  /** Eye height / width from the landmark outline; higher is more open; -1 if unknown. */
  leftEyeOpen: number;
  rightEyeOpen: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Measurements for one Photos asset, as returned by the native module. */
export type AnalysisResult = {
  id: string;
  /** `in-icloud`: no local rendition, nothing downloaded. */
  status: 'ok' | 'missing' | 'unsupported' | 'in-icloud' | 'failed';
  analyzedWidth?: number;
  analyzedHeight?: number;
  /** Vision feature print; compare with Euclidean distance. */
  featurePrint?: number[];
  featurePrintError?: string;
  faces?: FaceResult[];
  faceError?: string;
  /** Laplacian variance of a 256 px greyscale copy (whole frame). */
  sharpness?: number;
  /** Same, in the sharpest cell of a 4×4 grid. */
  sharpnessMaxTile?: number;
  /** Mean brightness, 0–1. */
  brightness?: number;
  /** Share of near-black / near-white pixels. */
  darkFraction?: number;
  brightFraction?: number;
  /** People found: joint name → [x, y], normalized, origin bottom-left (confident joints only). */
  poses?: Record<string, [number, number]>[];
  /** 8×8 mean brightness grid (0–1), row by row: where light and dark sit. */
  layout?: number[];
};

/** Result of a photo tool: a temporary image file to preview, then save as a new photo. */
export type ToolResult = {
  /** `in-icloud`: only in iCloud, nothing downloaded; `no-subject`: nothing to lift; `unsupported-os`: needs iOS 17. */
  status:
    'ok' | 'missing' | 'unsupported' | 'in-icloud' | 'failed' | 'no-subject' | 'unsupported-os';
  uri?: string;
  width?: number;
  height?: number;
  /** Core Image filters actually applied (enhance / red-eye). */
  applied?: string[];
  /** Subjects lifted (background removal). */
  subjects?: number;
  error?: string;
};

/** Manual adjustments (geometry, then light and color). Crop is normalized, top-left origin, after rotation. */
export type AdjustOptions = {
  quarterTurns: number;
  flip: boolean;
  /** Degrees, clockwise positive. */
  straighten: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  /** Exposure in EV stops. */
  exposure: number;
  /** 1 = unchanged. */
  contrast: number;
  /** 1 = unchanged, 0 = black and white. */
  saturation: number;
  /** -1 cooler … 1 warmer. */
  warmth: number;
  maxSide: number;
};

/** One collage cell in output pixels, top-left origin. */
export type CollageCell = { id: string; x: number; y: number; width: number; height: number };

export type CollageOptions = {
  width: number;
  height: number;
  cells: CollageCell[];
  /** Background color, 0–1 per channel. */
  red: number;
  green: number;
  blue: number;
};

export type VideoSizeResult = {
  id: string;
  status: 'ok' | 'missing' | 'in-icloud' | 'unsupported' | 'failed';
  bytes?: number;
};

export type VideoExportOptions = {
  preset: string;
  start: number;
  end: number;
  task: string;
};

export type SlideshowOptions = {
  ids: string[];
  width: number;
  height: number;
  secondsPerPhoto: number;
  transitionSeconds: number;
  gentleZoom: boolean;
  task: string;
};

/** A new movie file (video copy, trim or slideshow) to preview, then save. */
export type MovieResult = {
  status: 'ok' | 'missing' | 'in-icloud' | 'failed' | 'cancelled';
  uri?: string;
  bytes?: number;
  width?: number;
  height?: number;
  /** Seconds. */
  duration?: number;
  preset?: string;
  /** Slideshow photos that couldn't be read (shown as black). */
  missing?: string[];
  error?: string;
};

export type ProgressEvent = { task: string; fraction: number };

/** One file Photos keeps for a photo (PHAssetResourceType raw value, e.g. 1 photo, 9 paired video). */
export type OriginalResource = { type: number; filename: string; bytes: number; sha256: string };

export type OriginalsResult = {
  id: string;
  /** `unavailable`: some resource is only in iCloud (nothing downloaded) or unreadable. */
  status: 'ok' | 'missing' | 'unsupported' | 'unavailable';
  resources?: OriginalResource[];
  error?: string;
};

/** Connection and power state, read before each batch that may download from iCloud (ADR-0009). */
export type NetworkState = {
  /** False if iOS didn't report a network path in time. */
  known: boolean;
  connected: boolean;
  /** Mobile data or a personal hotspot. */
  expensive: boolean;
  /** Low Data Mode. */
  constrained: boolean;
  lowPower: boolean;
};

/** One face found for People (ADR-0011). Box normalized, origin bottom-left. */
export type FaceFound = {
  /** `small`: too small or without landmarks to recognize; no fingerprints. */
  status: 'ok' | 'small';
  x: number;
  y: number;
  width: number;
  height: number;
  /** Vision face capture quality, 0–1; -1 if unknown. */
  quality: number;
  /** Apple feature print of the aligned face: base64 Float32, L2-normalized. */
  applePrint?: string;
  /** Face-model fingerprint (SFace) when the build includes the model. */
  modelPrint?: string;
};

export type FacesResult = {
  id: string;
  status: 'ok' | 'missing' | 'unsupported' | 'in-icloud' | 'failed';
  faces?: FaceFound[];
  /** Face model used, if any. */
  model?: string;
  error?: string;
};
