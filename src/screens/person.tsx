import { Stack, router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { FaceAvatar } from '@/components/face-avatar';
import { MediaTile } from '@/components/media-tile';
import { Surface } from '@/components/surface';
import type { PhotoItem } from '@/domain/media';
import { chunkRows } from '@/domain/timeline';
import { useCatalog } from '@/state/catalog';
import { usePeople } from '@/state/people';
import { useViewerOrigin } from '@/state/viewer-origin';
import { gutter, spacing, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

const COLUMNS = 3;
const GAP = 2;

/**
 * Every photo with one person, newest first (ADR-0011). Name them, merge
 * two groups that are the same person, hide a group, or say "not them" on
 * a photo (long-press) so it's never grouped with them again.
 */
export function PersonScreen({ personId }: { personId: number }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const people = usePeople((state) => state.people);
  const loaded = usePeople((state) => state.loaded);
  const byId = useCatalog((catalog) => catalog.byId);
  const summary = people.find((entry) => entry.person.id === personId);

  useEffect(() => {
    if (!loaded) {
      usePeople
        .getState()
        .load()
        .catch(() => {});
    }
  }, [loaded]);

  const rows = useMemo(() => {
    const photos = (summary?.assetIds ?? [])
      .map((id) => byId.get(id))
      .filter((item): item is PhotoItem => item !== undefined)
      .sort((a, b) => (b.capturedMs ?? 0) - (a.capturedMs ?? 0));
    return chunkRows(photos, COLUMNS);
  }, [summary, byId]);

  if (!summary) {
    return (
      <View style={[styles.flex, styles.content, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Person' }} />
        {loaded ? (
          <Surface>
            <EmptyState
              icon="person"
              title="Not found"
              message="This person was merged or removed."
            />
          </Surface>
        ) : null}
      </View>
    );
  }

  const name = summary.person.name;
  const tile = (width - gutter * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const askName = () => {
    Alert.prompt(
      name ? 'Rename' : 'Who is this?',
      'The name stays on this iPhone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (value?: string) => {
            if (!value?.trim()) return;
            usePeople
              .getState()
              .rename(personId, value)
              .then(() => haptics.success())
              .catch(() => haptics.error());
          },
        },
      ],
      'plain-text',
      name ?? '',
    );
  };

  const others = people.filter((entry) => entry.person.id !== personId).slice(0, 12);
  const merge = () => {
    if (others.length === 0) return;
    const labels = others.map(
      (entry) => `${entry.person.name ?? 'Unnamed'} · ${entry.assetIds.length} photos`,
    );
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `Same person as ${name ?? 'this person'}?`,
        message: 'All their photos move into one person.',
        options: [...labels, 'Cancel'],
        cancelButtonIndex: labels.length,
      },
      (index) => {
        const target = others[index];
        if (!target) return;
        // Keep the named one; otherwise keep the bigger group.
        const keepThis =
          (name && !target.person.name) ||
          (!target.person.name && summary.assetIds.length >= target.assetIds.length);
        const [from, into] = keepThis ? [target.person.id, personId] : [personId, target.person.id];
        usePeople
          .getState()
          .merge(from, into)
          .then(() => {
            haptics.success();
            if (from === personId) router.replace(`/people/${into}`);
          })
          .catch(() => haptics.error());
      },
    );
  };

  const hide = () =>
    Alert.alert('Hide this person?', 'They’re removed from People. Photos aren’t changed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Hide',
        style: 'destructive',
        onPress: () => {
          usePeople
            .getState()
            .hide(personId)
            .then(() => router.back())
            .catch(() => haptics.error());
        },
      },
    ]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: name ?? 'Person' }} />
      <FlatList
        data={rows}
        keyExtractor={(row) => row[0].id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        initialNumToRender={8}
        windowSize={7}
        ListHeaderComponent={
          <View style={styles.header}>
            <FaceAvatar face={summary.cover} size={96} />
            <AppText variant="title2">{name ?? 'Unnamed person'}</AppText>
            <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
              {summary.assetIds.length.toLocaleString()}{' '}
              {summary.assetIds.length === 1 ? 'photo' : 'photos'}
            </AppText>
            <View style={styles.actions}>
              <Button title={name ? 'Rename' : 'Add a name'} icon="person" onPress={askName} />
              {others.length > 0 ? (
                <Button title="Merge…" variant="secondary" icon="plus" onPress={merge} />
              ) : null}
              <Button title="Hide" variant="plain" icon="eye" onPress={hide} />
            </View>
            <AppText variant="footnote" color="secondaryLabel" style={styles.hint}>
              Wrong photo? Touch and hold it, then choose “Not {name ?? 'this person'}”.
            </AppText>
          </View>
        }
        renderItem={({ item: row }) => (
          <View style={styles.row}>
            {row.map((photo) => (
              <MediaTile
                key={photo.id}
                asset={photo}
                style={{ width: tile }}
                actions={[
                  {
                    label: `Not ${name ?? 'this person'}`,
                    destructive: true,
                    onPress: () => {
                      usePeople
                        .getState()
                        .reject(personId, [photo.id])
                        .catch(() => haptics.error());
                    },
                  },
                ]}
                onOpen={(rect) => {
                  useViewerOrigin.getState().setOrigin(photo.id, rect);
                  router.push(`/photo/${encodeURIComponent(photo.id)}`);
                }}
              />
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: gutter },
  list: { paddingBottom: spacing.xxl },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: gutter,
    paddingBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  hint: { textAlign: 'center' },
  numbers: { fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP, paddingHorizontal: gutter },
});
