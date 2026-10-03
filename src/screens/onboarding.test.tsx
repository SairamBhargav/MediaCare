import { fireEvent, render, screen } from '@testing-library/react-native';
import { requestPermissionsAsync } from 'expo-media-library';
import { router } from 'expo-router';

import { needsAccessExplainer, scanLibrary } from '@/features/media/start-scan';
import { useCatalog } from '@/state/catalog';
import { useCleanSession } from '@/state/clean-session';
import { usePreferences } from '@/state/preferences';

import { AccessScreen } from './access';
import { WelcomeScreen } from './welcome';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  usePreferences.getState().setOnboardingSeen(false);
  useCatalog.setState({ access: 'undetermined' });
});

describe('access explainer routing', () => {
  test.each([
    ['undetermined', true],
    ['unknown', true],
    ['full', false],
    ['limited', false],
    ['denied', false],
  ] as const)('access %s → explain first: %s', (access, expected) => {
    expect(needsAccessExplainer(access)).toBe(expected);
  });

  test('scanning before iOS has asked opens the explainer, not the prompt', () => {
    const start = jest.spyOn(useCleanSession.getState(), 'startLibraryScan');
    scanLibrary();
    expect(router.push).toHaveBeenCalledWith({ pathname: '/access', params: { then: 'scan' } });
    expect(start).not.toHaveBeenCalled();
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('welcome', () => {
  test('Explore with samples marks the introduction seen and closes it', async () => {
    await render(<WelcomeScreen />);
    expect(screen.getByText('Sample images')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Explore with samples' }));
    expect(usePreferences.getState().onboardingSeen).toBe(true);
    expect(router.back).toHaveBeenCalled();
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  test('Continue goes on to the explainer while iOS hasn’t asked', async () => {
    await render(<WelcomeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(usePreferences.getState().onboardingSeen).toBe(true);
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/access', params: { then: 'scan' } });
  });

  test('Continue just closes once access is decided', async () => {
    useCatalog.setState({ access: 'limited' });
    await render(<WelcomeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });
});

describe('access screen', () => {
  test('nothing is asked until Continue', async () => {
    await render(<AccessScreen then="scan" />);
    expect(screen.getByText('Stays on this iPhone')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  test('Continue shows the iOS prompt; a refusal does not scan', async () => {
    const start = jest.spyOn(useCleanSession.getState(), 'startLibraryScan');
    await render(<AccessScreen then="scan" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  test('after iOS has asked it shows current access instead of a prompt button', async () => {
    useCatalog.setState({ access: 'limited' });
    await render(<AccessScreen />);
    expect(screen.getByText(/can currently see selected photos/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change in iOS Settings' })).toBeOnTheScreen();
  });
});
