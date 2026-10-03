import { router } from 'expo-router';

import { useCatalog, type CatalogState } from '@/state/catalog';
import { useCleanSession } from '@/state/clean-session';

/**
 * True when iOS hasn't asked about photo access yet, so asking now would
 * show the system prompt. MediaCare explains first (P1-ONB-002).
 */
export function needsAccessExplainer(access: CatalogState['access']): boolean {
  return access === 'undetermined' || access === 'unknown';
}

/**
 * "Scan my library" from anywhere: if iOS hasn't asked yet, show the
 * explanation screen (which asks and then scans); otherwise scan now.
 * Denied access never re-prompts; the screens offer Open Settings.
 */
export function scanLibrary() {
  if (needsAccessExplainer(useCatalog.getState().access)) {
    router.push({ pathname: '/access', params: { then: 'scan' } });
    return;
  }
  useCleanSession
    .getState()
    .startLibraryScan()
    .catch(() => {});
}
