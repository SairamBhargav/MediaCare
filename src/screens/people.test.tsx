import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { FaceRecord, PersonSummary } from '@/domain/people';
import { usePeople } from '@/state/people';

import { PeopleScreen } from './people';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const cover: FaceRecord = {
  id: 1,
  assetId: 'a',
  box: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
  quality: 0.9,
  applePrint: null,
  modelPrint: null,
  personId: 1,
  confirmed: false,
  rejectedPersonId: null,
};

function summary(id: number, name: string | null, photos: number): PersonSummary {
  return {
    person: { id, name, hidden: false, createdAt: 0 },
    assetIds: Array.from({ length: photos }, (_, i) => `p${id}-${i}`),
    cover,
  };
}

beforeEach(() => {
  // Shown as stored; loading from the database is a no-op here.
  usePeople.setState({
    loaded: true,
    people: [summary(1, 'Bob', 12), summary(2, null, 3)],
    load: async () => {},
  });
});

test('People lists named and unnamed people with photo counts', async () => {
  await render(<PeopleScreen />);
  expect(screen.getByText('Bob')).toBeOnTheScreen();
  expect(screen.getByText('Add a name')).toBeOnTheScreen();
  expect(screen.getByLabelText('Bob, 12 photos')).toBeOnTheScreen();
  expect(screen.getByText(/can make mistakes/)).toBeOnTheScreen();
});

test('tapping a person opens their photos', async () => {
  await render(<PeopleScreen />);
  await fireEvent.press(screen.getByLabelText('Bob, 12 photos'));
  expect(router.push).toHaveBeenCalledWith('/people/1');
});

test('with nobody found it says how people are found', async () => {
  usePeople.setState({ people: [] });
  await render(<PeopleScreen />);
  expect(screen.getByText('No people yet')).toBeOnTheScreen();
});
