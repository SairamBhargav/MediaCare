import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { toPhotoItem } from '@/domain/media';
import { adjustPhoto, creationToolsAvailable, makeCollage } from '@/services/media/creations';
import { saveToPhotos } from '@/services/exports/exporter';
import { useCatalog } from '@/state/catalog';
import { useCreationDraft } from '@/state/creation-draft';

import { AdjustScreen } from './adjust';
import { CollageScreen } from './collage';
import { PickScreen } from './pick';
import { StudioScreen } from './studio';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('@/services/media/creations', () => ({
  creationToolsAvailable: jest.fn(() => true),
  adjustPhoto: jest.fn(),
  makeCollage: jest.fn(),
}));
jest.mock('@/services/media/visual-analysis', () => ({
  visualAnalysisAvailable: jest.fn(() => true),
}));
jest.mock('@/services/exports/exporter', () => ({
  saveToPhotos: jest.fn(async () => 'ph://new-asset'),
  discardFile: jest.fn(),
}));
jest.mock('@/services/media/file-fingerprint', () => ({ fileSize: () => 1_500_000 }));
jest.mock('@/db/catalog-repo', () => ({
  insertDerivative: jest.fn(async () => {}),
  listDerivatives: jest.fn(async () => []),
}));

const photo = (id: string) =>
  toPhotoItem({
    id,
    kind: 'photo',
    creationTime: 1,
    modificationTime: 1,
    width: 4032,
    height: 3024,
    durationMs: null,
    isFavorite: false,
    subtypes: [],
    filename: `${id}.HEIC`,
  });

const items = ['ph://a', 'ph://b', 'ph://c'].map(photo);

beforeEach(() => {
  jest.clearAllMocks();
  (creationToolsAvailable as jest.Mock).mockReturnValue(true);
  useCatalog.setState({ items, byId: new Map(items.map((item) => [item.id, item])) });
});

describe('Studio', () => {
  test('lists every tool, and each opens a picker', async () => {
    await render(<StudioScreen />);
    for (const title of ['Adjust', 'Collage', 'Slideshow', 'Smaller copy', 'Passport photo']) {
      expect(screen.getByLabelText(title)).toBeOnTheScreen();
    }
    await fireEvent.press(screen.getByLabelText('Collage'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/pick', params: { tool: 'collage' } });
  });

  test('tools that need the app build say so instead of opening', async () => {
    (creationToolsAvailable as jest.Mock).mockReturnValue(false);
    await render(<StudioScreen />);
    expect(screen.getAllByText('Needs the latest MediaCare app.').length).toBeGreaterThan(0);
  });
});

describe('Pick', () => {
  test('a multi-photo tool keeps the tap order and continues with it', async () => {
    await render(<PickScreen tool="collage" />);
    const continueButton = screen.getByLabelText('Choose at least 2');
    expect(continueButton).toBeDisabled();
    const tiles = screen.getAllByRole('checkbox');
    await fireEvent.press(tiles[2]);
    await fireEvent.press(tiles[0]);
    await fireEvent.press(screen.getByLabelText('Continue with 2'));
    expect(useCreationDraft.getState().ids).toEqual(['ph://c', 'ph://a']);
    expect(router.replace).toHaveBeenCalledWith('/collage');
  });
});

describe('Adjust', () => {
  test('sample images are refused', async () => {
    await render(<AdjustScreen id="sample-burst-1a" />);
    expect(screen.getByText('Adjust works on your own photos')).toBeOnTheScreen();
  });

  test('in Expo Go it explains that it needs the app', async () => {
    (creationToolsAvailable as jest.Mock).mockReturnValue(false);
    await render(<AdjustScreen id="ph://a" />);
    expect(screen.getByText('Needs the latest MediaCare app')).toBeOnTheScreen();
  });

  test('saving is off until something changes, then saves a new photo', async () => {
    (adjustPhoto as jest.Mock).mockResolvedValue({
      status: 'ok',
      uri: 'file:///tmp/out.jpg',
      width: 3024,
      height: 4032,
    });
    await render(<AdjustScreen id="ph://a" />);
    expect(screen.getByLabelText('Save to Photos')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('Turn right'));
    await fireEvent.press(screen.getByLabelText('Save to Photos'));
    expect(adjustPhoto).toHaveBeenLastCalledWith(
      'ph://a',
      expect.objectContaining({ quarterTurns: 1, maxSide: 4096 }),
    );
    expect(saveToPhotos).toHaveBeenCalledWith('file:///tmp/out.jpg');
    expect(await screen.findByText('Saved to Photos')).toBeOnTheScreen();
  });
});

describe('Collage', () => {
  test('saves the photos in the chosen layout at full size', async () => {
    useCreationDraft.getState().setIds(['ph://a', 'ph://b']);
    (makeCollage as jest.Mock).mockResolvedValue({
      status: 'ok',
      uri: 'file:///tmp/collage.jpg',
      width: 2048,
      height: 2048,
    });
    await render(<CollageScreen />);
    await fireEvent.press(screen.getByLabelText('Stacked'));
    await fireEvent.press(screen.getByLabelText('Save to Photos'));
    const call = (makeCollage as jest.Mock).mock.calls[0][0];
    expect(call.cells.map((cell: { id: string }) => cell.id)).toEqual(['ph://a', 'ph://b']);
    // Stacked: same x, one above the other.
    expect(call.cells[0].x).toBe(call.cells[1].x);
    expect(call.cells[0].y).toBeLessThan(call.cells[1].y);
    expect(await screen.findByText('Saved to Photos')).toBeOnTheScreen();
  });

  test('without photos it explains how to start', async () => {
    useCreationDraft.getState().setIds([]);
    await render(<CollageScreen />);
    expect(screen.getByText('Choose 2 to 6 photos')).toBeOnTheScreen();
  });
});
