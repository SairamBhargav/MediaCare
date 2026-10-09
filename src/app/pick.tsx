import { Redirect, useLocalSearchParams } from 'expo-router';

import { isStudioToolId } from '@/features/studio/tools';
import { PickScreen } from '@/screens/pick';

export default function PickRoute() {
  const { tool } = useLocalSearchParams<{ tool?: string }>();
  if (!isStudioToolId(tool)) return <Redirect href="/studio" />;
  return <PickScreen tool={tool} />;
}
