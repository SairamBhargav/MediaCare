import MediaAnalysis from '../../../modules/media-analysis/src/MediaAnalysisModule';
import type {
  AnalysisResult,
  OriginalsResult,
  ToolResult,
} from '../../../modules/media-analysis/src/MediaAnalysis.types';
import { FILE_MD5_METHOD, ORIGINALS_METHOD, type FingerprintMethod } from '@/domain/exact-copies';

export type { AnalysisResult, OriginalsResult, ToolResult };

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
/**
 * Identifies how scores were made. It includes the native module's own
 * version, so results from an older app build (without poses, say) are
 * redone after updating. Bump the JS part when interpretation changes.
 */
export const ANALYSIS_IMPLEMENTATION = `vision-analysis/js2/native${MediaAnalysis?.version ?? 0}`;

export async function analyzePhotos(ids: string[]): Promise<AnalysisResult[]> {
  if (!MediaAnalysis) throw new Error('Visual analysis needs the MediaCare app build');
  return MediaAnalysis.analyze(ids, ANALYSIS_MAX_SIDE);
}

/** True in app builds whose native module can hash Photos resources (native version 2+). */
export function originalsHashingAvailable(): boolean {
  return typeof MediaAnalysis?.hashOriginals === 'function';
}

/** The exact-copies method this build supports. */
export function activeCopyMethod(): FingerprintMethod {
  return originalsHashingAvailable() ? ORIGINALS_METHOD : FILE_MD5_METHOD;
}

export async function hashOriginals(ids: string[]): Promise<OriginalsResult[]> {
  if (!MediaAnalysis || !originalsHashingAvailable()) {
    throw new Error('Hashing originals needs a newer MediaCare app build');
  }
  return MediaAnalysis.hashOriginals(ids);
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
