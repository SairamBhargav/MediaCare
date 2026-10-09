import { router, usePathname, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TabName } from '@/domain/tabs';
import { measureAnchor, type AnchorRect } from '@/features/tour/anchors';
import { TOUR_STEPS } from '@/features/tour/steps';
import { useTour } from '@/state/tour';
import {
  duration,
  easing,
  gutter,
  radius,
  spacing,
  tourScrim,
  useReduceMotion,
  useTheme,
} from '@/theme';
import { haptics } from '@/utils/haptics';

import { AppText } from './app-text';
import { Button } from './button';
import { Icon } from './icon';
import { Surface } from './surface';

const TAB_HREF: Record<TabName, Href> = { index: '/', library: '/library', studio: '/studio' };
/** Space around the highlighted control. */
const PAD = 8;

function tabOf(pathname: string): TabName | null {
  if (pathname === '/' || pathname === '/index') return 'index';
  if (pathname.startsWith('/library')) return 'library';
  if (pathname.startsWith('/studio')) return 'studio';
  return null;
}

/** Room the card needs; below this it covers the bottom of the control instead. */
const CARD_ROOM = 250;
/** Clearance for the tab bar when the card sits at the bottom. */
const BOTTOM_CLEARANCE = 90;

/**
 * Card below the control if there's room, else above it, else pinned near
 * the bottom over the control (tall controls like the Studio grid). Without
 * a control, a little above the middle.
 */
function placeCard(
  target: AnchorRect | null,
  height: number,
  safeTop: number,
  safeBottom: number,
): { top: number } | { bottom: number } {
  if (!target) return { top: height * 0.26 };
  const visibleTop = Math.max(target.y, safeTop);
  const visibleBottom = Math.min(target.y + target.height, height - safeBottom);
  const below = height - safeBottom - visibleBottom - PAD * 2;
  const above = visibleTop - safeTop - PAD * 2;
  if (below >= CARD_ROOM) return { top: visibleBottom + PAD * 2 + spacing.sm };
  if (above >= CARD_ROOM) return { bottom: height - visibleTop + PAD * 2 + spacing.sm };
  return { bottom: safeBottom + BOTTOM_CLEARANCE };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The guided tour, drawn over the whole app. Everything is dimmed except
 * the real control being explained, which gets a ring; a large card says
 * what it does, with Back, Next and Skip. On "tap this" steps the control
 * itself can be tapped (touches pass through the hole), and the tour
 * follows to the next page. The highlight moves on the UI thread; under
 * Reduce Motion it jumps and the ring doesn't pulse.
 */
export function TourOverlay() {
  const active = useTour((tour) => tour.active);
  const index = useTour((tour) => tour.index);
  if (!active) return null;
  return <Tour index={index} />;
}

function Tour({ index }: { index: number }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  const step = TOUR_STEPS[index];
  // The control found for a step; until it matches the current step, the card waits.
  const [located, setLocated] = useState<{ stepId: string; rect: AnchorRect | null } | null>(null);
  const locating = located?.stepId !== step.id;
  const target = locating ? null : (located?.rect ?? null);

  // The hole in the dimmed layer; starts as a dot in the middle (all dimmed).
  const holeX = useSharedValue(screen.width / 2);
  const holeY = useSharedValue(screen.height / 2);
  const holeW = useSharedValue(0);
  const holeH = useSharedValue(0);
  const pulse = useSharedValue(1);

  // Go to the step's tab, then find its control (layouts may still be settling).
  useEffect(() => {
    let cancelled = false;
    const switching = tabOf(pathRef.current) !== step.tab;
    if (switching) router.navigate(TAB_HREF[step.tab]);
    (async () => {
      await wait(switching ? 450 : 120);
      let rect: AnchorRect | null = null;
      for (let attempt = 0; step.target && !rect && attempt < 6 && !cancelled; attempt += 1) {
        rect = await measureAnchor(step.target, screen);
        if (!rect) await wait(120);
      }
      if (cancelled) return;
      setLocated({ stepId: step.id, rect });
      AccessibilityInfo.announceForAccessibility(`${step.title}. ${step.body}`);
    })().catch(() => setLocated({ stepId: step.id, rect: null }));
    return () => {
      cancelled = true;
    };
  }, [step, screen]);

  useEffect(() => {
    const hole = target
      ? {
          x: target.x - PAD,
          y: target.y - PAD,
          w: target.width + PAD * 2,
          h: target.height + PAD * 2,
        }
      : { x: screen.width / 2, y: screen.height / 2, w: 0, h: 0 };
    const move = (value: number) =>
      reduceMotion ? value : withTiming(value, { duration: duration.surface, easing: easing.out });
    holeX.set(move(hole.x));
    holeY.set(move(hole.y));
    holeW.set(move(hole.w));
    holeH.set(move(hole.h));
  }, [target, screen, reduceMotion, holeX, holeY, holeW, holeH]);

  useEffect(() => {
    if (reduceMotion || !step.tapToContinue) {
      pulse.set(1);
      return;
    }
    pulse.set(
      withRepeat(
        withSequence(withTiming(1.06, { duration: 600 }), withTiming(1, { duration: 600 })),
        -1,
      ),
    );
  }, [reduceMotion, step, pulse]);

  // Four dimmed panels around the hole, moved with transforms only (UI thread).
  const W = screen.width;
  const H = screen.height;
  const top = useAnimatedStyle(() => ({ transform: [{ translateY: holeY.get() - H }] }));
  const bottom = useAnimatedStyle(() => ({
    transform: [{ translateY: holeY.get() + holeH.get() }],
  }));
  const left = useAnimatedStyle(() => ({
    transform: [
      { translateX: holeX.get() - W },
      { translateY: holeY.get() },
      { scaleY: holeH.get() },
    ],
  }));
  const right = useAnimatedStyle(() => ({
    transform: [
      { translateX: holeX.get() + holeW.get() },
      { translateY: holeY.get() },
      { scaleY: holeH.get() },
    ],
  }));
  const ringPulse = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));

  const { next, back, stop } = useTour.getState();
  const last = index === TOUR_STEPS.length - 1;
  const cardPosition = placeCard(target, screen.height, insets.top, insets.bottom);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" accessibilityViewIsModal>
      {/* The panels catch touches, so only the card (and a "tap this" control) responds. */}
      <Animated.View
        style={[styles.panel, { width: W, height: H, backgroundColor: tourScrim }, top]}
      />
      <Animated.View
        style={[styles.panel, { width: W, height: H, backgroundColor: tourScrim }, bottom]}
      />
      <Animated.View style={[styles.strip, { width: W, backgroundColor: tourScrim }, left]} />
      <Animated.View style={[styles.strip, { width: W, backgroundColor: tourScrim }, right]} />
      {/* The highlighted control: touchable only on "tap this" steps. */}
      {target && !locating ? (
        <Animated.View
          key={`ring-${step.id}`}
          entering={FadeIn.duration(duration.surface)}
          pointerEvents={step.tapToContinue ? 'none' : 'auto'}
          style={[
            styles.ring,
            {
              borderColor: colors.accent,
              left: target.x - PAD,
              top: target.y - PAD,
              width: target.width + PAD * 2,
              height: target.height + PAD * 2,
            },
            ringPulse,
          ]}
        />
      ) : null}

      {!locating ? (
        <Animated.View
          key={`card-${step.id}`}
          entering={FadeIn.duration(duration.state)}
          exiting={FadeOut.duration(duration.press)}
          style={[styles.cardWrap, cardPosition]}
        >
          <Surface elevation="raised" style={styles.card}>
            <View style={styles.cardTop}>
              <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
                Step {index + 1} of {TOUR_STEPS.length}
              </AppText>
              {!last ? (
                <Button
                  title="Skip tour"
                  variant="plain"
                  onPress={stop}
                  accessibilityHint="Ends the tour. You can start it again from Settings."
                />
              ) : null}
            </View>
            <AppText variant="title2" accessibilityRole="header">
              {step.title}
            </AppText>
            <AppText variant="body">{step.body}</AppText>
            {step.tapToContinue ? (
              <View style={styles.hint}>
                <Icon name="arrowDown" size={16} color={colors.accentText} />
                <AppText variant="subhead" color="accentText" style={styles.flex}>
                  Tap the highlighted button, or tap Next.
                </AppText>
              </View>
            ) : null}
            <View style={styles.actions}>
              {index > 0 ? (
                <Button title="Back" variant="secondary" onPress={back} style={styles.flex} />
              ) : null}
              <Button
                title={last ? 'Done' : 'Next'}
                onPress={() => {
                  if (last) haptics.success();
                  next();
                }}
                haptic={last ? 'none' : 'light'}
                style={styles.flex}
              />
            </View>
          </Surface>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { position: 'absolute', top: 0, left: 0 },
  // One point tall, scaled to the hole's height from its top edge.
  strip: { position: 'absolute', top: 0, left: 0, height: 1, transformOrigin: 'top left' },
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderRadius: radius.card,
    borderCurve: 'continuous',
  },
  cardWrap: { position: 'absolute', left: gutter, right: gutter },
  card: { gap: spacing.sm, padding: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  numbers: { fontVariant: ['tabular-nums'] },
});
