import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { FaceAvatar } from '@/components/face-avatar';
import { PressableScale } from '@/components/pressable-scale';
import { usePeople } from '@/state/people';
import { gutter, spacing } from '@/theme';
import { haptics } from '@/utils/haptics';

const AVATAR = 64;
const SHOWN = 12;

/** The People row at the top of Library (ADR-0011); hidden until people are found. */
export function LibraryPeople() {
  const loaded = usePeople((state) => state.loaded);
  const people = usePeople((state) => state.people);

  useEffect(() => {
    if (!loaded) {
      usePeople
        .getState()
        .load()
        .catch(() => {});
    }
  }, [loaded]);

  if (people.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <AppText variant="headline" accessibilityRole="header" style={styles.flex}>
          People
        </AppText>
        <Button
          title="See all"
          variant="plain"
          onPress={() => router.push('/people')}
          accessibilityHint="Shows everyone found in your photos"
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        style={styles.bleed}
      >
        {people.slice(0, SHOWN).map((summary) => (
          <PressableScale
            key={summary.person.id}
            style={styles.person}
            accessibilityRole="button"
            accessibilityLabel={`${summary.person.name ?? 'Unnamed person'}, ${summary.assetIds.length} photos`}
            onPress={() => {
              haptics.light();
              router.push(`/people/${summary.person.id}`);
            }}
          >
            <FaceAvatar face={summary.cover} size={AVATAR} />
            <AppText
              variant="caption"
              color={summary.person.name ? 'label' : 'secondaryLabel'}
              numberOfLines={1}
            >
              {summary.person.name ?? 'Add name'}
            </AppText>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  bleed: { marginHorizontal: -gutter },
  strip: { paddingHorizontal: gutter, gap: spacing.sm },
  person: { width: AVATAR, alignItems: 'center', gap: spacing.xxs },
});
