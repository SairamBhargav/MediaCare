import {
  MAX_COLLAGE_PHOTOS,
  MIN_COLLAGE_PHOTOS,
  collageCells,
  layoutsFor,
  type Rect,
} from './collage';

function area(cells: readonly Rect[]) {
  return cells.reduce((sum, cell) => sum + cell.width * cell.height, 0);
}

function overlaps(a: Rect, b: Rect) {
  const eps = 1e-9;
  return (
    a.x < b.x + b.width - eps &&
    b.x < a.x + a.width - eps &&
    a.y < b.y + b.height - eps &&
    b.y < a.y + a.height - eps
  );
}

describe('collage layouts', () => {
  for (let count = MIN_COLLAGE_PHOTOS; count <= MAX_COLLAGE_PHOTOS; count += 1) {
    it(`has layouts for ${count} photos that tile the canvas exactly`, () => {
      const layouts = layoutsFor(count);
      expect(layouts.length).toBeGreaterThan(0);
      for (const layout of layouts) {
        expect(layout.cells).toHaveLength(count);
        expect(area(layout.cells)).toBeCloseTo(1, 6);
        layout.cells.forEach((a, i) =>
          layout.cells.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)),
        );
        for (const cell of layout.cells) {
          expect(cell.x).toBeGreaterThanOrEqual(0);
          expect(cell.y).toBeGreaterThanOrEqual(0);
          expect(cell.x + cell.width).toBeLessThanOrEqual(1 + 1e-9);
          expect(cell.y + cell.height).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    });
  }

  it('has no layouts outside the supported range', () => {
    expect(layoutsFor(1)).toHaveLength(0);
    expect(layoutsFor(7)).toHaveLength(0);
  });

  it('turns a layout into pixel cells with even gaps', () => {
    const [side] = layoutsFor(2);
    const cells = collageCells(side, ['a', 'b'], 1000, 500, 0.02);
    expect(cells.map((cell) => cell.id)).toEqual(['a', 'b']);
    // 10 px gaps: left edge, middle, right edge, top and bottom.
    expect(cells[0]).toEqual({ id: 'a', x: 10, y: 10, width: 485, height: 480 });
    expect(cells[1]).toEqual({ id: 'b', x: 505, y: 10, width: 485, height: 480 });
  });

  it('fills the canvas when spacing is zero', () => {
    const [grid] = layoutsFor(4);
    const cells = collageCells(grid, ['a', 'b', 'c', 'd'], 800, 800, 0);
    expect(cells.reduce((sum, cell) => sum + cell.width * cell.height, 0)).toBe(640_000);
  });
});
