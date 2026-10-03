import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { Surface } from '@/components/surface';
import { needsAccessExplainer } from '@/features/media/start-scan';
import { openSettings } from '@/services/media/photo-library';
import { hasPhotoAccess, useCatalog } from '@/state/catalog';
import { useCleanSession } from '@/state/clean-session';
import { gutter, spacing, useTheme } from '@/theme';

const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const POINTS: readonly { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'scan',
    title: 'What MediaCare reads',
    text: 'Dates, sizes, types and dimensions of your photos and videos, to find bursts, screenshots and long videos. Thumbnails come from Photos on this iPhone.',
  },
  {
    icon: 'lock',
    title: 'Stays on this iPhone',
    text: 'Nothing is uploaded. There’s no account and no MediaCare server. Nothing is removed from Photos.',
  },
  {
    icon: 'photo',
    title: 'All photos or just some',
    text: 'iOS lets you share all photos or only ones you pick. Both work, and you can change it any time in Settings.',
  },
];

/**
 * Explains photo access before iOS asks (P1-ONB-002). Shown only while iOS
 * hasn't asked yet; the system prompt appears only after "Continue". "Not
 * now" leaves without asking, and sample images stay available.
 *
 * With `then=scan`, a granted answer starts the library scan. Opened again
 * from Settings after iOS has asked, it shows the current access and how to
 * change it instead of a button that can't prompt.
 */
export function AccessScreen({ then }: { then?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [asking, setAsking] = useState(false);
  const access = useCatalog((catalog) => catalog.access);
  const canAsk = needsAccessExplainer(access);
  const current =
    access === 'full' ? 'all photos' : access === 'limited' ? 'selected photos' : 'no photos';

  const allow = async () => {
    setAsking(true);
    try {
      const access = await useCatalog.getState().requestAccess();
      if (hasPhotoAccess(access) && then === 'scan') {
        useCleanSession
          .getState()
          .startLibraryScan()
          .catch(() => {});
      }
    } catch {
      // The screens that need access show its current state and a way forward.
    } finally {
      setAsking(false);
      router.back();
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.iconWell, { backgroundColor: colors.surfaceRaised }]}>
          <Icon name="library" size={30} color={colors.accent} />
        </View>
        <AppText variant="title1" accessibilityRole="header">
          Your photos, on your terms
        </AppText>
        <AppText variant="body" color="secondaryLabel">
          {canAsk
            ? 'Next, iOS will ask whether MediaCare can see your photos.'
            : `MediaCare can currently see ${current}. You can change this in iOS Settings.`}
          {inExpoGo ? ' While testing in Expo Go, access belongs to Expo Go.' : ''}
        </AppText>
        <Surface style={styles.points}>
          {POINTS.map((point) => (
            <View key={point.title} style={styles.point}>
              <Icon name={point.icon} size={22} color={colors.accent} />
              <View style={styles.pointText}>
                <AppText variant="headline">{point.title}</AppText>
                <AppText variant="subhead" color="secondaryLabel">
                  {point.text}
                </AppText>
              </View>
            </View>
          ))}
        </Surface>
      </ScrollView>
      <View style={styles.actions}>
        {canAsk ? (
          <>
            <Button
              title="Continue"
              onPress={() => {
                allow().catch(() => {});
              }}
              loading={asking}
              disabled={asking}
              accessibilityHint="Shows the iOS photo access request"
              block
            />
            <Button title="Not now" variant="plain" onPress={() => router.back()} block />
          </>
        ) : (
          <>
            <Button
              title="Change in iOS Settings"
              variant="secondary"
              onPress={() => {
                openSettings().catch(() => {});
              }}
              block
            />
            <Button title="Done" variant="plain" onPress={() => router.back()} block />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: gutter },
  scroll: { gap: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  points: { gap: spacing.lg },
  point: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  pointText: { flex: 1, gap: spacing.xxs },
  actions: { gap: spacing.xs },
});
