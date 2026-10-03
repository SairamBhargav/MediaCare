import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveJobBar } from '@/components/active-job-bar';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { MediaTile } from '@/components/media-tile';
import { SampleArtwork } from '@/components/sample-artwork';
import { SectionHeader } from '@/components/section-header';
import { SelectionBadge } from '@/components/selection-badge';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { sampleLibrary } from '@/demo/sample-library';
import type { Job } from '@/domain/jobs';
import { CleanContent } from '@/screens/clean/clean-content';
import { sampleResultsState, useCleanSession, type CleanHomeState } from '@/state/clean-session';
import { usePreferences, type AppearancePreference } from '@/state/preferences';
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
  const { colors, scheme, highContrast } = useTheme();
  const appearance = usePreferences((state) => state.appearance);
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [badgeOn, setBadgeOn] = useState(false);
  const [cleanPreview, setCleanPreview] = useState<CleanPreview>('results');
  const [chip, setChip] = useState('Original');
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
        {highContrast ? <StatusPill label="Increase Contrast" tone="info" /> : null}
      </View>
      <View style={styles.inline} accessibilityRole="radiogroup" accessibilityLabel="Theme">
        {(['system', 'light', 'dark'] as AppearancePreference[]).map((value) => (
          <Chip
            key={value}
            label={value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark'}
            selected={appearance === value}
            onPress={() => usePreferences.getState().setAppearance(value)}
          />
        ))}
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
        <SectionHeader eyebrow="Jobs" title="Job bar states" />
        <AppText variant="footnote" color="secondaryLabel">
          Previews with made-up sample numbers. Their buttons act on the real session, which has no
          job here, so they do nothing.
        </AppText>
        {JOB_PREVIEWS.map(({ label, job }) => (
          <View key={label} style={styles.jobPreview}>
            <AppText variant="caption" color="secondaryLabel">
              {label}
            </AppText>
            <ActiveJobBar job={job} />
          </View>
        ))}
        <Button
          title="Open the scan sheet with a sample scan"
          variant="secondary"
          onPress={() => {
            useCleanSession.getState().startSampleScan();
            router.push('/scan');
          }}
          accessibilityHint="Starts the labelled, simulated sample scan"
          block
        />
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Controls" title="Chips" />
        <View style={styles.inline} accessibilityRole="radiogroup">
          {['Original', '2048 px', '1080 px'].map((label) => (
            <Chip
              key={label}
              label={label}
              selected={chip === label}
              onPress={() => setChip(label)}
            />
          ))}
          <Chip label="Unavailable" selected={false} onPress={() => {}} disabled />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Placeholder" title="Before and after" />
        <View style={styles.inline}>
          {[
            { label: 'Original (sample)', asset: sampleLibrary[0] },
            { label: 'Copy (sample)', asset: sampleLibrary[0] },
          ].map(({ label, asset }) => (
            <View key={label} style={styles.beforeAfter}>
              <View style={styles.beforeAfterImage}>
                <SampleArtwork asset={asset} glyphSize={36} />
              </View>
              <AppText variant="footnote" color="secondaryLabel">
                {label}
              </AppText>
            </View>
          ))}
        </View>
        <AppText variant="footnote" color="secondaryLabel">
          Static placeholder. An interactive before/after comparison isn’t built yet.
        </AppText>
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
          access={cleanPreview === 'denied' ? 'denied' : 'undetermined'}
          actions={{
            onScanLibrary: () => setCleanPreview('results'),
            onSampleScan: () => setCleanPreview('results'),
            onManageSelection: () => {},
            onOpenSettings: () => {},
            onReset: () => setCleanPreview('not scanned'),
          }}
        />
      </View>
    </ScrollView>
  );
}

const resultsPreview = sampleResultsState;

const previewJob = (overrides: Partial<Job>): Job => ({
  id: 'gallery-preview',
  kind: 'scan',
  sample: true,
  status: 'running',
  stage: 'checking',
  processed: 48,
  total: 120,
  ...overrides,
});

const JOB_PREVIEWS: readonly { label: string; job: Job }[] = [
  { label: 'Running, total known', job: previewJob({}) },
  { label: 'Running, total not known yet', job: previewJob({ stage: 'listing', total: null }) },
  { label: 'Paused', job: previewJob({ status: 'paused' }) },
  {
    label: 'Finished',
    job: previewJob({ status: 'succeeded', stage: 'grouping', processed: 120 }),
  },
  {
    label: 'Failed',
    job: previewJob({ status: 'failed', error: 'Photo access was turned off.' }),
  },
  { label: 'Stopped', job: previewJob({ status: 'canceled' }) },
];

const CLEAN_PREVIEWS: Record<string, CleanHomeState> = {
  'not scanned': { status: 'not-scanned' },
  denied: { status: 'not-scanned' },
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
  jobPreview: { gap: spacing.xxs },
  beforeAfter: { flex: 1, gap: spacing.xs },
  beforeAfterImage: {
    aspectRatio: 3 / 4,
    borderRadius: radius.media,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
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
