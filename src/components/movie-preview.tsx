import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet } from 'react-native';

import { PreviewFrame } from './tool-shell';

/**
 * Plays a video with the system controls: a temporary result file, or a
 * Photos video by its ph:// id. Starts paused and never loops.
 */
export function MoviePreview({
  uri,
  aspectRatio,
  label,
  onPlayer,
}: {
  uri: string;
  aspectRatio: number;
  label?: string;
  onPlayer?: (player: ReturnType<typeof useVideoPlayer>) => void;
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    onPlayer?.(instance);
  });
  return (
    <PreviewFrame label={label} aspectRatio={Math.min(2, Math.max(0.5, aspectRatio))}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls
        accessibilityLabel={label ?? 'Video'}
      />
    </PreviewFrame>
  );
}
