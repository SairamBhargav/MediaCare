import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { insertDerivative } from '@/db/catalog-repo';
import { formatBytes } from '@/domain/bytes';
import { US_PASSPORT, isFrame, passportFrame, type PassportFrame } from '@/domain/passport';
import { VISUAL_THRESHOLDS } from '@/domain/visual-findings';
import { findMediaItem, isSample } from '@/features/media/registry';
import { discardFile, saveToPhotos } from '@/services/exports/exporter';
import { findFaces, renderPassport } from '@/services/media/passport';
import { visualAnalysisAvailable } from '@/services/media/visual-analysis';
import { gutter, radius, spacing, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

type Preview = { uri: string; width: number; height: number; bytes: number; frame: PassportFrame };

type Phase =
  | { step: 'idle' }
  | { step: 'working' }
  | { step: 'refused'; problems: string[] }
  | { step: 'preview'; preview: Preview; warnings: string[] }
  | { step: 'saved' }
  | { step: 'failed'; message: string };

/** Records the new photo with its source in Studio's copies. Best effort. */
async function recordPassport(sourceId: string, outputId: string, preview: Preview) {
  const now = Date.now();
  await insertDerivative({
    id: `passport-${now}`,
    source_asset_id: sourceId,
    output_asset_id: outputId,
    recipe: JSON.stringify({ tool: 'passport', rules: US_PASSPORT.id, crop: preview.frame.crop }),
    format: 'jpeg',
    width: preview.width,
    height: preview.height,
    bytes: preview.bytes,
    source_bytes: null,
    created_at: now,
  }).catch(() => {});
}

/**
 * Passport photo (Phase 5): frames one face to the official U.S. head-size
 * range and makes a square digital photo. Geometry only (crop and scale):
 * no retouching, no new background. The person checks what the app can't,
 * and the app never promises the photo will be accepted.
 */
export function PassportScreen({ id }: { id: string }) {
  const { colors } = useTheme();
  const item = findMediaItem(id);
  const rules = US_PASSPORT;
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const pending = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (pending.current) discardFile(pending.current);
    },
    [],
  );

  const make = async () => {
    if (!item || isSample(item)) return;
    setPhase({ step: 'working' });
    try {
      const found = await findFaces(item.id);
      if (found.status !== 'ok') {
        setPhase({
          step: 'failed',
          message:
            found.status === 'in-icloud'
              ? 'This photo is only in iCloud. Open it in Photos so it downloads, then try again.'
              : 'The photo couldn’t be read.',
        });
        return;
      }
      const frame = passportFrame(item.width, item.height, found.faces, rules);
      if (!isFrame(frame) || frame.problems.length > 0) {
        setPhase({ step: 'refused', problems: frame.problems });
        return;
      }
      const warnings: string[] = [];
      const eyes = found.faces[0].eyesOpen;
      if (eyes >= 0 && eyes < VISUAL_THRESHOLDS.eyeClosed) {
        warnings.push('The eyes may be closed. Both eyes must be open.');
      }
      const rendered = await renderPassport(item.id, frame);
      pending.current = rendered.uri;
      setPhase({ step: 'preview', preview: { ...rendered, frame }, warnings });
    } catch (error) {
      setPhase({
        step: 'failed',
        message: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  };

  const save = async () => {
    if (phase.step !== 'preview' || !item) return;
    try {
      const outputId = await saveToPhotos(phase.preview.uri);
      await recordPassport(item.id, outputId, phase.preview);
      discardFile(phase.preview.uri);
      pending.current = null;
      haptics.success();
      setPhase({ step: 'saved' });
    } catch (error) {
      haptics.error();
      setPhase({
        step: 'failed',
        message: error instanceof Error ? error.message : 'Couldn’t save to Photos.',
      });
    }
  };

  const body = () => {
    if (!item || isSample(item)) {
      return (
        <EmptyState
          icon="person"
          title="Use one of your own photos"
          message="Sample images can’t be used."
        />
      );
    }
    if (!visualAnalysisAvailable()) {
      return (
        <EmptyState
          icon="person"
          title="Needs the MediaCare app"
          message="Finding the face uses Apple’s on-device analysis, which isn’t available in Expo Go."
        />
      );
    }
    switch (phase.step) {
      case 'idle':
      case 'working':
        return (
          <>
            <AppText variant="body" color="secondaryLabel">
              Frames the face to the official head size and makes a square {rules.maxPx}×
              {rules.maxPx} px photo. It only crops and scales: nothing is retouched and the
              background isn’t changed.
            </AppText>
            <Button
              title={phase.step === 'working' ? 'Working…' : 'Make passport photo'}
              loading={phase.step === 'working'}
              disabled={phase.step === 'working'}
              onPress={() => {
                make().catch(() => {});
              }}
              block
            />
          </>
        );
      case 'refused':
        return (
          <EmptyState
            icon="warning"
            title="This photo won’t work"
            message={phase.problems.join(' ')}
            action={<Button title="Close" variant="secondary" onPress={() => router.back()} />}
          />
        );
      case 'preview': {
        const { preview, warnings } = phase;
        const share = Math.round(preview.frame.headShare * 100);
        return (
          <>
            <View style={[styles.photo, { backgroundColor: colors.mediaPlaceholder }]}>
              <Image
                source={{ uri: preview.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                accessibilityLabel="Passport photo preview"
              />
              {/* Estimated top of head and chin, to check by eye. */}
              <View
                pointerEvents="none"
                style={[
                  styles.guide,
                  { top: `${preview.frame.headTop * 100}%`, borderColor: colors.accent },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.guide,
                  { top: `${preview.frame.chin * 100}%`, borderColor: colors.accent },
                ]}
              />
            </View>
            <AppText variant="footnote" color="secondaryLabel">
              The lines mark where MediaCare estimates the top of the head and the chin (about{' '}
              {share}% of the height; {Math.round(rules.headMin * 100)}–
              {Math.round(rules.headMax * 100)}% is allowed). Check they match the real head top and
              chin.
            </AppText>
            {warnings.map((warning) => (
              <View key={warning} style={styles.row}>
                <Icon name="warning" size={16} color={colors.warning} />
                <AppText variant="subhead" color="warning" style={styles.flex}>
                  {warning}
                </AppText>
              </View>
            ))}
            <View style={styles.list}>
              <AppText variant="headline">Check these yourself</AppText>
              {rules.checklist.map((line) => (
                <View key={line} style={styles.row}>
                  <Icon name="check" size={14} color={colors.secondaryLabel} />
                  <AppText variant="subhead" color="secondaryLabel" style={styles.flex}>
                    {line}
                  </AppText>
                </View>
              ))}
            </View>
            <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
              {preview.width}×{preview.height} px · {formatBytes(preview.bytes)}. MediaCare can’t
              guarantee the photo will be accepted.
            </AppText>
            <Button
              title="Save to Photos"
              icon="photo"
              onPress={() => save().catch(() => {})}
              block
            />
            <Button
              title="Official photo rules"
              variant="plain"
              onPress={() => {
                Linking.openURL(rules.source).catch(() => {});
              }}
              block
            />
          </>
        );
      }
      case 'saved':
        return (
          <EmptyState
            icon="check"
            title="Saved to Photos"
            message="A new passport-sized photo is in your library. The original is unchanged."
            action={<Button title="Done" variant="secondary" onPress={() => router.back()} />}
          />
        );
      case 'failed':
        return (
          <EmptyState
            icon="warning"
            tone="error"
            title="Couldn’t finish"
            message={phase.message}
            action={
              <Button
                title="Try again"
                variant="secondary"
                onPress={() => setPhase({ step: 'idle' })}
              />
            }
          />
        );
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <AppText variant="title2" accessibilityRole="header">
          Passport photo
        </AppText>
        <Button title="Close" variant="plain" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.pills}>
          <StatusPill label={rules.label} icon="person" />
          <StatusPill label={`Rules checked ${rules.reviewed}`} />
        </View>
        <Surface style={styles.surface}>{body()}</Surface>
      </ScrollView>
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
    paddingBottom: spacing.sm,
  },
  content: { padding: gutter, gap: spacing.md, paddingBottom: spacing.xxxl },
  pills: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  surface: { gap: spacing.md },
  photo: {
    aspectRatio: 1,
    borderRadius: radius.media,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  guide: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: 'dashed',
  },
  list: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  numbers: { fontVariant: ['tabular-nums'] },
});
