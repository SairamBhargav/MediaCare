import { requireOptionalNativeModule } from 'expo';
import { StyleSheet } from 'react-native';

import { spacing } from '@/theme';

import { AppText } from './app-text';

import { PreviewFrame } from './tool-shell';

type ExpoVideo = typeof import('expo-video');
export type MoviePlayer = import('expo-video').VideoPlayer;

/**
 * expo-video throws on import when its native code isn't in the binary
 * (app builds made before it was added). Load it only when present, so an
 * older build still starts and simply can't play video.
 */
const video: ExpoVideo | null =
  requireOptionalNativeModule('ExpoVideo') !== null
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-video') as ExpoVideo)
    : null;

export function videoPlaybackAvailable(): boolean {
  return video !== null;
}

type MoviePreviewProps = {
  uri: string;
  aspectRatio: number;
  label?: string;
  onPlayer?: (player: MoviePlayer) => void;
};

/**
 * Plays a video with the system controls: a temporary result file, or a
 * Photos video by its ph:// id. Starts paused and never loops.
 */
export function MoviePreview(props: MoviePreviewProps) {
  const ratio = Math.min(2, Math.max(0.5, props.aspectRatio));
  if (!video) {
    return (
      <PreviewFrame label={props.label} aspectRatio={ratio}>
        <AppText variant="subhead" color="secondaryLabel" style={styles.missing}>
          Playing videos needs the latest MediaCare app.
        </AppText>
      </PreviewFrame>
    );
  }
  return <Player {...props} lib={video} ratio={ratio} />;
}

function Player({
  uri,
  label,
  onPlayer,
  lib,
  ratio,
}: MoviePreviewProps & { lib: ExpoVideo; ratio: number }) {
  const player = lib.useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    onPlayer?.(instance);
  });
  return (
    <PreviewFrame label={label} aspectRatio={ratio}>
      <lib.VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls
        accessibilityLabel={label ?? 'Video'}
      />
    </PreviewFrame>
  );
}

const styles = StyleSheet.create({
  missing: { margin: 'auto', padding: spacing.md, textAlign: 'center' },
});
