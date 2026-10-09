import { swipeTarget } from './tabs';

describe('swipeTarget', () => {
  it('goes to the next tab on a right-to-left swipe', () => {
    expect(swipeTarget('index', -120, 0)).toBe('library');
    expect(swipeTarget('library', -20, -900)).toBe('studio');
  });

  it('goes back on a left-to-right swipe', () => {
    expect(swipeTarget('studio', 120, 0)).toBe('library');
    expect(swipeTarget('library', 10, 800)).toBe('index');
  });

  it('stays put at the ends, for short slow drags, and for unknown tabs', () => {
    expect(swipeTarget('index', 200, 0)).toBeNull();
    expect(swipeTarget('studio', -200, 0)).toBeNull();
    expect(swipeTarget('library', -30, -100)).toBeNull();
    expect(swipeTarget('settings', -200, 0)).toBeNull();
  });

  it('ignores a flick that reverses a long drag', () => {
    expect(swipeTarget('library', -120, 900)).toBeNull();
  });
});
