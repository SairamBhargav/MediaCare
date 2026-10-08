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
};
