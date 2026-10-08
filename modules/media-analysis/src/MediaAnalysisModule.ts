import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { AnalysisResult } from './MediaAnalysis.types';

declare class MediaAnalysisModule extends NativeModule<Record<string, never>> {
  readonly version: number;
  analyze(ids: string[], maxSide: number): Promise<AnalysisResult[]>;
}

/**
 * The native module, or null where it isn't compiled in (Expo Go, web,
 * tests). Callers must handle null and say that visual analysis needs the
 * MediaCare app build.
 */
export default requireOptionalNativeModule<MediaAnalysisModule>('MediaAnalysis');
