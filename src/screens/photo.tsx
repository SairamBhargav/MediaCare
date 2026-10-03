import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { MediaArtwork } from '@/components/media-artwork';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { formatSize } from '@/domain/bytes';
import { formatDuration } from '@/domain/media';
import {
  DOUBLE_TAP_ZOOM,
  IDENTITY,
  MAX_ZOOM,
  MIN_ZOOM,
  clamp,
  dragProgress,
  fitRect,
  mixTransform,
  panLimits,
  photoScaleInMask,
  shouldDismiss,
  tileTransform,
  zoomAbout,
  type TileTransform,
} from '@/domain/viewer-geometry';
import { findMediaItem, isSample, type MediaItem } from '@/features/media/registry';
import { useCatalog } from '@/state/catalog';
import { useViewerOrigin } from '@/state/viewer-origin';
import {
  duration,
  easing,
  gutter,
  radius,
  spacing,
  springs,
  useReduceMotion,
  useTheme,
} from '@/theme';

const fullDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const SUBTYPE_LABELS: Record<string, string> = {
  screenshot: 'Screenshot',
  livePhoto: 'Live Photo',
  panorama: 'Panorama',
  hdr: 'HDR',
  depthEffect: 'Portrait',
  highFrameRate: 'Slo-mo',
  timelapse: 'Time-lapse',
  videoCinematic: 'Cinematic',
  spatialMedia: 'Spatial',
};

/** How much a drag-to-dismiss shrinks the photo at full drag progress. */
const DRAG_SHRINK = 0.25;

/**
 * One photo or video, full screen. Opens out of the tile that was tapped
 * and returns to it (measured overlay, transforms only); pinch, pan and
 * double-tap to zoom; drag down or up to close, or use Close. Info shows
 * where the date comes from, dimensions, size and file. Read-only towards
 * Photos except "Make a smaller copy", which adds a new item.
 *
 * Reduce Motion: the viewer fades in and out instead of flying; zoom jumps.
 */
export function PhotoScreen({ id }: { id: string }) {
  const { colors } = useTheme();
  const item = findMediaItem(id);

  if (!item) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="photo"
          title="This photo isn’t available"
          message="It may have been deleted or is no longer shared with MediaCare."
          action={<Button title="Close" variant="secondary" onPress={() => router.back()} />}
        />
      </View>
    );
  }
  return <Viewer item={item} />;
}

function Viewer({ item }: { item: MediaItem }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [infoVisible, setInfoVisible] = useState(false);

  const fit = fitRect(item.width, item.height, width, height);
  // Fixed for the life of the viewer: where it flies in from and back to.
  // Under Reduce Motion (or without a measured tile) it fades instead.
  const [from] = useState<TileTransform | null>(() => {
    const origin = useViewerOrigin.getState().origin;
    if (reduceMotion || !origin || origin.id !== item.id) return null;
    return tileTransform(fit, origin.rect, width, height);
  });

  const open = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const zoom = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const startZoom = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  /** 1 while a one-finger pan moves a zoomed photo; 0 while it drags to dismiss. */
  const panMode = useSharedValue(0);
  const closing = useSharedValue(false);

  useEffect(() => {
    const viewer = useViewerOrigin.getState();
    if (from) viewer.hideTile(item.id);
    open.set(
      from
        ? withSpring(1, springs.settle)
        : withTiming(1, { duration: duration.state, easing: easing.out }),
    );
    return () => viewer.hideTile(null);
  }, [from, item.id, open]);

  const finish = () => {
    useViewerOrigin.getState().hideTile(null);
    if (router.canGoBack()) router.back();
  };

  /** Animates out (to the tile, or a fade), then leaves. Runs on either thread. */
  const close = (velocityY: number) => {
    'worklet';
    if (closing.get()) return;
    closing.set(true);
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(finish);
    };
    if (from) {
      zoom.set(withSpring(1, springs.settle));
      panX.set(withSpring(0, springs.settle));
      panY.set(withSpring(0, springs.settle));
      dragX.set(withSpring(0, springs.settle));
      dragY.set(withSpring(0, { ...springs.settle, velocity: velocityY }));
      open.set(withSpring(0, springs.settle, done));
    } else {
      open.set(withTiming(0, { duration: duration.state, easing: easing.out }, done));
    }
  };

  /** Animate (or, under Reduce Motion, jump) a zoom value to its target. */
  const settle = (value: number) => {
    'worklet';
    return reduceMotion ? value : withSpring(value, springs.settle);
  };

  const settleZoom = () => {
    'worklet';
    const target = clamp(zoom.get(), MIN_ZOOM, MAX_ZOOM);
    const limits = panLimits(fit, target, width, height);
    zoom.set(settle(target));
    panX.set(settle(clamp(panX.get(), -limits.x, limits.x)));
    panY.set(settle(clamp(panY.get(), -limits.y, limits.y)));
  };

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      startZoom.set(zoom.get());
      startX.set(panX.get());
      startY.set(panY.get());
      focalX.set(event.focalX - width / 2);
      focalY.set(event.focalY - height / 2);
    })
    .onUpdate((event) => {
      if (closing.get()) return;
      // A little give past the limits; settles back on release.
      const next = clamp(startZoom.get() * event.scale, MIN_ZOOM * 0.8, MAX_ZOOM * 1.2);
      zoom.set(next);
      panX.set(zoomAbout(focalX.get(), startX.get(), startZoom.get(), next));
      panY.set(zoomAbout(focalY.get(), startY.get(), startZoom.get(), next));
    })
    .onEnd(() => settleZoom());

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      panMode.set(zoom.get() > 1.01 ? 1 : 0);
      startX.set(panX.get());
      startY.set(panY.get());
    })
    .onUpdate((event) => {
      if (closing.get()) return;
      if (panMode.get() === 1) {
        panX.set(startX.get() + event.translationX);
        panY.set(startY.get() + event.translationY);
      } else {
        dragX.set(event.translationX);
        dragY.set(event.translationY);
      }
    })
    .onEnd((event) => {
      if (closing.get()) return;
      if (panMode.get() === 1) {
        settleZoom();
      } else if (shouldDismiss(event.translationY, event.velocityY)) {
        close(event.velocityY);
      } else {
        dragX.set(withSpring(0, { ...springs.snap, velocity: event.velocityX }));
        dragY.set(withSpring(0, { ...springs.snap, velocity: event.velocityY }));
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event, success) => {
      if (!success || closing.get()) return;
      if (zoom.get() > 1.01) {
        zoom.set(settle(1));
        panX.set(settle(0));
        panY.set(settle(0));
        return;
      }
      const limits = panLimits(fit, DOUBLE_TAP_ZOOM, width, height);
      zoom.set(settle(DOUBLE_TAP_ZOOM));
      panX.set(
        settle(clamp(zoomAbout(event.x - width / 2, 0, 1, DOUBLE_TAP_ZOOM), -limits.x, limits.x)),
      );
      panY.set(
        settle(clamp(zoomAbout(event.y - height / 2, 0, 1, DOUBLE_TAP_ZOOM), -limits.y, limits.y)),
      );
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: open.get() * (1 - dragProgress(dragY.get(), height)),
  }));

  const maskStyle = useAnimatedStyle(() => {
    const t = from ? mixTransform(from, IDENTITY, open.get()) : IDENTITY;
    const shrink = reduceMotion ? 1 : 1 - DRAG_SHRINK * dragProgress(dragY.get(), height);
    return {
      opacity: from ? 1 : open.get(),
      transform: [
        { translateX: t.translateX + dragX.get() },
        { translateY: t.translateY + dragY.get() },
        { scaleX: t.maskScaleX * shrink },
        { scaleY: t.maskScaleY * shrink },
      ],
    };
  });

  const photoStyle = useAnimatedStyle(() => {
    const t = from ? mixTransform(from, IDENTITY, open.get()) : IDENTITY;
    const inner = photoScaleInMask(t);
    return {
      transform: [
        { translateX: panX.get() },
        { translateY: panY.get() },
        { scaleX: inner.x * zoom.get() },
        { scaleY: inner.y * zoom.get() },
      ],
    };
  });

  // Controls fade with the backdrop so a drag reveals the grid cleanly.
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: open.get() * (1 - Math.min(1, dragProgress(dragY.get(), height) * 3)),
  }));

  const date = formatTaken(item);

  return (
    <View style={styles.flex} accessibilityViewIsModal onAccessibilityEscape={() => close(0)}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, backdropStyle]}
      />

      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.mask, maskStyle]}>
            <Animated.View
              style={[
                styles.photo,
                { left: fit.x, top: fit.y, width: fit.width, height: fit.height },
                photoStyle,
              ]}
              accessible
              accessibilityRole="image"
              accessibilityLabel={item.description}
              accessibilityHint="Pinch or double-tap to zoom. Swipe down to close."
            >
              <MediaArtwork item={item} fit="contain" glyphSize={72} />
            </Animated.View>
          </Animated.View>
        </View>
      </GestureDetector>

      <Animated.View
        pointerEvents="box-none"
        style={[styles.topBar, { paddingTop: insets.top + spacing.xs }, chromeStyle]}
      >
        <IconButton icon="close" accessibilityLabel="Close" onPress={() => close(0)} />
        <AppText variant="subhead" color="secondaryLabel" numberOfLines={1} style={styles.title}>
          {date ? date.split(' at ')[0] : ''}
        </AppText>
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[styles.bottom, { paddingBottom: insets.bottom + spacing.sm }, chromeStyle]}
      >
        {infoVisible ? (
          <Animated.View
            entering={
              reduceMotion
                ? FadeIn.duration(duration.state)
                : FadeInDown.duration(duration.surface).easing(easing.out)
            }
            exiting={FadeOut.duration(duration.press)}
          >
            <InfoPanel item={item} date={date} maxHeight={height * 0.45} />
          </Animated.View>
        ) : null}
        <Toolbar
          item={item}
          infoVisible={infoVisible}
          onToggleInfo={() => setInfoVisible((value) => !value)}
        />
      </Animated.View>
    </View>
  );
}

function formatTaken(item: MediaItem): string | null {
  if (!item.capturedAt) return null;
  return fullDate.format(new Date(isSample(item) ? item.capturedAt : (item.capturedMs ?? 0)));
}

function Toolbar({
  item,
  infoVisible,
  onToggleInfo,
}: {
  item: MediaItem;
  infoVisible: boolean;
  onToggleInfo: () => void;
}) {
  const protectedIds = useCatalog((catalog) => catalog.protectedIds);
  const setProtected = useCatalog((catalog) => catalog.setProtected);
  const sample = isSample(item);
  const isProtected = protectedIds.has(item.id);

  return (
    <View style={styles.toolbar}>
      <Button
        title={infoVisible ? 'Hide info' : 'Info'}
        icon="info"
        variant="secondary"
        onPress={onToggleInfo}
        style={styles.toolbarButton}
      />
      {!sample ? (
        <Button
          title={isProtected ? 'Unprotect' : 'Protect'}
          icon="lock"
          variant="secondary"
          onPress={() => setProtected(item.id, !isProtected)}
          accessibilityHint="Protected photos are never suggested for removal"
          style={styles.toolbarButton}
        />
      ) : null}
      {!sample && item.kind === 'photo' ? (
        <Button
          title="Smaller copy"
          icon="photo"
          onPress={() => router.push(`/export/${encodeURIComponent(item.id)}`)}
          accessibilityHint="Makes a new, smaller copy. The original stays as it is."
          style={styles.toolbarButton}
        />
      ) : null}
    </View>
  );
}

function InfoPanel({
  item,
  date,
  maxHeight,
}: {
  item: MediaItem;
  date: string | null;
  maxHeight: number;
}) {
  const protectedIds = useCatalog((catalog) => catalog.protectedIds);
  const sample = isSample(item);
  const kinds = sample
    ? ['Sample image']
    : [
        item.kind === 'video'
          ? `Video${item.durationMs ? `, ${formatDuration(item.durationMs)}` : ''}`
          : 'Photo',
        ...item.subtypes.map((subtype) => SUBTYPE_LABELS[subtype]).filter(Boolean),
      ];

  return (
    <Surface style={[styles.info, { maxHeight }]}>
      <ScrollView contentContainerStyle={styles.infoContent}>
        <View style={styles.pills}>
          {kinds.map((kind) => (
            <StatusPill key={kind} label={kind} />
          ))}
          {item.isFavorite ? <StatusPill label="Favorite" tone="accent" icon="heart" /> : null}
          {protectedIds.has(item.id) ? (
            <StatusPill label="Protected" tone="info" icon="lock" />
          ) : null}
        </View>
        <Row label="Taken" value={date ?? 'No date'} />
        <AppText variant="footnote" color="secondaryLabel">
          {sample
            ? 'Sample date.'
            : date
              ? 'From Photos, shown in this iPhone’s current time zone.'
              : 'Photos has no capture date for this item. MediaCare doesn’t guess one.'}
        </AppText>
        <Row
          label="Dimensions"
          value={item.width > 0 ? `${item.width} × ${item.height}` : 'Unknown'}
        />
        <Row label="Size" value={formatSize(item.bytes)} />
        <Row label="Source" value={sample ? 'Sample image' : 'Photos on this iPhone'} />
        {!sample && item.filename ? <Row label="File" value={item.filename} /> : null}
      </ScrollView>
    </Surface>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="subhead" color="secondaryLabel">
        {label}
      </AppText>
      <AppText variant="subhead" style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  missing: { flex: 1, justifyContent: 'center', padding: gutter },
  mask: { overflow: 'hidden' },
  photo: { position: 'absolute', overflow: 'hidden' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: gutter,
  },
  title: { flex: 1 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
    paddingHorizontal: gutter,
  },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  toolbarButton: { flexGrow: 1, borderRadius: radius.full },
  info: { padding: 0, overflow: 'hidden' },
  infoContent: { gap: spacing.xs, padding: spacing.lg },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  value: { flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
