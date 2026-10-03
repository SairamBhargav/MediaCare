import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ChromeBackground } from '@/components/chrome-background';
import { MediaTile } from '@/components/media-tile';
import { ProgressBar } from '@/components/progress-bar';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { useBottomChromeHeight } from '@/components/tab-bar';
import { sampleLibrary } from '@/demo/sample-library';
import { isActive, jobFraction } from '@/domain/jobs';
import { chunkRows, gridColumns, groupByMonth } from '@/domain/timeline';
import { jobProgressText } from '@/features/clean/job-text';
import type { MediaItem } from '@/features/media/registry';
import { hasPhotoAccess, useCatalog } from '@/state/catalog';
import { useCleanSession } from '@/state/clean-session';
import { gutter, radius, spacing, useTheme } from '@/theme';

const GAP = 2;
const MONTH_HEADER_HEIGHT = 44;

type Row = { key: string; assets: MediaItem[] };

/**
 * The library as a timeline: month sections (newest first) with sticky,
 * translucent headers over an edge-to-edge grid, virtualized by row.
 *
 * Shows your Photos library once it has been cataloged; until then, the
 * sample library with a way to scan. Thumbnails are decoded by iOS at tile
 * size; nothing full-size is loaded here. Tap a photo to open it.
 */
export function LibraryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = useBottomChromeHeight();
  const { width, fontScale } = useWindowDimensions();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const items = useCatalog((catalog) => catalog.items);
  const access = useCatalog((catalog) => catalog.access);
  const job = useCleanSession((session) => session.job);
  const realScanRunning = isActive(job) && !job.sample;
  const showingReal = items.length > 0;
  const source: readonly MediaItem[] = showingReal ? items : sampleLibrary;

  const columns = gridColumns(width, fontScale);
  const tileSize = (width - GAP * (columns - 1)) / columns;

  const sections = useMemo(
    () =>
      groupByMonth(source).map((month) => ({
        key: month.key,
        title: month.title,
        count: month.items.length,
        data: chunkRows(month.items, columns).map((assets, index): Row => ({
          key: `${month.key}-${index}`,
          assets,
        })),
      })),
    [source, columns],
  );

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const scan = () => {
    useCleanSession
      .getState()
      .startLibraryScan()
      .catch(() => {});
  };

  const banner = showingReal ? (
    access === 'limited' ? (
      <View style={styles.bannerRow}>
        <AppText variant="footnote" color="secondaryLabel" style={styles.flex}>
          Showing only the photos you’ve shared with MediaCare.
        </AppText>
        <Button
          title="Manage"
          variant="plain"
          onPress={() => {
            useCatalog
              .getState()
              .manageSelection()
              .catch(() => {});
          }}
        />
      </View>
    ) : null
  ) : realScanRunning && job ? (
    <Surface style={styles.banner}>
      <AppText variant="headline">Building your library…</AppText>
      <ProgressBar
        fraction={jobFraction(job)}
        accessibilityLabel="Library scan progress"
        valueText={jobProgressText(job)}
      />
      <AppText variant="footnote" color="secondaryLabel">
        {jobProgressText(job)}. Your photos appear here when it finishes.
      </AppText>
    </Surface>
  ) : (
    <Surface style={styles.banner}>
      <AppText variant="headline">These are sample images</AppText>
      <AppText variant="footnote" color="secondaryLabel">
        {access === 'denied'
          ? 'MediaCare doesn’t have photo access. You can allow it in Settings.'
          : hasPhotoAccess(access)
            ? 'Scan once to see your own photos here. Only dates, sizes and types are read.'
            : 'Allow photo access to see your own photos here. Nothing is uploaded.'}
      </AppText>
      {access !== 'denied' ? (
        <Button
          title={hasPhotoAccess(access) ? 'Scan my library' : 'Allow access and scan'}
          icon="scan"
          onPress={scan}
          block
        />
      ) : null}
    </Surface>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.key}
        extraData={{ selected, selecting }}
        stickySectionHeadersEnabled
        initialNumToRender={12}
        windowSize={7}
        maxToRenderPerBatch={8}
        contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }}
        scrollIndicatorInsets={{ bottom: bottomChrome }}
        renderSectionHeader={({ section }) => (
          <View style={styles.monthHeader} accessibilityRole="header">
            <ChromeBackground />
            <AppText variant="headline">{section.title}</AppText>
            <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
              {section.count.toLocaleString()} {section.count === 1 ? 'item' : 'items'}
            </AppText>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.assets.map((asset) => (
              <MediaTile
                key={asset.id}
                asset={asset}
                selectable={selecting}
                selected={selected.has(asset.id)}
                onPress={
                  selecting
                    ? () => toggle(asset.id)
                    : () => router.push(`/photo/${encodeURIComponent(asset.id)}`)
                }
                style={{ width: tileSize }}
              />
            ))}
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <AppText variant="largeTitle">Library</AppText>
              <Button
                title={selecting ? 'Done' : 'Select'}
                variant="secondary"
                onPress={() => {
                  setSelecting((value) => !value);
                  setSelected(new Set());
                }}
                style={styles.selectButton}
              />
            </View>
            <View style={styles.meta}>
              <StatusPill
                label={showingReal ? 'Your library' : 'Sample library'}
                tone="accent"
                icon="photo"
              />
              <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
                {selecting
                  ? `${selected.size} selected`
                  : `${source.length.toLocaleString()} ${showingReal ? 'items' : 'sample images'}`}
              </AppText>
            </View>
            {banner}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: gutter,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  numbers: { fontVariant: ['tabular-nums'] },
  selectButton: { minHeight: 36, paddingVertical: spacing.xxs, borderRadius: radius.full },
  banner: { gap: spacing.xs },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthHeader: {
    minHeight: MONTH_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
});
