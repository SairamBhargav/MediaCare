import { fireEvent, render, screen } from '@testing-library/react-native';

import { toPhotoItem } from '@/domain/media';
import { saveToPhotos } from '@/services/exports/exporter';
import { findFaces, renderPassport } from '@/services/media/passport';
import { visualAnalysisAvailable } from '@/services/media/visual-analysis';
import { useCatalog } from '@/state/catalog';

import { PassportScreen } from './passport';

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
}));
jest.mock('@/services/media/passport', () => ({ findFaces: jest.fn(), renderPassport: jest.fn() }));
jest.mock('@/services/exports/exporter', () => ({
  saveToPhotos: jest.fn(async () => 'ph://new'),
  discardFile: jest.fn(),
}));
jest.mock('@/db/catalog-repo', () => ({ insertDerivative: jest.fn(async () => {}) }));

const item = toPhotoItem({
  id: 'ph://portrait',
  kind: 'photo',
  creationTime: 1,
  modificationTime: 1,
  width: 3024,
  height: 4032,
  durationMs: null,
  isFavorite: false,
  subtypes: [],
  filename: 'IMG_9.HEIC',
});
const goodFace = { x: 0.375, y: 0.45, width: 0.25, height: 0.3, eyesOpen: 0.3 };

beforeEach(() => {
  jest.clearAllMocks();
  (visualAnalysisAvailable as jest.Mock).mockReturnValue(true);
  useCatalog.setState({ items: [item], byId: new Map([[item.id, item]]) });
  (renderPassport as jest.Mock).mockResolvedValue({
    uri: 'file:///tmp/passport.jpg',
    width: 1200,
    height: 1200,
    bytes: 310_000,
  });
});

test('frames one face, shows guides and the checklist, never promises acceptance, saves a new photo', async () => {
  (findFaces as jest.Mock).mockResolvedValue({ status: 'ok', faces: [goodFace] });
  await render(<PassportScreen id={item.id} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Make passport photo' }));

  expect(screen.getByLabelText('Passport photo preview')).toBeOnTheScreen();
  expect(screen.getByText(/Plain white or off-white background/)).toBeOnTheScreen();
  expect(screen.getByText(/can’t\s+guarantee the photo will be accepted/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Save to Photos' }));
  expect(saveToPhotos).toHaveBeenCalledWith('file:///tmp/passport.jpg');
  expect(screen.getByText('Saved to Photos')).toBeOnTheScreen();
});

test('two people in the photo is refused with the reason', async () => {
  (findFaces as jest.Mock).mockResolvedValue({ status: 'ok', faces: [goodFace, goodFace] });
  await render(<PassportScreen id={item.id} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Make passport photo' }));
  expect(screen.getByText('This photo won’t work')).toBeOnTheScreen();
  expect(screen.getByText(/More than one face/)).toBeOnTheScreen();
  expect(renderPassport).not.toHaveBeenCalled();
});

test('closed eyes are warned about', async () => {
  (findFaces as jest.Mock).mockResolvedValue({
    status: 'ok',
    faces: [{ ...goodFace, eyesOpen: 0.02 }],
  });
  await render(<PassportScreen id={item.id} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Make passport photo' }));
  expect(screen.getByText(/eyes may be closed/i)).toBeOnTheScreen();
});

test('in Expo Go it explains the app build is needed', async () => {
  (visualAnalysisAvailable as jest.Mock).mockReturnValue(false);
  await render(<PassportScreen id={item.id} />);
  expect(screen.getByText('Needs the MediaCare app')).toBeOnTheScreen();
});
