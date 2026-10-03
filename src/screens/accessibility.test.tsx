import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { sampleLibrary } from '@/demo/sample-library';
import { useCatalog } from '@/state/catalog';
import { sampleResultsState } from '@/state/clean-session';

import { AccessScreen } from './access';
import { CleanContent } from './clean/clean-content';
import { GalleryScreen } from './gallery';
import { LibraryScreen } from './library';
import { PhotoScreen } from './photo';
import { PlanScreen } from './plan';
import { WelcomeScreen } from './welcome';

/**
 * Automated part of the accessibility pass (P1-QA-001): on every main
 * screen, everything that responds to a tap must tell VoiceOver what it is
 * (a role) and what it's called (a label or visible text). The VoiceOver
 * walkthrough, largest text sizes and Reduce Motion/Transparency on the
 * device are in docs/TEST_PLAN.md §4.
 */

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

type Node = {
  type: unknown;
  props: Record<string, unknown>;
  children: (Node | string)[];
};

function textOf(node: Node | string): string {
  if (typeof node === 'string') return node;
  return node.children.map(textOf).join(' ');
}

function isTouchable(node: Node): boolean {
  if (node.type === 'RCTScrollView') return false;
  return typeof node.props.onClick === 'function' || typeof node.props.onPress === 'function';
}

function walk(node: Node | string, found: Node[]) {
  if (typeof node === 'string') return;
  if (typeof node.type === 'string' && isTouchable(node)) found.push(node);
  node.children.forEach((child) => walk(child, found));
}

function touchables(): Node[] {
  const found: Node[] = [];
  walk(screen.container as unknown as Node, found);
  return found;
}

function unlabelledTouchables(): string[] {
  return touchables()
    .filter((node) => node.props.accessibilityElementsHidden !== true)
    .map((node) => {
      const role = node.props.accessibilityRole ?? node.props.role;
      const name = (node.props.accessibilityLabel as string | undefined) ?? textOf(node).trim();
      if (role && name) return null;
      return `${String(node.type)} role=${String(role)} name="${name}"`;
    })
    .filter((problem): problem is string => problem !== null);
}

const noop = () => {};
const actions = {
  onScanLibrary: noop,
  onSampleScan: noop,
  onManageSelection: noop,
  onOpenSettings: noop,
  onReset: noop,
  onOpenPlan: noop,
};

const screens: [string, () => ReactElement][] = [
  ['Welcome', () => <WelcomeScreen />],
  ['Access explainer', () => <AccessScreen then="scan" />],
  [
    'Clean, not scanned',
    () => (
      <CleanContent state={{ status: 'not-scanned' }} access="undetermined" actions={actions} />
    ),
  ],
  [
    'Clean, results',
    () => (
      <CleanContent state={sampleResultsState} access="full" actions={actions} plannedCount={2} />
    ),
  ],
  ['Library', () => <LibraryScreen />],
  ['Photo viewer', () => <PhotoScreen id={sampleLibrary[0].id} />],
  ['Removal plan', () => <PlanScreen />],
  ['Gallery', () => <GalleryScreen />],
];

beforeEach(() => useCatalog.setState({ access: 'undetermined' }));

test.each(screens)('%s: every touchable has a role and a name', async (_, element) => {
  await render(element());
  // Guard against a vacuous pass: each of these screens has controls.
  expect(touchables().length).toBeGreaterThan(0);
  expect(unlabelledTouchables()).toEqual([]);
});

test('the check catches an unlabelled touchable', async () => {
  const { Pressable, View } = jest.requireActual<typeof import('react-native')>('react-native');
  await render(
    <Pressable onPress={noop}>
      <View />
    </Pressable>,
  );
  expect(unlabelledTouchables()).toHaveLength(1);
});
