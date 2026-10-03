import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { SampleArtwork } from '@/components/sample-artwork';
import { StatusPill } from '@/components/status-pill';
import { getSampleAsset, sampleFindings } from '@/demo/sample-library';
import { needsAccessExplainer } from '@/features/media/start-scan';
import { useCatalog } from '@/state/catalog';
import { usePreferences } from '@/state/preferences';
import {
  duration,
  gutter,
  onMedia,
  radius,
  spacing,
  springs,
  useReduceMotion,
  useTheme,
} from '@/theme';

/** The burst shown in the composition: the first sample "similar shots" group. */
const group = sampleFindings.find(
  (finding) => finding.kind === 'group' && finding.category === 'similar',
);
const tiles =
  group && group.kind === 'group'
    ? group.memberIds
        .slice(0, 3)
        .map((id) => ({ asset: getSampleAsset(id), keeper: id === group.keeperId }))
    : [];

/** When the keeper mark lands, after the tiles settle. Whole composition < 1.2 s. */
const KEEPER_DELAY = 700;

const POINTS = [
  { icon: 'scan', text: 'Finds bursts taken moments apart, screenshots and long videos.' },
  { icon: 'photo', text: 'Makes smaller copies. Your originals stay exactly as they are.' },
  {
    icon: 'lock',
    text: 'Works on this iPhone. Nothing is uploaded, and nothing is removed for you.',
  },
] as const;

/**
 * First-run introduction (P1-ONB-001): what MediaCare does, in one screen.
 * A short composition of sample photos (labelled as samples) settles while
 * the buttons are already usable, so it never holds anyone up.
 *
 * Either button marks the introduction as seen (P1-ONB-003). "Continue"
 * goes on to the photo-access explanation if iOS hasn't asked yet.
 */
export function WelcomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const access = useCatalog((catalog) => catalog.access);

  const finish = (next: 'samples' | 'continue') => {
    usePreferences.getState().setOnboardingSeen(true);
    if (next === 'continue' && needsAccessExplainer(access)) {
      router.replace({ pathname: '/access', params: { then: 'scan' } });
    } else {
      router.back();
    }
  };

  const enter = (index: number) =>
    reduceMotion
      ? undefined
      : FadeInDown.delay(index * duration.stagger * 2)
          .springify()
          .duration(springs.settle.duration)
          .dampingRatio(springs.settle.dampingRatio);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
        },
      ]}
    >
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <View
          style={styles.composition}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Three sample photos from a burst, with the sharpest one marked Keep"
        >
          {tiles.map(({ asset, keeper }, index) => (
            <Animated.View
              key={asset.id}
              entering={enter(index)}
              style={[styles.tile, index === 1 && styles.middleTile]}
            >
              <SampleArtwork asset={asset} glyphSize={34} />
              {keeper ? (
                <Animated.View
                  entering={
                    reduceMotion
                      ? undefined
                      : ZoomIn.delay(KEEPER_DELAY)
                          .springify()
                          .duration(springs.badge.duration)
                          .dampingRatio(springs.badge.dampingRatio)
                  }
                  style={styles.keep}
                >
                  <Icon name="star" size={11} color={onMedia.foreground} weight="bold" />
                  <AppText variant="caption" style={styles.onMedia}>
                    Keep
                  </AppText>
                </Animated.View>
              ) : null}
            </Animated.View>
          ))}
        </View>
        <View style={styles.sampleLabel}>
          <StatusPill label="Sample images" />
        </View>

        <Animated.View
          entering={
            reduceMotion ? undefined : FadeIn.delay(duration.stagger * 4).duration(duration.surface)
          }
          style={styles.copy}
        >
          <AppText variant="largeTitle" accessibilityRole="header">
            Less clutter, same memories
          </AppText>
          {POINTS.map((point) => (
            <View key={point.icon} style={styles.point}>
              <Icon name={point.icon} size={22} color={colors.accent} />
              <AppText variant="body" color="secondaryLabel" style={styles.pointText}>
                {point.text}
              </AppText>
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      <View style={styles.actions}>
        <Button title="Continue" onPress={() => finish('continue')} block />
        <Button
          title="Explore with samples"
          variant="plain"
          onPress={() => finish('samples')}
          accessibilityHint="Look around with sample images first. You can scan your photos any time."
          block
        />
      </View>
    </View>
  );
}

const TILE = 104;

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: gutter, gap: spacing.md },
  flex: { flex: 1 },
  scroll: { gap: spacing.lg, paddingTop: spacing.lg },
  composition: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TILE * 1.25,
  },
  tile: {
    width: TILE,
    height: TILE * 1.25,
    borderRadius: radius.media,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  middleTile: { transform: [{ translateY: -spacing.md }] },
  keep: {
    position: 'absolute',
    left: spacing.xs,
    top: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: onMedia.pill,
  },
  onMedia: { color: onMedia.foreground },
  sampleLabel: { alignItems: 'center' },
  copy: { gap: spacing.md },
  point: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  pointText: { flex: 1 },
  actions: { gap: spacing.xs },
});
