import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { MoviePreview, type MoviePlayer } from '@/components/movie-preview';
import { MovieSteps } from '@/components/movie-steps';
import { ChoiceRow, ToolShell } from '@/components/tool-shell';
import { ValueSlider } from '@/components/value-slider';
import { formatBytes } from '@/domain/bytes';
import {
  TRIM_ONLY_PRESET,
  VIDEO_PRESETS,
  clampTrim,
  formatSeconds,
  isTrimmed,
  sizeChange,
} from '@/domain/video';
import { findMediaItem, isSample } from '@/features/media/registry';
import { useMovieTask } from '@/features/studio/use-movie-task';
import { saveCreation } from '@/services/exports/save-creation';
import { creationToolsAvailable, exportVideo, measureVideoSizes } from '@/services/media/creations';
import { photoUri } from '@/services/media/photo-library';
import { spacing } from '@/theme';
import { haptics } from '@/utils/haptics';

const ORIGINAL = 'original';

/**
 * Video (F22): watch it, trim the start or end, and/or make a smaller copy.
 * The result is a new video; the original stays in Photos unchanged. Sizes
 * shown are measured files, never estimates.
 */
export function VideoScreen({ id }: { id: string }) {
  const item = findMediaItem(id);
  const movie = useMovieTask();
  const player = useRef<MoviePlayer | null>(null);
  const duration = item && !isSample(item) ? (item.durationMs ?? 0) / 1000 : 0;
  const [range, setRange] = useState({ start: 0, end: duration });
  const [quality, setQuality] = useState<string>(VIDEO_PRESETS[1].id);
  const [sourceBytes, setSourceBytes] = useState<number | null>(null);

  useEffect(() => {
    if (!item || isSample(item) || item.kind !== 'video' || !creationToolsAvailable()) return;
    measureVideoSizes([item.id])
      .then(([size]) => setSourceBytes(size?.status === 'ok' ? (size.bytes ?? null) : null))
      .catch(() => {});
  }, [item]);

  if (!item || isSample(item) || item.kind !== 'video') {
    return (
      <ToolShell title="Video">
        <EmptyState
          icon="video"
          title="This video isn’t available"
          message="It may have been deleted or isn’t shared with MediaCare."
        />
      </ToolShell>
    );
  }

  const tools = creationToolsAvailable();
  const trimmed = isTrimmed(range, duration);
  const preset = VIDEO_PRESETS.find((option) => option.id === quality);
  const nativePreset = preset ? preset.native : TRIM_ONLY_PRESET;
  const unchanged = !trimmed && quality === ORIGINAL;

  const setStart = (value: number) =>
    setRange((current) => clampTrim(value, current.end, duration));
  const setEnd = (value: number) =>
    setRange((current) => clampTrim(current.start, value, duration));
  const here = () => player.current?.currentTime ?? 0;

  const make = () =>
    movie.start((onProgress) =>
      exportVideo(
        item.id,
        { preset: nativePreset, start: trimmed ? range.start : 0, end: trimmed ? range.end : 0 },
        onProgress,
      ),
    );

  const save = async () => {
    if (movie.phase.step !== 'ready') return;
    const { result } = movie.phase;
    try {
      await saveCreation({
        uri: result.uri,
        tool: 'video',
        sourceId: item.id,
        format: 'mp4',
        width: result.width ?? 0,
        height: result.height ?? 0,
        bytes: result.bytes ?? 0,
        sourceBytes,
        recipe: { preset: nativePreset, start: range.start, end: range.end, trimmed },
      });
      haptics.success();
      movie.markSaved(result.bytes ?? 0);
    } catch (error) {
      haptics.error();
      movie.fail(error instanceof Error ? error.message : 'Couldn’t save to Photos.');
    }
  };

  const change =
    movie.phase.step === 'ready' ? sizeChange(sourceBytes, movie.phase.result.bytes ?? 0) : null;
  const detail =
    change?.kind === 'smaller'
      ? `${change.percent}% smaller than the original`
      : change?.kind === 'not-smaller'
        ? 'Not smaller than the original'
        : undefined;

  return (
    <ToolShell title="Video">
      {movie.phase.step === 'idle' ? (
        <>
          <MoviePreview
            uri={photoUri(item.id)}
            aspectRatio={item.width / Math.max(1, item.height) || 16 / 9}
            label={sourceBytes !== null ? `Original · ${formatBytes(sourceBytes)}` : 'Original'}
            onPlayer={(instance) => {
              player.current = instance;
            }}
          />
          {!tools ? (
            <AppText variant="subhead" color="secondaryLabel">
              Trimming and smaller copies need the latest MediaCare app; Expo Go can only play the
              video.
            </AppText>
          ) : (
            <>
              <View style={styles.section}>
                <AppText variant="headline">Trim</AppText>
                <ValueSlider
                  label="Start"
                  value={range.start}
                  valueText={formatSeconds(range.start)}
                  min={0}
                  max={duration}
                  step={0.1}
                  onChange={setStart}
                />
                <ValueSlider
                  label="End"
                  value={range.end}
                  valueText={formatSeconds(range.end)}
                  min={0}
                  max={duration}
                  step={0.1}
                  onChange={setEnd}
                />
                <View style={styles.row}>
                  <Button
                    title="Start here"
                    variant="secondary"
                    onPress={() => setStart(here())}
                    accessibilityHint="Sets the start to where the video is paused"
                    style={styles.flex}
                  />
                  <Button
                    title="End here"
                    variant="secondary"
                    onPress={() => setEnd(here())}
                    accessibilityHint="Sets the end to where the video is paused"
                    style={styles.flex}
                  />
                </View>
                <AppText variant="footnote" color="secondaryLabel">
                  {trimmed
                    ? `Keeps ${formatSeconds(range.end - range.start)} of ${formatSeconds(duration)}.`
                    : 'Keeps the whole video.'}
                </AppText>
              </View>
              <ChoiceRow label="Quality">
                <Chip
                  label="Same as original"
                  selected={quality === ORIGINAL}
                  onPress={() => setQuality(ORIGINAL)}
                />
                {VIDEO_PRESETS.map((option) => (
                  <Chip
                    key={option.id}
                    label={option.label}
                    selected={quality === option.id}
                    onPress={() => setQuality(option.id)}
                  />
                ))}
              </ChoiceRow>
              <AppText variant="footnote" color="secondaryLabel">
                {preset
                  ? preset.detail
                  : 'No re-encoding: only the trim changes, so the copy keeps the original quality.'}{' '}
                The real size is shown before you save.
              </AppText>
              <Button
                title={trimmed && quality === ORIGINAL ? 'Make trimmed copy' : 'Make copy'}
                icon={trimmed ? 'trim' : 'compress'}
                disabled={unchanged}
                onPress={make}
                block
              />
              {unchanged ? (
                <AppText variant="footnote" color="secondaryLabel">
                  Trim the video or choose a smaller quality first.
                </AppText>
              ) : null}
            </>
          )}
        </>
      ) : (
        <View style={styles.section}>
          <MovieSteps
            phase={movie.phase}
            workingLabel={trimmed ? 'Trimming your video' : 'Making a smaller copy'}
            detail={detail}
            onCancel={movie.cancel}
            onSave={save}
            onDiscard={movie.discard}
            onRetry={movie.discard}
          />
        </View>
      )}
    </ToolShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
});
