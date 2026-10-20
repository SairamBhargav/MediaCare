/**
 * Opt-in iCloud checking (ADR-0009). Pure rules for when a check may
 * download photos stored only in iCloud. The connection is read again
 * before every batch, so moving off Wi-Fi stops the downloads.
 *
 *  - Off unless the user turned on "Include photos in iCloud".
 *  - Wi-Fi only unless they also allowed mobile data. A personal hotspot
 *    counts as mobile data.
 *  - Never in Low Data Mode or Low Power Mode, which the user turned on
 *    to save exactly this.
 */
export type CloudBlock = 'switched-off' | 'offline' | 'mobile-data' | 'low-data' | 'low-power';

export type ConnectionState = {
  known: boolean;
  connected: boolean;
  expensive: boolean;
  constrained: boolean;
  lowPower: boolean;
};

/** Why downloading isn't allowed right now, or null when it is. */
export function cloudBlockReason(
  state: ConnectionState,
  { allowMobileData }: { allowMobileData: boolean },
): CloudBlock | null {
  if (!state.known || !state.connected) return 'offline';
  if (state.lowPower) return 'low-power';
  if (state.constrained) return 'low-data';
  if (state.expensive && !allowMobileData) return 'mobile-data';
  return null;
}

/** Shown under the iCloud count after a check couldn't download. */
export const CLOUD_BLOCK_TEXT: Record<CloudBlock, string> = {
  'switched-off': 'Not downloaded: “Include photos in iCloud” was turned off during the check.',
  offline: 'Not downloaded: no internet connection. Check again when you’re online.',
  'mobile-data': 'Not downloaded: you’re on mobile data. Check again on Wi-Fi.',
  'low-data': 'Not downloaded: Low Data Mode is on.',
  'low-power': 'Not downloaded: Low Power Mode is on. Check again when it’s off or charging.',
};

/** What a "What was checked" card says under its iCloud count, and whether to offer Settings. */
export type CloudNote = { text: string; offerSettings: boolean };

export function cloudNote({
  inCloud,
  available,
  enabled,
  allowMobileData,
  blocked,
}: {
  inCloud: number;
  /** This app build can download from iCloud. */
  available: boolean;
  enabled: boolean;
  allowMobileData: boolean;
  /** Why the last check stopped downloading early, if it did. */
  blocked: CloudBlock | undefined;
}): CloudNote | null {
  if (inCloud <= 0) return null;
  if (!available) {
    return { text: 'Update MediaCare to check photos stored in iCloud.', offerSettings: false };
  }
  if (!enabled) {
    return {
      text: 'To check these too, turn on “Include photos in iCloud” in Settings.',
      offerSettings: true,
    };
  }
  if (blocked) return { text: CLOUD_BLOCK_TEXT[blocked], offerSettings: false };
  return {
    text: allowMobileData
      ? 'They’re downloaded from iCloud when you check again.'
      : 'They’re downloaded from iCloud when you check again on Wi-Fi.',
    offerSettings: false,
  };
}
