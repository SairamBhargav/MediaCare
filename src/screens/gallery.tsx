import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { MediaTile } from '@/components/media-tile';
import { SectionHeader } from '@/components/section-header';
import { SelectionBadge } from '@/components/selection-badge';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { sampleLibrary } from '@/demo/sample-library';
import { CleanContent } from '@/screens/clean/clean-content';
import { sampleResultsState, type CleanHomeState } from '@/state/clean-session';
import {
  gutter,
  radius,
  spacing,
  typography,
  useReduceMotion,
  useTheme,
  type ColorToken,
  type TypographyVariant,
} from '@/theme';

const SWATCHES: ColorToken[] = [
  'background',
  'surface',
  'surfaceRaised',
  'label',
  'secondaryLabel',
  'separator',
  'accent',
  'accentText',
  'accentFill',
  'danger',
  'warning',
  'success',
  'info',
];

/**
 * Development-only gallery of primitives in their states, for checking both
 * themes, Dynamic Type and motion on a device. Reached from Settings → Developer.
 */
export function GalleryScreen() {
  const { colors, scheme } = useTheme();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [badgeOn, setBadgeOn] = useState(false);
  const [cleanPreview, setCleanPreview] = useState<CleanPreview>('results');
  const tiles = sampleLibrary.slice(0, 6);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.pills}>
        <StatusPill label={`Theme: ${scheme}`} />
        <StatusPill
          label={reduceMotion ? 'Reduced motion' : 'Full motion'}
          tone={reduceMotion ? 'warning' : 'success'}
          icon="motion"
        />
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Tokens" title="Typography" />
        {(Object.keys(typography) as TypographyVariant[]).map((variant) => (
          <AppText key={variant} variant={variant}>
            {variant}
          </AppText>
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Tokens" title="Color" />
        <View style={styles.swatches}>
          {SWATCHES.map((token) => (
            <View key={token} style={styles.swatch}>
              <View
                style={[
                  styles.swatchChip,
                  { backgroundColor: colors[token], borderColor: colors.separator },
                ]}
              />
              <AppText variant="caption" color="secondaryLabel">
                {token}
              </AppText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Press feedback" title="Buttons" />
        <Button title="Primary" block />
        <Button title="Secondary" variant="secondary" block />
        <Button title="Destructive (labelled)" variant="destructive" icon="warning" block />
        <Button title="Loading" loading block accessibilityHint="Example of a busy button" />
        <Button title="Disabled" disabled block />
        <View style={styles.inline}>
          <Button title="Plain" variant="plain" />
          <IconButton icon="settings" accessibilityLabel="Example icon button" />
          <IconButton icon="close" accessibilityLabel="Example close button" variant="plain" />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Status" title="Pills" />
        <View style={styles.inline}>
          <StatusPill label="Sample" tone="accent" icon="photo" />
          <StatusPill label="Analyzed" tone="success" icon="check" />
          <StatusPill label="Needs original" tone="warning" icon="warning" />
          <StatusPill label="Failed" tone="danger" icon="warning" />
          <StatusPill label="Info" tone="info" icon="info" />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Motion" title="Selection" />
        <View style={styles.inline}>
          <IconButton
            icon="check"
            accessibilityLabel="Toggle example badge"
            onPress={() => setBadgeOn((value) => !value)}
          />
          <View style={[styles.badgeStage, { backgroundColor: colors.mediaPlaceholder }]}>
            <SelectionBadge selected={badgeOn} />
          </View>
          <AppText variant="footnote" color="secondaryLabel" style={styles.flex}>
            Tap repeatedly: the badge must retarget mid-spring without jumping.
          </AppText>
        </View>
        <View style={styles.tiles}>
          {tiles.map((asset, index) => (
            <View key={asset.id} style={styles.tileCell}>
              <MediaTile
                asset={asset}
                appearance="card"
                keeper={index === 0}
                selectable
                selected={selected.has(asset.id)}
                onPress={
                  index === 0
                    ? undefined
                    : () =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(asset.id)) next.delete(asset.id);
                          else next.add(asset.id);
                          return next;
                        })
                }
              />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="States" title="Empty and error" />
        <Surface>
          <EmptyState
            icon="duplicate"
            title="No repeat shots found"
            message="Everything scanned so far looks unique."
          />
        </Surface>
        <Surface>
          <EmptyState
            icon="warning"
            tone="error"
            title="Scan stopped"
            message="Photo access was turned off in Settings. Your progress is saved."
            action={<Button title="Open Settings" variant="secondary" />}
          />
        </Surface>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Screens" title="Clean home states" />
        <View style={styles.inline}>
          {(Object.keys(CLEAN_PREVIEWS) as CleanPreview[]).map((key) => (
            <Button
              key={key}
              title={key}
              variant={key === cleanPreview ? 'primary' : 'secondary'}
              onPress={() => setCleanPreview(key)}
              style={styles.chip}
            />
          ))}
        </View>
        <CleanContent
          state={CLEAN_PREVIEWS[cleanPreview]}
          onShowSample={() => setCleanPreview('results')}
          onReset={() => setCleanPreview('not scanned')}
        />
      </View>
    </ScrollView>
  );
}

const resultsPreview = sampleResultsState;

const CLEAN_PREVIEWS: Record<string, CleanHomeState> = {
  'not scanned': { status: 'not-scanned' },
  results: resultsPreview,
  partial: { ...resultsPreview, analyzed: 40 },
  'no findings': { ...resultsPreview, findings: [] },
  failed: {
    status: 'failed',
    message: 'Photo access was turned off in Settings. Your progress is saved.',
  },
};

type CleanPreview = keyof typeof CLEAN_PREVIEWS;

const styles = StyleSheet.create({
  content: { padding: gutter, gap: spacing.xxl },
  section: { gap: spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { width: 96, gap: spacing.xxs },
  swatchChip: {
    height: 44,
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeStage: {
    width: 56,
    height: 56,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tileCell: { width: '31%', flexGrow: 1 },
  chip: { minHeight: 36, paddingVertical: spacing.xxs },
});
