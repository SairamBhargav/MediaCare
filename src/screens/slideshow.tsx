import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { MediaTile } from '@/components/media-tile';
import { MovieSteps } from '@/components/movie-steps';
import { ChoiceRow, ToolShell } from '@/components/tool-shell';
import { formatDuration } from '@/domain/media';
import {
  MIN_SLIDESHOW_PHOTOS,
  SLIDESHOW_PACES,
  SLIDESHOW_SHAPES,
  slideshowSeconds,
} from '@/domain/video';
import { findMediaItem } from '@/features/media/registry';
import { useMovieTask } from '@/features/studio/use-movie-task';
import { saveCreation } from '@/services/exports/save-creation';
import { creationToolsAvailable, makeSlideshow } from '@/services/media/creations';
import { useCreationDraft } from '@/state/creation-draft';
import { spacing } from '@/theme';
import { haptics } from '@/utils/haptics';

const TRANSITION_SECONDS = 0.6;

/**
 * Slideshow (F20): photos become a short H.264 video, each photo shown
 * whole over a soft blurred fill, with fades and an optional slow zoom.
 * No music: there's no licensed audio in the app.
 */
export function SlideshowScreen() {
  const ids = useCreationDraft((state) => state.ids);
  const [shapeId, setShapeId] = useState(SLIDESHOW_SHAPES[0].id);
  const [paceId, setPaceId] = useState('normal');
  const [zoom, setZoom] = useState(true);
  const movie = useMovieTask();

  const shape = SLIDESHOW_SHAPES.find((option) => option.id === shapeId) ?? SLIDESHOW_SHAPES[0];
  const pace = SLIDESHOW_PACES.find((option) => option.id === paceId) ?? SLIDESHOW_PACES[1];

  if (ids.length < MIN_SLIDESHOW_PHOTOS) {
    return (
      <ToolShell title="Slideshow">
        <EmptyState
          icon="slideshow"
          title="Choose some photos"
          message="Start a slideshow from Studio and pick the photos you want, in order."
          action={<Button title="Close" variant="secondary" onPress={() => router.back()} />}
        />
      </ToolShell>
    );
  }
  if (!creationToolsAvailable()) {
    return (
      <ToolShell title="Slideshow">
        <EmptyState
          icon="slideshow"
          title="Needs the latest MediaCare app"
          message="Making videos uses Apple’s on-device video tools, which aren’t available in Expo Go or older builds of the app."
        />
      </ToolShell>
    );
  }

  const make = () =>
    movie.start((onProgress) =>
      makeSlideshow(
        {
          ids: [...ids],
          width: shape.width,
          height: shape.height,
          secondsPerPhoto: pace.seconds,
          transitionSeconds: TRANSITION_SECONDS,
          gentleZoom: zoom,
        },
        onProgress,
      ),
    );

  const save = async () => {
    if (movie.phase.step !== 'ready') return;
    const { result } = movie.phase;
    try {
      await saveCreation({
        uri: result.uri,
        tool: 'slideshow',
        sourceId: ids[0],
        format: 'mp4',
        width: result.width ?? shape.width,
        height: result.height ?? shape.height,
        bytes: result.bytes ?? 0,
        recipe: { shape: shape.id, seconds: pace.seconds, zoom, sources: ids },
      });
      haptics.success();
      movie.markSaved(result.bytes ?? 0);
    } catch (error) {
      haptics.error();
      movie.fail(error instanceof Error ? error.message : 'Couldn’t save to Photos.');
    }
  };

  const missing = movie.phase.step === 'ready' ? (movie.phase.result.missing?.length ?? 0) : 0;

  return (
    <ToolShell title="Slideshow">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {ids.map((id, index) => {
          const item = findMediaItem(id);
          return item ? (
            <MediaTile key={`${id}-${index}`} asset={item} appearance="card" style={styles.thumb} />
          ) : null;
        })}
      </ScrollView>

      {movie.phase.step === 'idle' ? (
        <>
          <ChoiceRow label="Shape">
            {SLIDESHOW_SHAPES.map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                selected={option.id === shape.id}
                onPress={() => setShapeId(option.id)}
              />
            ))}
          </ChoiceRow>
          <ChoiceRow label="Pace">
            {SLIDESHOW_PACES.map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                selected={option.id === pace.id}
                onPress={() => setPaceId(option.id)}
              />
            ))}
          </ChoiceRow>
          <ChoiceRow label="Slow zoom">
            <Chip label="On" selected={zoom} onPress={() => setZoom(true)} />
            <Chip label="Off" selected={!zoom} onPress={() => setZoom(false)} />
          </ChoiceRow>
          <AppText variant="subhead" color="secondaryLabel">
            {ids.length} photos, about{' '}
            {formatDuration(slideshowSeconds(ids.length, pace.seconds) * 1000)} long, no music.
            Photos only in iCloud are skipped and shown as black, so open them in Photos first.
          </AppText>
          <Button title="Make slideshow" icon="slideshow" onPress={make} block />
        </>
      ) : (
        <View style={styles.steps}>
          <MovieSteps
            phase={movie.phase}
            workingLabel="Making your slideshow"
            detail={
              missing > 0
                ? `${missing} ${missing === 1 ? 'photo wasn’t' : 'photos weren’t'} on this iPhone and show as black`
                : undefined
            }
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
  strip: { gap: spacing.xs },
  thumb: { width: 72 },
  steps: { gap: spacing.md },
});
