/**
 * Geometry for the photo viewer: where the photo sits on screen, how a grid
 * tile maps onto it for the open/close transition, when a drag dismisses,
 * and how far a zoomed photo may pan. Pure functions, usable from worklets.
 */

export type Rect = { x: number; y: number; width: number; height: number };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const DOUBLE_TAP_ZOOM = 2.5;
/** A drag past this distance (points) dismisses on release… */
export const DISMISS_DISTANCE = 120;
/** …as does a flick faster than this (points per second). */
export const DISMISS_VELOCITY = 900;

/**
 * The photo shown whole (contain) and centered in the container. Unknown
 * dimensions fall back to a square so something sensible still shows.
 */
export function fitRect(
  mediaWidth: number,
  mediaHeight: number,
  containerWidth: number,
  containerHeight: number,
): Rect {
  'worklet';
  const aspect = mediaWidth > 0 && mediaHeight > 0 ? mediaWidth / mediaHeight : 1;
  let width = containerWidth;
  let height = width / aspect;
  if (height > containerHeight) {
    height = containerHeight;
    width = height * aspect;
  }
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
}

/**
 * Transforms that place the viewer over the tile it was opened from, with
 * the photo cropped the way the tile crops it (cover).
 *
 * The viewer is a full-screen clipping mask (so a zoomed photo can use the
 * whole screen) scaled non-uniformly down to the tile's shape. The photo
 * sits centered inside at `fit` and is counter-scaled so it stays
 * undistorted at `photoScale`. Interpolating every value from this to
 * identity grows the tile into the viewer using transforms only.
 */
export type TileTransform = {
  maskScaleX: number;
  maskScaleY: number;
  translateX: number;
  translateY: number;
  photoScale: number;
};

export const IDENTITY: TileTransform = {
  maskScaleX: 1,
  maskScaleY: 1,
  translateX: 0,
  translateY: 0,
  photoScale: 1,
};

export function tileTransform(
  fit: Rect,
  tile: Rect,
  containerWidth: number,
  containerHeight: number,
): TileTransform {
  'worklet';
  return {
    maskScaleX: tile.width / containerWidth,
    maskScaleY: tile.height / containerHeight,
    // Scale is about the center, so move centers.
    translateX: tile.x + tile.width / 2 - containerWidth / 2,
    translateY: tile.y + tile.height / 2 - containerHeight / 2,
    photoScale: Math.max(tile.width / fit.width, tile.height / fit.height),
  };
}

export function mixTransform(from: TileTransform, to: TileTransform, t: number): TileTransform {
  'worklet';
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    maskScaleX: mix(from.maskScaleX, to.maskScaleX),
    maskScaleY: mix(from.maskScaleY, to.maskScaleY),
    translateX: mix(from.translateX, to.translateX),
    translateY: mix(from.translateY, to.translateY),
    photoScale: mix(from.photoScale, to.photoScale),
  };
}

/** Whether a released drag should close the viewer. */
export function shouldDismiss(translationY: number, velocityY: number): boolean {
  'worklet';
  return Math.abs(translationY) > DISMISS_DISTANCE || Math.abs(velocityY) > DISMISS_VELOCITY;
}

/** 0 at rest, 1 once the drag has gone half the screen; drives the backdrop fade. */
export function dragProgress(translationY: number, screenHeight: number): number {
  'worklet';
  return Math.min(1, Math.abs(translationY) / (screenHeight / 2));
}

/** How far a photo of `fit` size at `zoom` may pan before showing an edge. */
export function panLimits(
  fit: Rect,
  zoom: number,
  containerWidth: number,
  containerHeight: number,
): { x: number; y: number } {
  'worklet';
  return {
    x: Math.max(0, (fit.width * zoom - containerWidth) / 2),
    y: Math.max(0, (fit.height * zoom - containerHeight) / 2),
  };
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/**
 * Pan offset that keeps the point under the fingers (`focal`, relative to
 * the container center) fixed while zoom changes from `fromZoom` to `toZoom`.
 */
export function zoomAbout(
  focal: number,
  fromOffset: number,
  fromZoom: number,
  toZoom: number,
): number {
  'worklet';
  return focal - ((focal - fromOffset) * toZoom) / fromZoom;
}

/** Photo scale inside the mask, undoing the mask's non-uniform scale. */
export function photoScaleInMask(t: TileTransform): { x: number; y: number } {
  'worklet';
  return { x: t.photoScale / t.maskScaleX, y: t.photoScale / t.maskScaleY };
}
