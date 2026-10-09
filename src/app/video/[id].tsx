import { useLocalSearchParams } from 'expo-router';

import { VideoScreen } from '@/screens/video';

export default function VideoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VideoScreen id={id ?? ''} />;
}
