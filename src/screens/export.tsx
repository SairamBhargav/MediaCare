import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { MediaArtwork } from '@/components/media-artwork';
import { Surface } from '@/components/surface';
import { insertDerivative } from '@/db/catalog-repo';
import { formatBytes } from '@/domain/bytes';
import { compressToTarget, savings, type Encoded } from '@/domain/compress';
import { findMediaItem, isSample } from '@/features/media/registry';
import {
  createEncoder,
  discardFile,
  isInCloud,
  measureSource,
  saveToPhotos,
  shareFile,
  verifyOutput,
  type EncoderSession,
  type Verification,
} from '@/services/exports/exporter';
import { gutter, radius, spacing, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

const QUALITIES = [
  { label: 'High', value: 0.9 },
  { label: 'Balanced', value: 0.75 },
  { label: 'Small', value: 0.6 },
] as const;
const MAX_EDGES = [null, 4096, 2048, 1080] as const;
const TARGETS = [500_000, 1_000_000, 2_000_000, 5_000_000] as const;

type Mode = 'quality' | 'target';
type Phase =
  | { kind: 'setup' }
  | { kind: 'working'; message: string }
  | {
      kind: 'result';
      output: Encoded;
      sourceBytes: number | null;
      verification: Verification;
    }
  | { kind: 'not-achievable'; smallest: Encoded; target: number }
  | { kind: 'saved'; output: Encoded }
  | { kind: 'error'; message: string };

/**
 * Make a smaller JPEG copy of one photo. Quality-first or target size.
 * Real bytes are measured after encoding, the copy is decoded again to
 * verify it, and it is saved to Photos only when the user asks, as a new
 * item. The original is never changed.
 */
export function ExportScreen({ id }: { id: string }) {
  const { colors } = useTheme();
  const item = findMediaItem(id);
  const [mode, setMode] = useState<Mode>('quality');
  const [quality, setQuality] = useState<number>(0.75);
  const [maxEdge, setMaxEdge] = useState<number | null>(2048);
  const [target, setTarget] = useState<number>(1_000_000);
  const [allowResize, setAllowResize] = useState(false);
  const [cloud, setCloud] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  const session = useRef<EncoderSession | null>(null);

  useEffect(() => {
    if (item && !isSample(item)) isInCloud(item.id).then(setCloud);
  }, [item]);

  // Temporary files never outlive the screen unless saved.
  useEffect(() => () => session.current?.cleanup(), []);

  if (!item || isSample(item) || item.kind !== 'photo') {
    return (
      <Shell>
        <EmptyState
          icon="photo"
          title="Can’t make a copy of this"
          message="Smaller copies work for photos from your library. Sample images and videos aren’t supported yet."
          action={<Button title="Close" variant="secondary" onPress={() => router.back()} />}
        />
      </Shell>
    );
  }

  const longEdge = Math.max(item.width, item.height);
  const edges = MAX_EDGES.filter((edge) => edge === null || edge < longEdge);

  const run = async () => {
    session.current?.cleanup();
    const encoder = createEncoder(item.id, item.width, item.height);
    session.current = encoder;
    try {
      setPhase({ kind: 'working', message: 'Reading the photo…' });
      const source = await measureSource(item.id);
      setPhase({ kind: 'working', message: 'Making a copy…' });

      let output: Encoded;
      if (mode === 'quality') {
        output = await encoder.encode(quality, maxEdge ?? longEdge);
      } else {
        const result = await compressToTarget({
          targetBytes: target,
          sourceLongEdge: longEdge,
          allowResize,
          encode: encoder.encode,
        });
        if (result.status === 'not-achievable') {
          encoder.cleanup(result.smallest.uri);
          setPhase({ kind: 'not-achievable', smallest: result.smallest, target });
          return;
        }
        output = result.best;
      }
      encoder.cleanup(output.uri);
      setPhase({ kind: 'working', message: 'Checking the copy…' });
      const verification = await verifyOutput(output);
      setPhase({ kind: 'result', output, sourceBytes: source.bytes, verification });
    } catch (error) {
      encoder.cleanup();
      haptics.error();
      setPhase({
        kind: 'error',
        message: error instanceof Error ? error.message : 'The copy couldn’t be made.',
      });
    }
  };

  const save = async (output: Encoded, sourceBytes: number | null) => {
    try {
      setPhase({ kind: 'working', message: 'Saving to Photos…' });
      const outputId = await saveToPhotos(output.uri);
      await insertDerivative({
        id: `copy-${Date.now()}`,
        source_asset_id: item.id,
        output_asset_id: outputId,
        recipe: JSON.stringify({
          mode,
          quality: output.quality,
          longEdge: output.longEdge,
          target: mode === 'target' ? target : null,
        }),
        format: 'jpeg',
        width: output.width,
        height: output.height,
        bytes: output.bytes,
        source_bytes: sourceBytes,
        created_at: Date.now(),
      }).catch(() => {});
      discardFile(output.uri);
      session.current = null;
      haptics.success();
      setPhase({ kind: 'saved', output });
    } catch (error) {
      haptics.error();
      setPhase({
        kind: 'error',
        message: error instanceof Error ? error.message : 'The copy couldn’t be saved to Photos.',
      });
    }
  };

  return (
    <Shell>
      <View style={styles.sourceRow}>
        <View style={[styles.sourceThumb, { backgroundColor: colors.mediaPlaceholder }]}>
          <MediaArtwork item={item} />
        </View>
        <View style={styles.flex}>
          <AppText variant="headline">{item.description}</AppText>
          <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
            {item.width} × {item.height}
          </AppText>
        </View>
      </View>

      {phase.kind === 'setup' ? (
        <View style={styles.section}>
          {cloud ? (
            <Note icon="info">
              This photo is stored in iCloud. Making a copy downloads the full photo, which uses
              your network.
            </Note>
          ) : null}

          <View style={styles.row} accessibilityRole="radiogroup">
            <Chip
              label="Quality"
              selected={mode === 'quality'}
              onPress={() => setMode('quality')}
            />
            <Chip
              label="Target size"
              selected={mode === 'target'}
              onPress={() => setMode('target')}
            />
          </View>

          {mode === 'quality' ? (
            <>
              <AppText variant="subhead" color="secondaryLabel">
                Quality
              </AppText>
              <View style={styles.wrap} accessibilityRole="radiogroup">
                {QUALITIES.map((option) => (
                  <Chip
                    key={option.label}
                    label={option.label}
                    selected={quality === option.value}
                    onPress={() => setQuality(option.value)}
                  />
                ))}
              </View>
              <AppText variant="subhead" color="secondaryLabel">
                Largest side
              </AppText>
              <View style={styles.wrap} accessibilityRole="radiogroup">
                {edges.map((edge) => (
                  <Chip
                    key={String(edge)}
                    label={edge === null ? `Full (${longEdge} px)` : `${edge} px`}
                    selected={maxEdge === edge}
                    onPress={() => setMaxEdge(edge)}
                  />
                ))}
              </View>
            </>
          ) : (
            <>
              <AppText variant="subhead" color="secondaryLabel">
                At most
              </AppText>
              <View style={styles.wrap} accessibilityRole="radiogroup">
                {TARGETS.map((bytes) => (
                  <Chip
                    key={bytes}
                    label={formatBytes(bytes)}
                    selected={target === bytes}
                    onPress={() => setTarget(bytes)}
                  />
                ))}
              </View>
              <View style={styles.switchRow}>
                <View style={styles.flex}>
                  <AppText variant="body">Allow smaller dimensions</AppText>
                  <AppText variant="footnote" color="secondaryLabel">
                    If quality alone can’t reach the size, shrink the photo (never below 1080 px).
                  </AppText>
                </View>
                <Switch
                  value={allowResize}
                  onValueChange={setAllowResize}
                  trackColor={{ true: colors.accentFill }}
                  accessibilityLabel="Allow smaller dimensions"
                />
              </View>
              <AppText variant="footnote" color="secondaryLabel">
                1 MB here means 1,000,000 bytes, the same way iPhone Storage counts.
              </AppText>
            </>
          )}

          <Note icon="lock">
            The copy is a JPEG. Your original stays exactly as it is. The copy may not keep the
            original’s location or camera details, and appears in Photos with today’s date.
          </Note>
          <Button title="Make copy" icon="photo" onPress={run} block />
        </View>
      ) : null}

      {phase.kind === 'working' ? (
        <View style={styles.working} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.accent} />
          <AppText variant="body" color="secondaryLabel">
            {phase.message}
          </AppText>
        </View>
      ) : null}

      {phase.kind === 'result' ? (
        <ResultView
          output={phase.output}
          sourceBytes={phase.sourceBytes}
          verification={phase.verification}
          onSave={() => save(phase.output, phase.sourceBytes)}
          onShare={() => shareFile(phase.output.uri).catch(() => {})}
          onStartOver={() => {
            session.current?.cleanup();
            setPhase({ kind: 'setup' });
          }}
        />
      ) : null}

      {phase.kind === 'not-achievable' ? (
        <Surface style={styles.section}>
          <AppText variant="headline">Can’t reach {formatBytes(phase.target)}</AppText>
          <AppText variant="body" color="secondaryLabel">
            The smallest copy at acceptable quality was {formatBytes(phase.smallest.bytes)} (
            {phase.smallest.width} × {phase.smallest.height}).{' '}
            {allowResize
              ? 'Try a larger target.'
              : 'Try allowing smaller dimensions, or a larger target.'}
          </AppText>
          <Button
            title="Change settings"
            variant="secondary"
            onPress={() => {
              discardFile(phase.smallest.uri);
              setPhase({ kind: 'setup' });
            }}
            block
          />
        </Surface>
      ) : null}

      {phase.kind === 'saved' ? (
        <Surface style={styles.section}>
          <View style={styles.row}>
            <Icon name="checkCircle" size={22} color={colors.success} />
            <AppText variant="headline">Saved to Photos</AppText>
          </View>
          <AppText variant="body" color="secondaryLabel" style={styles.numbers}>
            A new {phase.output.width} × {phase.output.height} JPEG (
            {formatBytes(phase.output.bytes)}) is in your library. Your original is unchanged.
            Keeping both uses more space until you decide what to keep.
          </AppText>
          <Button title="Done" onPress={() => router.back()} block />
        </Surface>
      ) : null}

      {phase.kind === 'error' ? (
        <Surface>
          <EmptyState
            icon="warning"
            tone="error"
            title="Couldn’t make the copy"
            message={phase.message}
            action={
              <Button
                title="Try again"
                variant="secondary"
                onPress={() => setPhase({ kind: 'setup' })}
              />
            }
          />
        </Surface>
      ) : null}
    </Shell>
  );
}

function ResultView({
  output,
  sourceBytes,
  verification,
  onSave,
  onShare,
  onStartOver,
}: {
  output: Encoded;
  sourceBytes: number | null;
  verification: Verification;
  onSave: () => void;
  onShare: () => void;
  onStartOver: () => void;
}) {
  const { colors } = useTheme();
  const verdict = savings(sourceBytes, output.bytes);
  return (
    <View style={styles.section}>
      <View
        style={[
          styles.preview,
          { aspectRatio: output.width / output.height, backgroundColor: colors.mediaPlaceholder },
        ]}
      >
        <Image
          source={{ uri: output.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          accessibilityLabel="Preview of the copy"
        />
      </View>
      <Surface style={styles.facts}>
        <AppText variant="title2" style={styles.numbers}>
          {formatBytes(output.bytes)}
        </AppText>
        <AppText variant="subhead" color="secondaryLabel" style={styles.numbers}>
          JPEG · {output.width} × {output.height} · quality {Math.round(output.quality * 100)}%
        </AppText>
        {verdict.kind === 'smaller' ? (
          <AppText variant="body" color="success" style={styles.numbers}>
            {verdict.percent}% smaller than the original ({formatBytes(sourceBytes ?? 0)})
          </AppText>
        ) : verdict.kind === 'not-smaller' ? (
          <AppText variant="body" color="warning">
            Not smaller than the original ({formatBytes(sourceBytes ?? 0)}). Saving it won’t save
            space.
          </AppText>
        ) : (
          <AppText variant="body" color="secondaryLabel">
            The original’s size couldn’t be measured.
          </AppText>
        )}
        <View style={styles.row}>
          <Icon
            name={verification.ok ? 'checkCircle' : 'warning'}
            size={16}
            color={verification.ok ? colors.success : colors.danger}
          />
          <AppText variant="footnote" color={verification.ok ? 'secondaryLabel' : 'danger'}>
            {verification.ok
              ? `Checked: the copy opens at ${output.width} × ${output.height}.`
              : verification.reason}
          </AppText>
        </View>
      </Surface>
      <Button
        title="Save to Photos"
        onPress={onSave}
        disabled={!verification.ok}
        block
        accessibilityHint="Adds the copy as a new photo; the original stays"
      />
      <View style={styles.row}>
        <Button title="Share" variant="secondary" onPress={onShare} style={styles.flex} />
        <Button title="Start over" variant="secondary" onPress={onStartOver} style={styles.flex} />
      </View>
    </View>
  );
}

function Note({ icon, children }: { icon: 'info' | 'lock'; children: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.note, { backgroundColor: colors.surfaceRaised }]}>
      <Icon name={icon} size={16} color={colors.secondaryLabel} />
      <AppText variant="footnote" color="secondaryLabel" style={styles.flex}>
        {children}
      </AppText>
    </View>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <AppText variant="title2">Smaller copy</AppText>
        <Button title="Close" variant="plain" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  content: { padding: gutter, gap: spacing.xl, paddingBottom: spacing.xxxl },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sourceThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.control,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  note: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.control,
  },
  working: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  preview: {
    width: '100%',
    borderRadius: radius.media,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  facts: { gap: spacing.xxs },
  numbers: { fontVariant: ['tabular-nums'] },
});
