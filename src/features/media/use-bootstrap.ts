import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useCatalog } from '@/state/catalog';
import { useCleanSession } from '@/state/clean-session';

/**
 * Loads the catalog once at launch and restores the last real results, and
 * re-checks photo access whenever the app returns to the foreground (access
 * can change in iOS Settings while MediaCare is in the background).
 */
export function useBootstrap() {
  useEffect(() => {
    let cancelled = false;
    useCatalog
      .getState()
      .load()
      .then(() => {
        if (cancelled) return;
        const session = useCleanSession.getState();
        if (session.state.status === 'not-scanned' && useCatalog.getState().items.length > 0) {
          session.showCatalogResults();
        }
      })
      .catch(() => {
        // The catalog is a cache; without it the app still works from a fresh scan.
      });

    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        useCatalog
          .getState()
          .refreshAccess()
          .catch(() => {});
      }
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
}
