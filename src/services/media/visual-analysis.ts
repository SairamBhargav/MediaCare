import MediaAnalysis from '../../../modules/media-analysis/src/MediaAnalysisModule';
import type {
  AnalysisResult,
  FacesResult,
  OriginalsResult,
  ToolResult,
} from '../../../modules/media-analysis/src/MediaAnalysis.types';
import { FILE_MD5_METHOD, ORIGINALS_METHOD, type FingerprintMethod } from '@/domain/exact-copies';
import type { ConnectionState } from '@/domain/icloud';

export type { AnalysisResult, FacesResult, OriginalsResult, ToolResult };

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

/** True in app builds that can download from iCloud when the user opts in (ADR-0009). */
export function cloudDownloadAvailable(): boolean {
  return (
    typeof MediaAnalysis?.analyzeFromCloud === 'function' &&
    typeof MediaAnalysis.hashOriginalsFromCloud === 'function' &&
    typeof MediaAnalysis.networkState === 'function'
  );
}

/** Connection and power state; read before each iCloud batch. */
export async function readConnection(): Promise<ConnectionState> {
  if (!MediaAnalysis?.networkState) throw new Error('Needs a newer MediaCare app build');
  return MediaAnalysis.networkState();
}

/** Like analyzePhotos, but iOS may download the small rendition from iCloud. */
export async function analyzePhotosFromCloud(ids: string[]): Promise<AnalysisResult[]> {
  if (!MediaAnalysis?.analyzeFromCloud) throw new Error('Needs a newer MediaCare app build');
  return MediaAnalysis.analyzeFromCloud(ids, ANALYSIS_MAX_SIDE);
}

/** Like hashOriginals, but originals only in iCloud are downloaded and streamed through the hash. */
export async function hashOriginalsFromCloud(ids: string[]): Promise<OriginalsResult[]> {
  if (!MediaAnalysis?.hashOriginalsFromCloud) throw new Error('Needs a newer MediaCare app build');
  return MediaAnalysis.hashOriginalsFromCloud(ids);
}

/** True in app builds that can fingerprint faces for People (ADR-0011). */
export function facesAvailable(): boolean {
  return typeof MediaAnalysis?.faces === 'function';
}

/** Longest side of the rendition faces are found on: big enough for faces in group photos. */
export const FACES_MAX_SIDE = 1024;

/**
 * Identifies how faces were fingerprinted, including the face model, so
 * adding the model to a build redoes faces with it (ADR-0011).
 */
export const FACES_IMPLEMENTATION = `faces/js1/native${MediaAnalysis?.facesVersion ?? 0}/${
  MediaAnalysis?.faceModel || 'apple-only'
}`;

/** True when this build includes the SFace face model (Apache 2.0), which needs its notice shown. */
export function faceModelIncluded(): boolean {
  return Boolean(MediaAnalysis?.faceModel);
}

export async function findFaces(ids: string[], allowNetwork: boolean): Promise<FacesResult[]> {
  if (!MediaAnalysis?.faces) throw new Error('People needs a newer MediaCare app build');
  return MediaAnalysis.faces(ids, FACES_MAX_SIDE, allowNetwork);
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
