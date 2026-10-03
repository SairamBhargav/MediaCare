import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { highContrastPalettes, palettes, useTheme } from '@/theme';

test('switches to the Increase Contrast palette when iOS reports it', async () => {
  jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(true);

  const { result } = await renderHook(() => useTheme());
  await act(async () => {});

  expect(result.current.highContrast).toBe(true);
  expect(result.current.colors).toBe(highContrastPalettes[result.current.scheme]);
  expect(result.current.colors).not.toBe(palettes[result.current.scheme]);
});
