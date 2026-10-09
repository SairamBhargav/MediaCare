import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { MediaTile } from '@/components/media-tile';
import { gridColumns } from '@/domain/timeline';
import type { PhotoItem } from '@/domain/media';
import { scanLibrary } from '@/features/media/start-scan';
import { STUDIO_TOOLS, type StudioToolId } from '@/features/studio/tools';
import { useCatalog } from '@/state/catalog';
import { useCreationDraft } from '@/state/creation-draft';
import { gutter, spacing, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

const GAP = 2;

/**
 * Choose what a Studio tool works on: one item (opens the tool at once) or
 * several (collage, slideshow), in the order tapped. Shows only the kind
 * of item the tool accepts.
 */
export function PickScreen({ tool }: { tool: StudioToolId }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const meta = STUDIO_TOOLS[tool];
  const items = useCatalog((catalog) => catalog.items);
  const [order, setOrder] = useState<string[]>([]);

  const choices = useMemo(
    () => items.filter((item: PhotoItem) => item.kind === meta.accepts),
    [items, meta.accepts],
  );
  const columns = gridColumns(width, fontScale);
  const tile = (width - GAP * (columns - 1)) / columns;
  const multi = meta.max > 1;

  const toggle = (id: string) => {
    haptics.selection();
    setOrder((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length >= meta.max
          ? current
          : [...current, id],
    );
  };

  const open = (ids: string[]) => {
    if (multi) useCreationDraft.getState().setIds(ids);
    router.replace(meta.route(ids[0]));
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <AppText variant="title2" accessibilityRole="header" style={styles.flex}>
          {meta.title}
        </AppText>
        <Button title="Cancel" variant="plain" onPress={() => router.back()} />
      </View>
      <AppText variant="subhead" color="secondaryLabel">
        {multi
          ? `Choose ${meta.min} to ${meta.max} ${meta.accepts === 'video' ? 'videos' : 'photos'}, in the order you want them.`
          : `Choose a ${meta.accepts}.`}
      </AppText>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {header}
      {choices.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            icon={meta.accepts === 'video' ? 'video' : 'photo'}
            title={items.length === 0 ? 'Scan your library first' : `No ${meta.accepts}s yet`}
            message={
              items.length === 0
                ? 'MediaCare shows your photos here once it has scanned your library.'
                : `MediaCare didn’t find any ${meta.accepts}s among the items it can see.`
            }
            action={
              items.length === 0 ? (
                <Button title="Scan my library" icon="scan" onPress={scanLibrary} />
              ) : undefined
            }
          />
        </View>
      ) : (
        <FlatList
          data={choices}
          key={columns}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={columns > 1 ? styles.row : undefined}
          contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
          initialNumToRender={24}
          windowSize={7}
          renderItem={({ item }) => {
            const position = order.indexOf(item.id);
            return (
              <View style={{ width: tile, marginBottom: GAP }}>
                <MediaTile
                  asset={item}
                  selectable={multi}
                  selected={position >= 0}
                  onPress={multi ? () => toggle(item.id) : () => open([item.id])}
                  style={{ width: tile }}
                />
                {position >= 0 ? (
                  <View
                    style={[styles.badge, { backgroundColor: colors.accentFill }]}
                    pointerEvents="none"
                  >
                    <AppText variant="caption" color="onAccent">
                      {position + 1}
                    </AppText>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
      {multi && choices.length > 0 ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.background },
          ]}
        >
          <Button
            title={
              order.length < meta.min
                ? `Choose at least ${meta.min}`
                : `Continue with ${order.length}`
            }
            disabled={order.length < meta.min}
            onPress={() => open(order)}
            block
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: gutter, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  empty: { padding: gutter },
  row: { gap: GAP },
  badge: {
    position: 'absolute',
    left: spacing.xxs,
    top: spacing.xxs,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: gutter },
});
