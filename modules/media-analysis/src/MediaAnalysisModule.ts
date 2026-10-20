import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  AdjustOptions,
  AnalysisResult,
  CollageOptions,
  FacesResult,
  MovieResult,
  NetworkState,
  OriginalsResult,
  ProgressEvent,
  SlideshowOptions,
  ToolResult,
  VideoExportOptions,
  VideoSizeResult,
} from './MediaAnalysis.types';

type Events = {
  onProgress: (event: ProgressEvent) => void;
  /** iOS ended the background run (stopped from the Live Activity, or out of time). */
  onBackgroundExpired: () => void;
};

declare class MediaAnalysisModule extends NativeModule<Events> {
  readonly version: number;
  /** Absent in builds before the creation tools (native v3). */
  readonly toolsVersion?: number;
  analyze(ids: string[], maxSide: number): Promise<AnalysisResult[]>;
  enhance(id: string, enhance: boolean, redEye: boolean, maxSide: number): Promise<ToolResult>;
  removeBackground(id: string, maxSide: number): Promise<ToolResult>;
  hashOriginals(ids: string[]): Promise<OriginalsResult[]>;
  /** Absent in builds before opt-in iCloud checking (ADR-0009). */
  readonly cloudVersion?: number;
  /** Like analyze, but iOS may download the small rendition from iCloud. */
  analyzeFromCloud?(ids: string[], maxSide: number): Promise<AnalysisResult[]>;
  /** Like hashOriginals, but files only in iCloud are downloaded (streamed through the hash). */
  hashOriginalsFromCloud?(ids: string[]): Promise<OriginalsResult[]>;
  networkState?(): Promise<NetworkState>;
  /** Absent in builds before People (ADR-0011). */
  readonly facesVersion?: number;
  /** Bundled face-recognition model name, or '' when this build has none. */
  readonly faceModel?: string;
  faces?(ids: string[], maxSide: number, allowNetwork: boolean): Promise<FacesResult[]>;
  /** Absent in builds before background checks (ADR-0010). */
  readonly backgroundVersion?: number;
  /** 'started', 'unsupported' (before iOS 26) or 'failed'. */
  beginBackgroundRun?(title: string, subtitle: string): 'started' | 'unsupported' | 'failed';
  updateBackgroundRun?(done: number, total: number, subtitle: string): void;
  endBackgroundRun?(success: boolean): void;
  requestNotifications?(): Promise<boolean>;
  notifyIfInBackground?(title: string, body: string): void;
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
