import { useLocalSearchParams } from 'expo-router';

import { AccessScreen } from '@/screens/access';

export default function AccessRoute() {
  const { then } = useLocalSearchParams<{ then?: string }>();
  return <AccessScreen then={then} />;
}
