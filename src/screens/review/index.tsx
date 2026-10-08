import { Stack, router } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { MediaArtwork } from '@/components/media-artwork';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { getMediaItem, type MediaItem } from '@/features/media/registry';
import { formatSize } from '@/domain/bytes';
import { describeDifferences } from '@/domain/compare';
import type { GroupFinding } from '@/domain/findings';
import { toggleSelected } from '@/domain/review-selection';
import { CATEGORY_META } from '@/features/clean/category-meta';
import { tuningLine } from '@/features/media/visual-debug';
import { useCleanSession } from '@/state/clean-session';
import { selectionFor, toReviewGroup, useReviewSession } from '@/state/review-session';
import { duration, gutter, radius, spacing, useReduceMotion, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

import { PhotoPager, type PhotoPagerHandle } from './photo-pager';
import { ThumbStrip } from './thumb-strip';

/**
 * Full-screen review of one group: swipe through photos (or compare any
 * photo side by side with the keeper), pinch to inspect, read how each photo
 * differs from the keeper, and make reversible choices. "Next group" moves
 * through the rest of the category. Nothing here removes anything.
 */
export function ReviewScreen({ groupId }: { groupId: string }) {
  const state = useCleanSession((session) => session.state);
  const [currentId, setCurrentId] = useState(groupId);

  const all = state.status === 'results' ? state.findings : [];
  const start = all.find(
    (finding): finding is GroupFinding => finding.kind === 'group' && finding.id === groupId,
  );
  const siblings = start
    ? all.filter(
        (finding): finding is GroupFinding =>
          finding.kind === 'group' && finding.category === start.category,
      )
    : [];
  const group = siblings.find((finding) => finding.id === currentId);

  if (!group) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: 'Review' }} />
        <EmptyState
          icon="stack"
          title="This group isn’t available"
          message="Run the sample scan on the Clean tab, then open a group to review it."
          action={<Button title="Close" variant="secondary" onPress={() => router.back()} />}
        />
      </View>
    );
  }

  const position = siblings.indexOf(group);
  const next = siblings[position + 1];

  return (
    <GroupReviewBody
      key={group.id}
      group={group}
      position={position}
      count={siblings.length}
      onNext={
        next
          ? () => {
              setCurrentId(next.id);
              AccessibilityInfo.announceForAccessibility(
                `Group ${position + 2} of ${siblings.length}: ${next.title}`,
              );
            }
          : undefined
      }
    />
  );
}

function GroupReviewBody({
  group,
  position,
  count,
  onNext,
}: {
  group: GroupFinding;
  position: number;
  count: number;
  onNext?: () => void;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { height, width } = useWindowDimensions();
  const review = useReviewSession();
  const pager = useRef<PhotoPagerHandle>(null);
  const [mode, setMode] = useState<'single' | 'side-by-side'>('single');

  const reviewGroup = toReviewGroup(group, review);
  const selection = selectionFor(group, review);
  const photos = group.memberIds.map(getMediaItem);
  const keeper = getMediaItem(selection.keeperId);
  const firstOther = Math.max(
    0,
    photos.findIndex((photo) => photo.id !== selection.keeperId),
  );
  const [index, setIndex] = useState(firstOther);
  const photo = photos[index];
  const isKeeper = photo.id === selection.keeperId;
  const isProtected = review.protectedIds.has(photo.id);
  const isSelected = selection.selectedIds.has(photo.id);

  const goTo = (target: number) => {
    const clamped = Math.max(0, Math.min(photos.length - 1, target));
    setIndex(clamped);
    pager.current?.scrollTo(clamped);
  };

  const status = isKeeper
    ? 'Keeper'
    : isProtected
      ? 'Protected'
      : isSelected
        ? 'Marked for review'
        : 'Not marked';

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: group.title }} />
      <Animated.View
        style={styles.flex}
        entering={
          position === 0
            ? undefined
            : reduceMotion
              ? FadeIn.duration(duration.state)
              : SlideInRight.duration(duration.surface).springify().dampingRatio(1)
        }
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
        >
          <View style={[styles.topRow, styles.gutter]}>
            <StatusPill
              label={`Sample · ${CATEGORY_META[group.category].title} · Group ${position + 1} of ${count}`}
              tone="accent"
              icon="photo"
            />
          </View>

          <View style={[styles.modes, styles.gutter]} accessibilityRole="radiogroup">
            {(['single', 'side-by-side'] as const).map((value) => (
              <Button
                key={value}
                title={value === 'single' ? 'One at a time' : 'Side by side'}
                icon={value === 'single' ? 'photo' : 'compare'}
                variant={mode === value ? 'primary' : 'secondary'}
                onPress={() => setMode(value)}
                style={styles.mode}
              />
            ))}
          </View>

          {mode === 'single' ? (
            <PhotoPager
              ref={pager}
              photos={photos}
              initialIndex={index}
              onIndexChange={setIndex}
              maxHeight={Math.round(height * 0.42)}
            />
          ) : (
            <SideBySide
              keeper={keeper}
              photo={isKeeper ? photos[firstOther] : photo}
              width={width}
            />
          )}

          <View style={[styles.navRow, styles.gutter]}>
            <IconButton
              icon="chevronLeft"
              accessibilityLabel="Previous photo"
              onPress={() => goTo(index - 1)}
            />
            <AppText variant="subhead" color="secondaryLabel" style={styles.numbers}>
              Photo {index + 1} of {photos.length}
            </AppText>
            <IconButton
              icon="chevronRight"
              accessibilityLabel="Next photo"
              onPress={() => goTo(index + 1)}
            />
          </View>

          <ThumbStrip
            photos={photos}
            currentIndex={index}
            keeperId={selection.keeperId}
            selectedIds={selection.selectedIds}
            protectedIds={review.protectedIds}
            onSelectIndex={goTo}
          />

          <Surface style={[styles.details, styles.gutterMargin]}>
            <View style={styles.statusRow}>
              <AppText variant="headline" accessibilityLiveRegion="polite">
                {status}
              </AppText>
              <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
                {photo.source === 'sample'
                  ? `${formatSize(photo.bytes)} · sample size`
                  : formatSize(photo.bytes)}
              </AppText>
            </View>
            {isKeeper ? (
              <AppText variant="subhead" color="secondaryLabel">
                {selection.keeperId === group.keeperId
                  ? `Suggested: ${group.keeperReason.toLowerCase()}.`
                  : 'You chose this one to keep.'}
              </AppText>
            ) : (
              <>
                <AppText variant="footnote" color="secondaryLabel">
                  Compared with the keeper:
                </AppText>
                {describeDifferences(photo, keeper).map((line) => (
                  <AppText key={line} variant="subhead">
                    {line}
                  </AppText>
                ))}
                {__DEV__ && group.category === 'similar' ? (
                  <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
                    {tuningLine(photo.id, keeper.id) ?? 'Tuning: not looked at yet'}
                  </AppText>
                ) : null}
              </>
            )}
          </Surface>

          <View style={[styles.actions, styles.gutter]}>
            {!isKeeper && !isProtected ? (
              <Button
                title={isSelected ? 'Unmark' : 'Mark for review'}
                icon={isSelected ? 'close' : 'check'}
                variant={isSelected ? 'secondary' : 'primary'}
                onPress={() => {
                  haptics.selection();
                  review.setGroupSelection(
                    group.id,
                    toggleSelected(reviewGroup, selection, photo.id),
                  );
                }}
                block
              />
            ) : null}
            <View style={styles.actionRow}>
              {!isKeeper ? (
                <Button
                  title="Keep this one"
                  icon="star"
                  variant="secondary"
                  onPress={() => {
                    review.setGroupKeeper(group, photo.id);
                    AccessibilityInfo.announceForAccessibility('Keeper changed');
                  }}
                  style={styles.flex}
                />
              ) : null}
              <Button
                title={isProtected ? 'Unprotect' : 'Protect'}
                icon="lock"
                variant="secondary"
                onPress={() => review.toggleProtected(photo.id)}
                style={styles.flex}
              />
            </View>
          </View>

          <View style={[styles.footer, styles.gutter]}>
            <AppText variant="footnote" color="secondaryLabel" style={styles.center}>
              Marking only records your choice. Nothing is removed from here.
            </AppText>
            {onNext ? (
              <Button title="Next group" icon="chevronRight" onPress={onNext} block />
            ) : (
              <Button title="Done" onPress={() => router.back()} block />
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function SideBySide({
  keeper,
  photo,
  width,
}: {
  keeper: MediaItem;
  photo: MediaItem;
  width: number;
}) {
  const { colors } = useTheme();
  const paneWidth = (width - gutter * 2 - spacing.sm) / 2;
  return (
    <View style={[styles.sideBySide, styles.gutter]}>
      {[
        { asset: keeper, label: 'Keeper' },
        { asset: photo, label: 'This photo' },
      ].map(({ asset, label }) => (
        <View key={label} style={styles.pane}>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${label}: ${asset.description}`}
            style={[
              styles.panePhoto,
              {
                width: paneWidth,
                height: paneWidth / (asset.width / asset.height),
                backgroundColor: colors.mediaPlaceholder,
              },
            ]}
          >
            <MediaArtwork item={asset} glyphSize={40} />
          </View>
          <AppText variant="caption" color="secondaryLabel">
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  missing: { flex: 1, justifyContent: 'center', padding: gutter },
  content: { gap: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
  gutter: { paddingHorizontal: gutter },
  gutterMargin: { marginHorizontal: gutter },
  topRow: { flexDirection: 'row' },
  modes: { flexDirection: 'row', gap: spacing.xs },
  mode: { flex: 1, minHeight: 40, paddingVertical: spacing.xxs },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  numbers: { fontVariant: ['tabular-nums'] },
  details: { gap: spacing.xxs },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  actions: { gap: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  footer: { gap: spacing.sm },
  center: { textAlign: 'center' },
  sideBySide: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  pane: { gap: spacing.xxs, alignItems: 'center' },
  panePhoto: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
});
