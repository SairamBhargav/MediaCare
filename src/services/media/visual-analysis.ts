import MediaAnalysis from '../../../modules/media-analysis/src/MediaAnalysisModule';
import type {
  AnalysisResult,
  ToolResult,
} from '../../../modules/media-analysis/src/MediaAnalysis.types';

export type { AnalysisResult, ToolResult };

/**
 * Bridge to the MediaAnalysis native module (Apple Vision + Core Image).
 * It exists only in the MediaCare app build: in Expo Go, tests and web it
 * is null, and the app says that visual analysis needs the app build.
 */
export function visualAnalysisAvailable(): boolean {
  return MediaAnalysis !== null;
}

/** Size of the rendition analyzed (longest side, px). */
export const ANALYSIS_MAX_SIDE = 512;
/** Bump when the native measurements or their interpretation change; old scores are redone. */
export const ANALYSIS_IMPLEMENTATION = 'vision-fp+lap256+faces/v1';

export async function analyzePhotos(ids: string[]): Promise<AnalysisResult[]> {
  if (!MediaAnalysis) throw new Error('Visual analysis needs the MediaCare app build');
  return MediaAnalysis.analyze(ids, ANALYSIS_MAX_SIDE);
}

/** Longest side for tool outputs (enhance, red-eye, background removal). */
export const TOOL_MAX_SIDE = 4096;

export async function enhancePhoto(
  id: string,
  { enhance, redEye }: { enhance: boolean; redEye: boolean },
): Promise<ToolResult> {
  if (!MediaAnalysis) throw new Error('Photo tools need the MediaCare app build');
  return MediaAnalysis.enhance(id, enhance, redEye, TOOL_MAX_SIDE);
}

export async function removeBackground(id: string): Promise<ToolResult> {
  if (!MediaAnalysis) throw new Error('Photo tools need the MediaCare app build');
  return MediaAnalysis.removeBackground(id, TOOL_MAX_SIDE);
}
