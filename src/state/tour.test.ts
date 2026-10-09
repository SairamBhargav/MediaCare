import { TOUR_STEPS } from '@/features/tour/steps';
import { usePreferences } from '@/state/preferences';

import { useTour } from './tour';

beforeEach(() => {
  useTour.setState({ active: false, index: 0 });
  usePreferences.getState().setTourSeen(false);
});

test('steps are unique, and every "tap this" step points at a tab button', () => {
  const ids = TOUR_STEPS.map((step) => step.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const step of TOUR_STEPS.filter((s) => s.tapToContinue)) {
    expect(step.target).toMatch(/^tab\./);
  }
  // The step after a tab tap happens on that tab.
  TOUR_STEPS.forEach((step, index) => {
    if (step.tapToContinue) expect(TOUR_STEPS[index + 1].tab).toBe(step.target?.slice(4));
  });
});

test('next and back move through the steps; finishing marks the tour seen', () => {
  const tour = useTour.getState();
  tour.start();
  tour.back();
  expect(useTour.getState().index).toBe(0);
  for (let step = 1; step < TOUR_STEPS.length; step += 1) {
    useTour.getState().next();
    expect(useTour.getState().index).toBe(step);
  }
  useTour.getState().next();
  expect(useTour.getState().active).toBe(false);
  expect(usePreferences.getState().tourSeen).toBe(true);
});

test('skipping also marks it seen', () => {
  useTour.getState().start();
  useTour.getState().stop();
  expect(useTour.getState().active).toBe(false);
  expect(usePreferences.getState().tourSeen).toBe(true);
});

test('tapping the highlighted tab moves on only on a "tap this" step', () => {
  const tapIndex = TOUR_STEPS.findIndex((step) => step.tapToContinue);
  const tapStep = TOUR_STEPS[tapIndex];
  useTour.setState({ active: true, index: 0 });
  useTour.getState().tapped(tapStep.target!);
  expect(useTour.getState().index).toBe(0);

  useTour.setState({ index: tapIndex });
  useTour.getState().tapped('tab.somewhere-else');
  expect(useTour.getState().index).toBe(tapIndex);
  useTour.getState().tapped(tapStep.target!);
  expect(useTour.getState().index).toBe(tapIndex + 1);
});
