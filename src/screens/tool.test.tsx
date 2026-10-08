import { fireEvent, render, screen } from '@testing-library/react-native';

import { toPhotoItem } from '@/domain/media';
import { saveToPhotos } from '@/services/exports/exporter';
import {
  enhancePhoto,
  removeBackground,
  visualAnalysisAvailable,
} from '@/services/media/visual-analysis';
import { useCatalog } from '@/state/catalog';

import { ToolScreen } from './tool';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('@/services/media/visual-analysis', () => ({
  visualAnalysisAvailable: jest.fn(() => true),
  enhancePhoto: jest.fn(),
  removeBackground: jest.fn(),
}));
jest.mock('@/services/exports/exporter', () => ({
  saveToPhotos: jest.fn(async () => 'ph://new-asset'),
  discardFile: jest.fn(),
}));
jest.mock('@/services/media/file-fingerprint', () => ({ fileSize: () => 2_400_000 }));
jest.mock('@/db/catalog-repo', () => ({ insertDerivative: jest.fn(async () => {}) }));

const item = toPhotoItem({
  id: 'ph://real',
  kind: 'photo',
  creationTime: 1,
  modificationTime: 1,
  width: 4032,
  height: 3024,
  durationMs: null,
  isFavorite: false,
  subtypes: [],
  filename: 'IMG_1.HEIC',
});

beforeEach(() => {
  jest.clearAllMocks();
  (visualAnalysisAvailable as jest.Mock).mockReturnValue(true);
  useCatalog.setState({ items: [item], byId: new Map([[item.id, item]]) });
});

test('enhance: preview beside the original, then saved as a new photo', async () => {
  (enhancePhoto as jest.Mock).mockResolvedValue({
    status: 'ok',
    uri: 'file:///tmp/out.jpg',
    width: 4032,
    height: 3024,
    applied: ['CIVibrance'],
  });
  await render(<ToolScreen id={item.id} tool="enhance" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Make preview' }));
  expect(enhancePhoto).toHaveBeenCalledWith(item.id, { enhance: true, redEye: false });
  expect(screen.getByLabelText('Enhance preview')).toBeOnTheScreen();
  expect(screen.getByText(/2\.4 MB/)).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Save to Photos' }));
  expect(saveToPhotos).toHaveBeenCalledWith('file:///tmp/out.jpg');
  expect(screen.getByText('Saved to Photos')).toBeOnTheScreen();
  expect(screen.getByText(/The original is unchanged/)).toBeOnTheScreen();
});

test('red-eye: when no red eyes are found it says so and saves nothing', async () => {
  (enhancePhoto as jest.Mock).mockResolvedValue({
    status: 'ok',
    uri: 'file:///tmp/out.jpg',
    applied: [],
  });
  await render(<ToolScreen id={item.id} tool="red-eye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Make preview' }));
  expect(screen.getByText('No red eyes were found in this photo.')).toBeOnTheScreen();
  expect(saveToPhotos).not.toHaveBeenCalled();
});

test('background removal on an iCloud-only photo explains instead of downloading', async () => {
  (removeBackground as jest.Mock).mockResolvedValue({ status: 'in-icloud' });
  await render(<ToolScreen id={item.id} tool="cutout" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Make preview' }));
  expect(screen.getByText(/only in iCloud/)).toBeOnTheScreen();
});

test('in Expo Go the tools explain they need the app', async () => {
  (visualAnalysisAvailable as jest.Mock).mockReturnValue(false);
  await render(<ToolScreen id={item.id} tool="enhance" />);
  expect(screen.getByText('Needs the MediaCare app')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Make preview' })).toBeNull();
});
