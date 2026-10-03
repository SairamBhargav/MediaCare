import { Stack, router } from 'expo-router';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { MediaArtwork } from '@/components/media-artwork';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { formatSize } from '@/domain/bytes';
import { formatDuration } from '@/domain/media';
import { findMediaItem, isSample } from '@/features/media/registry';
import { useCatalog } from '@/state/catalog';
import { gutter, radius, spacing, useTheme } from '@/theme';

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

/**
 * One photo or video: the whole picture (pinch to zoom), where its date
 * comes from, what it is, and what you can do with it. Read-only towards
 * Photos except "Make a smaller copy", which adds a new item.
 */
export function PhotoScreen({ id }: { id: string }) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const protectedIds = useCatalog((catalog) => catalog.protectedIds);
  const setProtected = useCatalog((catalog) => catalog.setProtected);
  const item = findMediaItem(id);

  if (!item) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState
          icon="photo"
          title="This photo isn’t available"
          message="It may have been deleted or is no longer shared with MediaCare."
          action={<Button title="Close" variant="secondary" onPress={() => router.back()} />}
        />
      </View>
    );
  }

  const sample = isSample(item);
  const aspect = item.width > 0 && item.height > 0 ? item.width / item.height : 1;
  const frameWidth = width - gutter * 2;
  const frameHeight = Math.min(height * 0.55, frameWidth / aspect);
  const isProtected = protectedIds.has(item.id);
  const date = item.capturedAt
    ? fullDate.format(new Date(sample ? item.capturedAt : (item.capturedMs ?? 0)))
    : null;
  const kinds = sample
    ? ['Sample image']
    : [
        item.kind === 'video'
          ? `Video${item.durationMs ? `, ${formatDuration(item.durationMs)}` : ''}`
          : 'Photo',
        ...item.subtypes.map((subtype) => SUBTYPE_LABELS[subtype]).filter(Boolean),
      ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: date ? date.split(' at ')[0] : 'Photo' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <ScrollView
          style={{ height: frameHeight }}
          contentContainerStyle={styles.zoomContent}
          maximumZoomScale={4}
          minimumZoomScale={1}
          bouncesZoom
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          accessible
          accessibilityRole="image"
          accessibilityLabel={item.description}
          accessibilityHint="Pinch to zoom"
        >
          <View
            style={[
              styles.photo,
              {
                width: frameHeight * aspect,
                height: frameHeight,
                backgroundColor: colors.mediaPlaceholder,
              },
            ]}
          >
            <MediaArtwork item={item} fit="contain" glyphSize={72} />
          </View>
        </ScrollView>

        <View style={styles.gutter}>
          <View style={styles.pills}>
            {kinds.map((kind) => (
              <StatusPill key={kind} label={kind} />
            ))}
            {item.isFavorite ? <StatusPill label="Favorite" tone="accent" icon="heart" /> : null}
            {isProtected ? <StatusPill label="Protected" tone="info" icon="lock" /> : null}
          </View>
        </View>

        <Surface style={[styles.details, styles.gutterMargin]}>
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
          {!sample && item.filename ? <Row label="File" value={item.filename} /> : null}
        </Surface>

        <View style={[styles.actions, styles.gutter]}>
          {!sample && item.kind === 'photo' ? (
            <Button
              title="Make a smaller copy"
              icon="photo"
              onPress={() => router.push(`/export/${encodeURIComponent(item.id)}`)}
              block
            />
          ) : null}
          {!sample ? (
            <Button
              title={isProtected ? 'Unprotect' : 'Protect'}
              icon="lock"
              variant="secondary"
              onPress={() => setProtected(item.id, !isProtected)}
              accessibilityHint="Protected photos are never suggested for removal"
              block
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
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
  content: { gap: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
  zoomContent: { alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  photo: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  gutter: { paddingHorizontal: gutter },
  gutterMargin: { marginHorizontal: gutter },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  details: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  value: { flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  actions: { gap: spacing.sm },
});
