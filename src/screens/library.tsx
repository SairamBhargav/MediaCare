import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { MediaTile } from '@/components/media-tile';
import { StatusPill } from '@/components/status-pill';
import { useBottomChromeHeight } from '@/components/tab-bar';
import { sampleLibrary, type SampleAsset } from '@/demo/sample-library';
import { gutter, radius, spacing, useTheme } from '@/theme';

const COLUMNS = 3;
const GAP = 2;

/**
 * Sample library grid: virtualized, edge-to-edge, three columns. Month/day
 * sections, the photo viewer and real assets come in later tasks
 * (BACKLOG P1-LIB-001, P2-MEDIA-004).
 */
export function LibraryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomChrome = useBottomChromeHeight();
  const { width } = useWindowDimensions();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const tileSize = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: SampleAsset }) => (
      <MediaTile
        asset={item}
        selectable={selecting}
        selected={selected.has(item.id)}
        onPress={selecting ? () => toggle(item.id) : undefined}
        style={{ width: tileSize }}
      />
    ),
    [selecting, selected, tileSize, toggle],
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={sampleLibrary}
      keyExtractor={(item) => item.id}
      numColumns={COLUMNS}
      renderItem={renderItem}
      extraData={selected}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xs, paddingBottom: bottomChrome + spacing.xl },
      ]}
      scrollIndicatorInsets={{ bottom: bottomChrome }}
      getItemLayout={(_, index) => ({
        length: tileSize + GAP,
        offset: (tileSize + GAP) * Math.floor(index / COLUMNS),
        index,
      })}
      initialNumToRender={COLUMNS * 8}
      windowSize={7}
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
            <AppText variant="footnote" color="secondaryLabel">
              {selecting ? `${selected.size} selected` : `${sampleLibrary.length} sample images`}
            </AppText>
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { gap: GAP },
  row: { gap: GAP },
  header: {
    paddingHorizontal: gutter,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  selectButton: { minHeight: 36, paddingVertical: spacing.xxs, borderRadius: radius.full },
});
