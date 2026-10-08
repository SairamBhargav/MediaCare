import { useLocalSearchParams } from 'expo-router';

import { PassportScreen } from '@/screens/passport';

export default function PassportRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PassportScreen id={id ?? ''} />;
}
