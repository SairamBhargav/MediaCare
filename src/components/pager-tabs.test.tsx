import { Text } from 'react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { PagerTabs } from './pager-tabs';

// expo-router's testing library installs a smaller Reanimated mock than the
// app's theme needs; the pager only uses one spring from the theme.
jest.mock('@/theme', () => ({ springs: { page: { duration: 350, dampingRatio: 1 } } }));
jest.mock('@/utils/haptics', () => ({ haptics: { light: jest.fn() } }));

function Layout() {
  return (
    <PagerTabs
      tabBar={({ state, navigation }) =>
        state.routes.map((route) => (
          <Text
            key={route.key}
            accessibilityRole="tab"
            onPress={() => navigation.navigate(route.name)}
          >
            {`tab ${route.name}`}
          </Text>
        ))
      }
    >
      <PagerTabs.Screen name="index" options={{ title: 'Clean' }} />
      <PagerTabs.Screen name="library" options={{ title: 'Library' }} />
      <PagerTabs.Screen name="studio" options={{ title: 'Studio' }} />
    </PagerTabs>
  );
}

test('every page is mounted side by side; only the current one is reachable', async () => {
  await renderRouter(
    {
      _layout: Layout,
      index: () => <Text>Clean page</Text>,
      library: () => <Text>Library page</Text>,
      studio: () => <Text>Studio page</Text>,
    },
    { initialUrl: '/' },
  );

  // All pages are drawn, so the next one is already there while swiping.
  for (const page of ['Clean page', 'Library page', 'Studio page']) {
    expect(screen.getByText(page, { includeHiddenElements: true })).toBeTruthy();
  }
  expect(screen.queryByText('Library page')).toBeNull();

  await fireEvent.press(screen.getByText('tab library'));
  expect(screen.getByText('Library page')).toBeTruthy();
  expect(screen.queryByText('Clean page')).toBeNull();
});
