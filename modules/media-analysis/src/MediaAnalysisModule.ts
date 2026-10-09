import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  AdjustOptions,
  AnalysisResult,
  CollageOptions,
  MovieResult,
  OriginalsResult,
  ProgressEvent,
  SlideshowOptions,
  ToolResult,
  VideoExportOptions,
  VideoSizeResult,
} from './MediaAnalysis.types';

type Events = { onProgress: (event: ProgressEvent) => void };

declare class MediaAnalysisModule extends NativeModule<Events> {
  readonly version: number;
  /** Absent in builds before the creation tools (native v3). */
  readonly toolsVersion?: number;
  analyze(ids: string[], maxSide: number): Promise<AnalysisResult[]>;
  enhance(id: string, enhance: boolean, redEye: boolean, maxSide: number): Promise<ToolResult>;
  removeBackground(id: string, maxSide: number): Promise<ToolResult>;
  hashOriginals(ids: string[]): Promise<OriginalsResult[]>;
  adjust(id: string, options: AdjustOptions): Promise<ToolResult>;
  collage(options: CollageOptions): Promise<ToolResult>;
  videoSizes(ids: string[]): Promise<VideoSizeResult[]>;
  exportVideo(id: string, options: VideoExportOptions): Promise<MovieResult>;
  slideshow(options: SlideshowOptions): Promise<MovieResult>;
  cancelTask(task: string): void;
}

/**
 * The native module, or null where it isn't compiled in (Expo Go, web,
 * tests). Callers must handle null and say that visual analysis needs the
 * MediaCare app build.
 */
export default requireOptionalNativeModule<MediaAnalysisModule>('MediaAnalysis');
