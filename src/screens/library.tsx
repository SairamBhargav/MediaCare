import { useCallback, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { ChromeBackground } from '@/components/chrome-background';
import { MediaTile } from '@/components/media-tile';
import { StatusPill } from '@/components/status-pill';
import { useBottomChromeHeight } from '@/components/tab-bar';
import { sampleLibrary, type SampleAsset } from '@/demo/sample-library';
import { chunkRows, gridColumns, groupByMonth } from '@/domain/timeline';
import { gutter, radius, spacing, useTheme } from '@/theme';

const GAP = 2;
const MONTH_HEADER_HEIGHT = 44;

type Row = { key: string; assets: SampleAsset[] };

/**
 * Sample library as a timeline: month sections (newest first) with sticky,
 * translucent headers over an edge-to-edge grid. Virtualized by row, so only
 * visible rows render. Columns adapt to width and very large text. Select
 * mode marks photos; the viewer arrives in P1-LIB-003.
 */
export function LibraryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = useBottomChromeHeight();
  const { width, fontScale } = useWindowDimensions();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const columns = gridColumns(width, fontScale);
  const tileSize = (width - GAP * (columns - 1)) / columns;

  const sections = useMemo(
    () =>
      groupByMonth(sampleLibrary).map((month) => ({
        key: month.key,
        title: month.title,
        count: month.items.length,
        data: chunkRows(month.items, columns).map((assets, index): Row => ({
          key: `${month.key}-${index}`,
          assets,
        })),
      })),
    [columns],
  );

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.key}
        extraData={{ selected, selecting }}
        stickySectionHeadersEnabled
        initialNumToRender={12}
        windowSize={7}
        contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }}
        scrollIndicatorInsets={{ bottom: bottomChrome }}
        renderSectionHeader={({ section }) => (
          <View style={styles.monthHeader} accessibilityRole="header">
            <ChromeBackground />
            <AppText variant="headline">{section.title}</AppText>
            <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
              {section.count} {section.count === 1 ? 'photo' : 'photos'}
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
                onPress={selecting ? () => toggle(asset.id) : undefined}
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
              <StatusPill label="Sample library" tone="accent" icon="photo" />
              <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
                {selecting ? `${selected.size} selected` : `${sampleLibrary.length} sample images`}
              </AppText>
            </View>
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
