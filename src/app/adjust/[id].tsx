import { useLocalSearchParams } from 'expo-router';

import { AdjustScreen } from '@/screens/adjust';

export default function AdjustRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AdjustScreen id={id ?? ''} />;
}
