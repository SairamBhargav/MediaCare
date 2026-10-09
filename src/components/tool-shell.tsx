import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { gutter, radius, spacing, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Button } from './button';
import { StatusPill } from './status-pill';
import { Surface } from './surface';

/**
 * Frame shared by the Studio tools: a title with Close, the two promises
 * every tool keeps (works on this iPhone, original kept), and the content.
 */
export function ToolShell({
  title,
  children,
  pills = true,
}: {
  title: string;
  children: ReactNode;
  pills?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <AppText variant="title2" accessibilityRole="header" style={styles.flex}>
          {title}
        </AppText>
        <Button title="Close" variant="plain" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {pills ? (
          <View style={styles.pills}>
            <StatusPill label="On this iPhone" icon="lock" />
            <StatusPill label="Original kept" tone="success" icon="check" />
          </View>
        ) : null}
        <Surface style={styles.surface}>{children}</Surface>
      </ScrollView>
    </View>
  );
}

/** A labelled preview box for a photo or a result. */
export function PreviewFrame({
  label,
  children,
  aspectRatio = 3 / 4,
  style,
}: {
  label?: string;
  children: ReactNode;
  aspectRatio?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.frameWrap, style]}>
      <View style={[styles.frame, { aspectRatio, backgroundColor: colors.mediaPlaceholder }]}>
        {children}
      </View>
      {label ? (
        <AppText variant="caption" color="secondaryLabel">
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

/** A labelled row of choices (chips) that wraps. */
export function ChoiceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.choice} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <AppText variant="headline">{label}</AppText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: gutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  content: { padding: gutter, gap: spacing.md, paddingBottom: spacing.xxxl },
  pills: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  surface: { gap: spacing.md },
  frameWrap: { gap: spacing.xxs },
  frame: {
    width: '100%',
    borderRadius: radius.media,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  choice: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
