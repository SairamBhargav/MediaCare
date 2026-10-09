import MediaAnalysis from '../../../modules/media-analysis/src/MediaAnalysisModule';
import type {
  AdjustOptions,
  CollageCell,
  MovieResult,
  ToolResult,
  VideoSizeResult,
} from '../../../modules/media-analysis/src/MediaAnalysis.types';

export type { AdjustOptions, CollageCell, MovieResult, ToolResult, VideoSizeResult };

/**
 * Bridge to the creation tools in the MediaAnalysis native module (native
 * v3): manual adjustments, collages, video copies and trims, slideshows.
 * Absent in Expo Go and in older app builds; screens say what's needed.
 */
export function creationToolsAvailable(): boolean {
  return (MediaAnalysis?.toolsVersion ?? 0) >= 3;
}

function native() {
  if (!MediaAnalysis || !creationToolsAvailable()) {
    throw new Error('This tool needs the latest MediaCare app build');
  }
  return MediaAnalysis;
}

export function adjustPhoto(id: string, options: AdjustOptions): Promise<ToolResult> {
  return native().adjust(id, options);
}

export function makeCollage(options: {
  width: number;
  height: number;
  cells: CollageCell[];
  background: readonly [number, number, number];
}): Promise<ToolResult> {
  const [red, green, blue] = options.background;
  return native().collage({
    width: options.width,
    height: options.height,
    cells: options.cells,
    red,
    green,
    blue,
  });
}

export function measureVideoSizes(ids: string[]): Promise<VideoSizeResult[]> {
  return native().videoSizes(ids);
}

let taskCounter = 0;

/** A long-running native task with progress and cancel. */
export type MovieTask = {
  result: Promise<MovieResult>;
  cancel: () => void;
};

function runTask(
  start: (task: string) => Promise<MovieResult>,
  onProgress: (fraction: number) => void,
): MovieTask {
  const module = native();
  const task = `task-${Date.now()}-${(taskCounter += 1)}`;
  const subscription = module.addListener('onProgress', (event) => {
    if (event.task === task) onProgress(Math.max(0, Math.min(1, event.fraction)));
  });
  const result = start(task).finally(() => subscription.remove());
  return { result, cancel: () => module.cancelTask(task) };
}

export function exportVideo(
  id: string,
  options: { preset: string; start: number; end: number },
  onProgress: (fraction: number) => void,
): MovieTask {
  return runTask((task) => native().exportVideo(id, { ...options, task }), onProgress);
}

export function makeSlideshow(
  options: {
    ids: string[];
    width: number;
    height: number;
    secondsPerPhoto: number;
    transitionSeconds: number;
    gentleZoom: boolean;
  },
  onProgress: (fraction: number) => void,
): MovieTask {
  return runTask((task) => native().slideshow({ ...options, task }), onProgress);
}
