import { US_PASSPORT, isFrame, passportFrame } from './passport';

// A 3024×4032 portrait with a centred face box 30% of the height, chin at 55% from the top.
const face = { x: 0.375, y: 0.45, width: 0.25, height: 0.3 };

test('a well-framed portrait gets a square crop with the head inside the official range', () => {
  const frame = passportFrame(3024, 4032, [face]);
  expect(isFrame(frame)).toBe(true);
  if (!isFrame(frame)) return;
  expect(frame.problems).toEqual([]);
  expect(frame.crop.width).toBe(frame.crop.height);
  expect(frame.headShare).toBeGreaterThanOrEqual(US_PASSPORT.headMin);
  expect(frame.headShare).toBeLessThanOrEqual(US_PASSPORT.headMax);
  expect(frame.outputPx).toBe(1200);
  // Face centred horizontally.
  expect(Math.abs(frame.crop.originX + frame.crop.width / 2 - 3024 / 2)).toBeLessThanOrEqual(1);
});

test('official numbers: 25–35 mm of a 51 mm photo, 600–1200 px', () => {
  expect(US_PASSPORT.headMin).toBeCloseTo(0.49, 2);
  expect(US_PASSPORT.headMax).toBeCloseTo(0.686, 2);
  expect([US_PASSPORT.minPx, US_PASSPORT.maxPx]).toEqual([600, 1200]);
  expect(US_PASSPORT.source).toMatch(/^https:\/\/travel\.state\.gov\//);
});

test('no face, or several faces, is refused with a reason', () => {
  expect(passportFrame(3024, 4032, [])).toEqual({ problems: ['No face was found.'] });
  expect(passportFrame(3024, 4032, [face, face]).problems[0]).toMatch(/more than one face/i);
});

test('a face too close to the top asks for more room instead of cutting the head', () => {
  const high = { ...face, y: 0.68 }; // face box reaches near the top edge
  const frame = passportFrame(3024, 4032, [high]);
  expect(frame.problems.join(' ')).toMatch(/space above the head/);
});

test('a tiny face asks to move closer', () => {
  const small = { x: 0.48, y: 0.5, width: 0.04, height: 0.05 };
  const frame = passportFrame(3024, 4032, [small]);
  expect(frame.problems.join(' ')).toMatch(/too small/);
});

test('a face filling the photo asks to step back', () => {
  const huge = { x: 0.1, y: 0.15, width: 0.8, height: 0.75 };
  const frame = passportFrame(3024, 4032, [huge]);
  expect(frame.problems.join(' ')).toMatch(/too close/);
});

describe('fine-tuning the frame', () => {
  const base = passportFrame(3024, 4032, [face]);

  test('zooming in makes the head bigger, within the official range', () => {
    const zoomed = passportFrame(3024, 4032, [face], US_PASSPORT, {
      offsetX: 0,
      offsetY: 0,
      zoom: 1.1,
    });
    if (!isFrame(base) || !isFrame(zoomed)) throw new Error('expected frames');
    expect(zoomed.crop.width).toBeLessThan(base.crop.width);
    expect(zoomed.headShare).toBeGreaterThan(base.headShare);
    expect(zoomed.problems).toEqual([]);
  });

  test('zoom is limited so the head stays inside the official range', () => {
    for (const zoom of [0.1, 0.84, 1.14, 9]) {
      const frame = passportFrame(3024, 4032, [face], US_PASSPORT, {
        offsetX: 0,
        offsetY: 0,
        zoom,
      });
      if (!isFrame(frame)) throw new Error('expected a frame');
      expect(frame.headShare).toBeGreaterThanOrEqual(US_PASSPORT.headMin);
      expect(frame.headShare).toBeLessThanOrEqual(US_PASSPORT.headMax);
    }
  });

  test('moving the frame moves the crop by a share of its side', () => {
    // A smaller face leaves room to move inside the photo.
    const smaller = { x: 0.425, y: 0.5, width: 0.15, height: 0.18 };
    const start = passportFrame(3024, 4032, [smaller]);
    const moved = passportFrame(3024, 4032, [smaller], US_PASSPORT, {
      offsetX: 0.1,
      offsetY: 0,
      zoom: 1,
    });
    if (!isFrame(start) || !isFrame(moved)) throw new Error('expected frames');
    const shift = moved.crop.originX - start.crop.originX;
    expect(Math.abs(shift - 0.1 * start.crop.width)).toBeLessThanOrEqual(1);
    expect(moved.headShare).toBeCloseTo(start.headShare, 5);
  });

  test('moving the head to the top edge is flagged', () => {
    const frame = passportFrame(3024, 4032, [face], US_PASSPORT, {
      offsetX: 0,
      offsetY: 0.2,
      zoom: 1,
    });
    expect(frame.problems.join(' ')).toMatch(/top of the head/);
  });
});
