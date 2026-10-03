import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { usePreferences, type AppearancePreference } from '@/state/preferences';
import { useTheme } from '@/theme';

// Apply the in-app appearance override at the platform level so native
// chrome (sheets, alerts, keyboard) matches the app's own colors.
function applyAppearance(appearance: AppearancePreference) {
  Appearance.setColorScheme(appearance === 'system' ? 'unspecified' : appearance);
}

// Preferences hydrate synchronously from disk, so the saved theme is applied
// before the first frame renders instead of flashing the system theme.
applyAppearance(usePreferences.getState().appearance);

export default function RootLayout() {
  const appearance = usePreferences((state) => state.appearance);
  const { scheme, colors } = useTheme();

  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.label,
      border: colors.separator,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="settings"
            options={{ presentation: 'modal', title: 'Settings', headerShown: false }}
          />
          <Stack.Screen name="gallery" options={{ title: 'Components & Motion' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
