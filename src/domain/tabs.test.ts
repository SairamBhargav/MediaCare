import { EDGE_RESISTANCE, dragOffset, pageOffset, settlePage } from './tabs';

const W = 400;

describe('tab paging', () => {
  it('places pages side by side', () => {
    expect(pageOffset(0, W)).toBe(-0);
    expect(pageOffset(2, W)).toBe(-800);
  });

  it('follows the finger 1:1 between pages and resists past the ends', () => {
    expect(dragOffset(-400, -150, W, 3)).toBe(-550);
    expect(dragOffset(0, 100, W, 3)).toBe(100 * EDGE_RESISTANCE);
    expect(dragOffset(-800, -100, W, 3)).toBe(-800 - 100 * EDGE_RESISTANCE);
  });

  it('settles on the nearest page when released slowly', () => {
    expect(settlePage(-150, 0, W, 0, 3)).toBe(0);
    expect(settlePage(-250, 0, W, 0, 3)).toBe(1);
  });

  it('a flick goes to the next page even after a short drag', () => {
    expect(settlePage(-60, -1200, W, 0, 3)).toBe(1);
    expect(settlePage(-340, 1200, W, 1, 3)).toBe(0);
  });

  it('moves at most one page per swipe and never past the ends', () => {
    expect(settlePage(-700, -5000, W, 0, 3)).toBe(1);
    expect(settlePage(-800, -3000, W, 2, 3)).toBe(2);
    expect(settlePage(50, 3000, W, 0, 3)).toBe(0);
  });
});
