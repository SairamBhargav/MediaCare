/**
 * Collage layouts (F19). Pure geometry: each layout is a list of normalized
 * cells (0–1, top-left origin) for a given photo count; `collageCells`
 * turns one into pixel rectangles with even spacing between and around the
 * photos.
 */
export type Rect = { x: number; y: number; width: number; height: number };

export type CollageLayout = { id: string; label: string; cells: readonly Rect[] };

export type CollageShape = { id: string; label: string; width: number; height: number };

export const COLLAGE_SHAPES: readonly CollageShape[] = [
  { id: 'square', label: 'Square', width: 2048, height: 2048 },
  { id: 'portrait', label: 'Portrait', width: 1638, height: 2048 },
  { id: 'story', label: 'Tall', width: 1152, height: 2048 },
  { id: 'landscape', label: 'Wide', width: 2048, height: 1536 },
];

export const COLLAGE_BACKGROUNDS: readonly {
  id: string;
  label: string;
  rgb: [number, number, number];
}[] = [
  { id: 'white', label: 'White', rgb: [1, 1, 1] },
  { id: 'black', label: 'Black', rgb: [0, 0, 0] },
  { id: 'cream', label: 'Cream', rgb: [0.96, 0.93, 0.87] },
];

export const MIN_COLLAGE_PHOTOS = 2;
export const MAX_COLLAGE_PHOTOS = 6;

const third = 1 / 3;

/** Rows of equal height, each split into equal columns. */
function rows(...columns: number[]): Rect[] {
  const height = 1 / columns.length;
  return columns.flatMap((count, row) =>
    Array.from({ length: count }, (_, column) => ({
      x: column / count,
      y: row * height,
      width: 1 / count,
      height,
    })),
  );
}

/** Columns of equal width, each split into equal rows. */
function columns(...rowCounts: number[]): Rect[] {
  return rows(...rowCounts).map((rect) => ({
    x: rect.y,
    y: rect.x,
    width: rect.height,
    height: rect.width,
  }));
}

const LAYOUTS: Record<number, readonly CollageLayout[]> = {
  2: [
    { id: '2-side', label: 'Side by side', cells: rows(2) },
    { id: '2-stack', label: 'Stacked', cells: rows(1, 1) },
  ],
  3: [
    {
      id: '3-feature-left',
      label: 'One big',
      cells: [
        { x: 0, y: 0, width: 0.6, height: 1 },
        { x: 0.6, y: 0, width: 0.4, height: 0.5 },
        { x: 0.6, y: 0.5, width: 0.4, height: 0.5 },
      ],
    },
    { id: '3-top', label: 'One on top', cells: rows(1, 2) },
    { id: '3-columns', label: 'Columns', cells: rows(3) },
  ],
  4: [
    { id: '4-grid', label: 'Grid', cells: rows(2, 2) },
    {
      id: '4-feature',
      label: 'One big',
      cells: [
        { x: 0, y: 0, width: 1, height: 0.62 },
        { x: 0, y: 0.62, width: third, height: 0.38 },
        { x: third, y: 0.62, width: third, height: 0.38 },
        { x: 2 * third, y: 0.62, width: third, height: 0.38 },
      ],
    },
    { id: '4-side', label: 'One tall', cells: columns(1, 3) },
  ],
  5: [
    { id: '5-rows', label: 'Two and three', cells: rows(2, 3) },
    {
      id: '5-feature',
      label: 'One big',
      cells: [
        { x: 0, y: 0, width: 1, height: 0.6 },
        { x: 0, y: 0.6, width: 0.25, height: 0.4 },
        { x: 0.25, y: 0.6, width: 0.25, height: 0.4 },
        { x: 0.5, y: 0.6, width: 0.25, height: 0.4 },
        { x: 0.75, y: 0.6, width: 0.25, height: 0.4 },
      ],
    },
  ],
  6: [
    { id: '6-grid', label: 'Grid', cells: rows(3, 3) },
    { id: '6-tall', label: 'Tall grid', cells: rows(2, 2, 2) },
  ],
};

export function layoutsFor(count: number): readonly CollageLayout[] {
  return LAYOUTS[count] ?? [];
}

/**
 * Pixel rectangles for a layout on a canvas. `spacing` is the share of the
 * shorter canvas side used for each gap (also around the edge); 0 for none.
 */
export function collageCells(
  layout: CollageLayout,
  ids: readonly string[],
  width: number,
  height: number,
  spacing: number,
): { id: string; x: number; y: number; width: number; height: number }[] {
  const gap = Math.round(Math.min(width, height) * Math.max(0, spacing));
  const innerWidth = width - gap;
  const innerHeight = height - gap;
  return layout.cells.slice(0, ids.length).map((cell, index) => {
    const left = Math.round(gap + cell.x * innerWidth);
    const top = Math.round(gap + cell.y * innerHeight);
    const right = Math.round(gap + (cell.x + cell.width) * innerWidth - gap);
    const bottom = Math.round(gap + (cell.y + cell.height) * innerHeight - gap);
    return {
      id: ids[index],
      x: left,
      y: top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    };
  });
}
