import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { AnalysisResult, OriginalsResult, ToolResult } from './MediaAnalysis.types';

declare class MediaAnalysisModule extends NativeModule<Record<string, never>> {
  readonly version: number;
  analyze(ids: string[], maxSide: number): Promise<AnalysisResult[]>;
  enhance(id: string, enhance: boolean, redEye: boolean, maxSide: number): Promise<ToolResult>;
  removeBackground(id: string, maxSide: number): Promise<ToolResult>;
  hashOriginals(ids: string[]): Promise<OriginalsResult[]>;
}

/**
 * The native module, or null where it isn't compiled in (Expo Go, web,
 * tests). Callers must handle null and say that visual analysis needs the
 * MediaCare app build.
 */
export default requireOptionalNativeModule<MediaAnalysisModule>('MediaAnalysis');
