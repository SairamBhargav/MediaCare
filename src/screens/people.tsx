import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { FaceAvatar } from '@/components/face-avatar';
import { PressableScale } from '@/components/pressable-scale';
import { Surface } from '@/components/surface';
import type { PersonSummary } from '@/domain/people';
import { facesAvailable } from '@/services/media/visual-analysis';
import { usePeople } from '@/state/people';
import { gutter, spacing, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

const COLUMNS = 3;

export function personTitle(summary: PersonSummary): string {
  return summary.person.name ?? 'Add a name';
}

/**
 * People found on this iPhone (ADR-0011): one circle per person, named
 * people first. Tapping one shows every photo they're in.
 */
export function PeopleScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const loaded = usePeople((state) => state.loaded);
  const people = usePeople((state) => state.people);

  useEffect(() => {
    usePeople
      .getState()
      .load()
      .catch(() => {});
  }, []);

  const cell = (width - gutter * 2 - spacing.md * (COLUMNS - 1)) / COLUMNS;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'People' }} />
      <FlatList
        data={people}
        keyExtractor={(summary) => String(summary.person.id)}
        numColumns={COLUMNS}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <AppText variant="subhead" color="secondaryLabel" style={styles.intro}>
            Found on this iPhone by comparing faces. It can make mistakes: open a person to rename,
            merge or remove a photo.
          </AppText>
        }
        ListEmptyComponent={
          loaded ? (
            <Surface>
              <EmptyState
                icon="person"
                title="No people yet"
                message={
                  facesAvailable()
                    ? 'Tap Check my photos on the Clean tab. People seen in at least two photos appear here.'
                    : 'Finding people needs the latest MediaCare app.'
                }
              />
            </Surface>
          ) : null
        }
        renderItem={({ item }) => (
          <PressableScale
            style={[styles.person, { width: cell }]}
            accessibilityRole="button"
            accessibilityLabel={`${item.person.name ?? 'Unnamed person'}, ${item.assetIds.length} photos`}
            onPress={() => {
              haptics.light();
              router.push(`/people/${item.person.id}`);
            }}
          >
            <FaceAvatar face={item.cover} size={cell - spacing.sm} />
            <AppText
              variant="subhead"
              color={item.person.name ? 'label' : 'secondaryLabel'}
              numberOfLines={1}
            >
              {personTitle(item)}
            </AppText>
            <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
              {item.assetIds.length.toLocaleString()}
            </AppText>
          </PressableScale>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: gutter, paddingBottom: spacing.xxl, gap: spacing.lg },
  intro: { marginBottom: spacing.xs },
  row: { gap: spacing.md },
  person: { alignItems: 'center', gap: spacing.xxs },
  numbers: { fontVariant: ['tabular-nums'] },
});
