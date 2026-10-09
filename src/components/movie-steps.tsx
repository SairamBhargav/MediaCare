import { router } from 'expo-router';
import { useState } from 'react';

import { formatBytes } from '@/domain/bytes';
import { formatDuration } from '@/domain/media';
import type { MoviePhase } from '@/features/studio/use-movie-task';
import { shareFile } from '@/services/exports/exporter';

import { AppText } from './app-text';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { MoviePreview } from './movie-preview';
import { ProgressBar } from './progress-bar';

/**
 * The shared middle and end of a movie tool: progress with Stop, then the
 * result to watch, save, share or discard. Returns null while idle so the
 * tool can show its own settings.
 */
export function MovieSteps({
  phase,
  workingLabel,
  detail,
  onCancel,
  onSave,
  onDiscard,
  onRetry,
}: {
  phase: MoviePhase;
  workingLabel: string;
  /** Extra line under the result, e.g. how it compares with the original. */
  detail?: string;
  onCancel: () => void;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  onRetry: () => void;
}) {
  const [saving, setSaving] = useState(false);

  switch (phase.step) {
    case 'idle':
      return null;
    case 'working': {
      const percent = Math.round(phase.fraction * 100);
      return (
        <>
          <AppText variant="headline">{workingLabel}</AppText>
          <ProgressBar
            fraction={phase.fraction}
            accessibilityLabel={workingLabel}
            valueText={`${percent}%`}
          />
          <AppText variant="footnote" color="secondaryLabel">
            {percent}% done. Keep MediaCare open until it finishes.
          </AppText>
          <Button title="Stop" icon="stop" variant="secondary" onPress={onCancel} block />
        </>
      );
    }
    case 'ready': {
      const { result } = phase;
      const ratio = (result.width ?? 16) / Math.max(1, result.height ?? 9);
      return (
        <>
          <MoviePreview uri={result.uri} aspectRatio={ratio} label="Result" />
          <AppText variant="footnote" color="secondaryLabel">
            {[
              result.width && result.height ? `${result.width} × ${result.height}` : null,
              result.duration ? formatDuration(result.duration * 1000) : null,
              result.bytes ? formatBytes(result.bytes) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            {detail ? `. ${detail}` : ''}
          </AppText>
          <Button
            title={saving ? 'Saving…' : 'Save to Photos'}
            icon="photo"
            loading={saving}
            disabled={saving}
            onPress={() => {
              setSaving(true);
              onSave().finally(() => setSaving(false));
            }}
            block
          />
          <Button
            title="Share"
            icon="share"
            variant="secondary"
            onPress={() => {
              shareFile(result.uri, 'mp4').catch(() => {});
            }}
            block
          />
          <Button title="Discard" variant="plain" onPress={onDiscard} block />
        </>
      );
    }
    case 'failed':
      return (
        <EmptyState
          icon="warning"
          tone="error"
          title="Couldn’t finish"
          message={phase.message}
          action={<Button title="Try again" variant="secondary" onPress={onRetry} />}
        />
      );
    case 'saved':
      return (
        <EmptyState
          icon="check"
          title="Saved to Photos"
          message={`A new video (${formatBytes(phase.bytes)}) is in your library. Your originals are unchanged.`}
          action={<Button title="Done" variant="secondary" onPress={() => router.back()} />}
        />
      );
  }
}
