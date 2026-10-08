import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { MediaArtwork } from '@/components/media-artwork';
import { StatusPill } from '@/components/status-pill';
import { Surface } from '@/components/surface';
import { insertDerivative } from '@/db/catalog-repo';
import { formatBytes } from '@/domain/bytes';
import { findMediaItem, isSample } from '@/features/media/registry';
import { discardFile, saveToPhotos } from '@/services/exports/exporter';
import { fileSize } from '@/services/media/file-fingerprint';
import {
  enhancePhoto,
  removeBackground,
  visualAnalysisAvailable,
  type ToolResult,
} from '@/services/media/visual-analysis';
import { gutter, radius, spacing, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

export type ToolKind = 'enhance' | 'red-eye' | 'cutout';

export const TOOLS: Record<
  ToolKind,
  { title: string; description: string; format: 'jpeg' | 'png' }
> = {
  enhance: {
    title: 'Enhance',
    description:
      'Apple’s automatic adjustments for exposure, color and contrast, like the magic wand in Photos.',
    format: 'jpeg',
  },
  'red-eye': {
    title: 'Fix red-eye',
    description: 'Finds red eyes from a flash and corrects them.',
    format: 'jpeg',
  },
  cutout: {
    title: 'Remove background',
    description:
      'Lifts the main subject off the background, like touching and holding a subject in Photos. Saved as a PNG with a transparent background.',
    format: 'png',
  },
};

export function isToolKind(value: unknown): value is ToolKind {
  return value === 'enhance' || value === 'red-eye' || value === 'cutout';
}

/** Lists the new photo with its source in Studio's copies. Best effort. */
async function recordToolOutput(
  tool: ToolKind,
  sourceId: string,
  outputId: string,
  result: ToolResult,
  bytes: number | null,
) {
  const now = Date.now();
  await insertDerivative({
    id: `${tool}-${now}`,
    source_asset_id: sourceId,
    output_asset_id: outputId,
    recipe: JSON.stringify({ tool, applied: result.applied ?? [] }),
    format: TOOLS[tool].format,
    width: result.width ?? 0,
    height: result.height ?? 0,
    bytes: bytes ?? 0,
    source_bytes: null,
    created_at: now,
  }).catch(() => {});
}

const RED_EYE_FILTER = 'CIRedEyeCorrection';

function problemText(result: ToolResult): string {
  switch (result.status) {
    case 'in-icloud':
      return 'This photo is only in iCloud. Open it in Photos so it downloads, then try again. MediaCare doesn’t download it for you.';
    case 'no-subject':
      return 'No clear subject was found to lift from the background.';
    case 'unsupported-os':
      return 'Removing backgrounds needs iOS 17 or later.';
    case 'missing':
      return 'This photo is no longer in your library.';
    default:
      return result.error ?? 'The tool couldn’t process this photo.';
  }
}

type Phase =
  | { step: 'idle' }
  | { step: 'working' }
  | { step: 'preview'; result: ToolResult & { uri: string }; bytes: number | null }
  | { step: 'nothing'; message: string }
  | { step: 'failed'; message: string }
  | { step: 'saved'; bytes: number | null };

/**
 * One photo tool (Phase 4): makes a preview, shows it beside the original,
 * and saves it to Photos as a new photo only when asked. The original is
 * never changed. Needs the MediaCare app build (not Expo Go).
 */
export function ToolScreen({ id, tool }: { id: string; tool: ToolKind }) {
  const { colors } = useTheme();
  const item = findMediaItem(id);
  const meta = TOOLS[tool];
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const pending = useRef<string | null>(null);

  // A preview that was never saved is a temporary file: remove it on leaving.
  useEffect(
    () => () => {
      if (pending.current) discardFile(pending.current);
    },
    [],
  );

  const run = async () => {
    if (!item) return;
    setPhase({ step: 'working' });
    try {
      const result =
        tool === 'cutout'
          ? await removeBackground(item.id)
          : await enhancePhoto(item.id, {
              enhance: tool === 'enhance',
              redEye: tool === 'red-eye',
            });
      if (result.status !== 'ok' || !result.uri) {
        setPhase(
          result.status === 'no-subject'
            ? { step: 'nothing', message: problemText(result) }
            : { step: 'failed', message: problemText(result) },
        );
        return;
      }
      if (tool === 'red-eye' && !(result.applied ?? []).includes(RED_EYE_FILTER)) {
        discardFile(result.uri);
        setPhase({ step: 'nothing', message: 'No red eyes were found in this photo.' });
        return;
      }
      pending.current = result.uri;
      setPhase({
        step: 'preview',
        result: { ...result, uri: result.uri },
        bytes: fileSize(result.uri),
      });
    } catch (error) {
      setPhase({
        step: 'failed',
        message: error instanceof Error ? error.message : 'The tool stopped unexpectedly.',
      });
    }
  };

  const save = async () => {
    if (phase.step !== 'preview' || !item) return;
    const { result, bytes } = phase;
    try {
      const outputId = await saveToPhotos(result.uri);
      await recordToolOutput(tool, item.id, outputId, result, bytes);
      discardFile(result.uri);
      pending.current = null;
      haptics.success();
      setPhase({ step: 'saved', bytes });
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
          icon="photo"
          title="Tools work on your own photos"
          message="Sample images can’t be edited."
        />
      );
    }
    if (!visualAnalysisAvailable()) {
      return (
        <EmptyState
          icon="enhance"
          title="Needs the MediaCare app"
          message="Photo tools use Apple’s on-device image processing, which isn’t available in Expo Go."
        />
      );
    }
    switch (phase.step) {
      case 'idle':
      case 'working':
        return (
          <>
            <Frame label="Original">
              <MediaArtwork item={item} fit="contain" />
            </Frame>
            <AppText variant="body" color="secondaryLabel">
              {meta.description} The result is saved as a new photo; this one stays as it is.
            </AppText>
            <Button
              title={phase.step === 'working' ? 'Working…' : 'Make preview'}
              loading={phase.step === 'working'}
              disabled={phase.step === 'working'}
              onPress={() => {
                run().catch(() => {});
              }}
              block
            />
          </>
        );
      case 'preview':
        return (
          <>
            <View style={styles.pair}>
              <Frame label="Original" style={styles.half}>
                <MediaArtwork item={item} fit="contain" />
              </Frame>
              <Frame
                label={meta.title}
                style={[
                  styles.half,
                  tool === 'cutout' && { backgroundColor: colors.surfaceRaised },
                ]}
              >
                <Image
                  source={{ uri: phase.result.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  accessibilityLabel={`${meta.title} preview`}
                />
              </Frame>
            </View>
            <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
              {phase.result.width} × {phase.result.height}
              {phase.bytes !== null ? ` · ${formatBytes(phase.bytes)}` : ''}. Saved as a new photo
              dated today, without location, like other copies.
            </AppText>
            <Button
              title="Save to Photos"
              icon="photo"
              onPress={() => save().catch(() => {})}
              block
            />
            <Button
              title="Discard"
              variant="plain"
              onPress={() => {
                discardFile(phase.result.uri);
                pending.current = null;
                setPhase({ step: 'idle' });
              }}
              block
            />
          </>
        );
      case 'nothing':
        return (
          <EmptyState
            icon="check"
            title="Nothing to change"
            message={phase.message}
            action={<Button title="Close" variant="secondary" onPress={() => router.back()} />}
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
      case 'saved':
        return (
          <EmptyState
            icon="check"
            title="Saved to Photos"
            message={`A new photo${phase.bytes !== null ? ` (${formatBytes(phase.bytes)})` : ''} is in your library. The original is unchanged.`}
            action={<Button title="Done" variant="secondary" onPress={() => router.back()} />}
          />
        );
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <AppText variant="title2" accessibilityRole="header">
          {meta.title}
        </AppText>
        <Button title="Close" variant="plain" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.pills}>
          <StatusPill label="On this iPhone" icon="lock" />
          <StatusPill label="Original kept" tone="success" icon="check" />
        </View>
        <Surface style={styles.surface}>{body()}</Surface>
      </ScrollView>
    </View>
  );
}

function Frame({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.frameWrap, style]}>
      <View style={[styles.frame, { backgroundColor: colors.mediaPlaceholder }, style]}>
        {children}
      </View>
      <AppText variant="caption" color="secondaryLabel">
        {label}
      </AppText>
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
  pair: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  frameWrap: { gap: spacing.xxs },
  frame: {
    aspectRatio: 3 / 4,
    borderRadius: radius.media,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  numbers: { fontVariant: ['tabular-nums'] },
});
