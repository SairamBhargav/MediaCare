import { useEffect, useRef, useState } from 'react';

import { discardFile } from '@/services/exports/exporter';
import type { MovieResult, MovieTask } from '@/services/media/creations';

export type MoviePhase =
  | { step: 'idle' }
  | { step: 'working'; fraction: number }
  | { step: 'ready'; result: MovieResult & { uri: string } }
  | { step: 'failed'; message: string }
  | { step: 'saved'; bytes: number };

function problem(result: MovieResult): string {
  switch (result.status) {
    case 'in-icloud':
      return 'This is only in iCloud. Open it in Photos so it downloads, then try again. MediaCare doesn’t download it for you.';
    case 'missing':
      return 'It’s no longer in your library.';
    default:
      return result.error ?? 'The video couldn’t be made.';
  }
}

/**
 * Runs one native movie task (video copy, trim or slideshow) with progress
 * and cancel, keeps the unsaved result as a temporary file, and removes it
 * when discarded or when the screen closes.
 */
export function useMovieTask() {
  const [phase, setPhase] = useState<MoviePhase>({ step: 'idle' });
  const task = useRef<MovieTask | null>(null);
  const pending = useRef<string | null>(null);

  useEffect(
    () => () => {
      task.current?.cancel();
      if (pending.current) discardFile(pending.current);
    },
    [],
  );

  const start = (begin: (onProgress: (fraction: number) => void) => MovieTask) => {
    setPhase({ step: 'working', fraction: 0 });
    try {
      const running = begin((fraction) => setPhase({ step: 'working', fraction }));
      task.current = running;
      running.result
        .then((result) => {
          task.current = null;
          if (result.status === 'cancelled') {
            setPhase({ step: 'idle' });
          } else if (result.status === 'ok' && result.uri) {
            pending.current = result.uri;
            setPhase({ step: 'ready', result: { ...result, uri: result.uri } });
          } else {
            setPhase({ step: 'failed', message: problem(result) });
          }
        })
        .catch((error: unknown) => {
          task.current = null;
          setPhase({
            step: 'failed',
            message: error instanceof Error ? error.message : 'Something went wrong.',
          });
        });
    } catch (error) {
      setPhase({
        step: 'failed',
        message: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  };

  return {
    phase,
    start,
    cancel: () => task.current?.cancel(),
    discard: () => {
      if (pending.current) discardFile(pending.current);
      pending.current = null;
      setPhase({ step: 'idle' });
    },
    /** The temporary file was saved (and removed by the saver). */
    markSaved: (bytes: number) => {
      pending.current = null;
      setPhase({ step: 'saved', bytes });
    },
    fail: (message: string) => setPhase({ step: 'failed', message }),
  };
}
