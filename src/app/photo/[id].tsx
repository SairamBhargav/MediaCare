import { useLocalSearchParams } from 'expo-router';

import { PhotoScreen } from '@/screens/photo';

export default function PhotoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PhotoScreen id={id ?? ''} />;
}
