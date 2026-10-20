import MediaAnalysis from '../../../modules/media-analysis/src/MediaAnalysisModule';

/**
 * Keeps a check the user started running after they leave the app, as an
 * iOS 26 continued-processing task (ADR-0010). iOS shows it as a Live
 * Activity with progress and a stop button. Elsewhere (Expo Go, older
 * builds, older iOS) every call is a no-op and checks run while the app is
 * open, as before.
 */
export function backgroundRunAvailable(): boolean {
  return typeof MediaAnalysis?.beginBackgroundRun === 'function';
}

/** True if iOS accepted the run; false means the check only runs while the app is open. */
export function beginBackgroundRun(title: string, subtitle: string): boolean {
  if (!MediaAnalysis?.beginBackgroundRun) return false;
  try {
    return MediaAnalysis.beginBackgroundRun(title, subtitle) === 'started';
  } catch {
    return false;
  }
}

export function updateBackgroundRun(done: number, total: number, subtitle: string): void {
  try {
    MediaAnalysis?.updateBackgroundRun?.(done, total, subtitle);
  } catch {
    // Progress in the Live Activity is a convenience; the check carries on.
  }
}

export function endBackgroundRun(success: boolean): void {
  try {
    MediaAnalysis?.endBackgroundRun?.(success);
  } catch {
    // Nothing to end.
  }
}

/** iOS stopped the run (from the Live Activity, or out of time). Returns an unsubscribe. */
export function onBackgroundRunExpired(listener: () => void): () => void {
  if (!MediaAnalysis?.backgroundVersion) return () => {};
  const subscription = MediaAnalysis.addListener('onBackgroundExpired', listener);
  return () => subscription.remove();
}

/** Asks for notification permission; iOS shows its prompt only the first time. */
export async function requestNotifications(): Promise<boolean> {
  try {
    return (await MediaAnalysis?.requestNotifications?.()) ?? false;
  } catch {
    return false;
  }
}

/** A local notification, shown only when MediaCare isn't on screen. */
export function notifyIfInBackground(title: string, body: string): void {
  try {
    MediaAnalysis?.notifyIfInBackground?.(title, body);
  } catch {
    // Not shown; the result is still on the Clean tab.
  }
}
