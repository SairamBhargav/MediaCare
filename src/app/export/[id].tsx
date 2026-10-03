import { useLocalSearchParams } from 'expo-router';

import { ExportScreen } from '@/screens/export';

export default function ExportRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExportScreen id={id ?? ''} />;
}
