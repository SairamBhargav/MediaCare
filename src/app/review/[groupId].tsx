import { useLocalSearchParams } from 'expo-router';

import { ReviewScreen } from '@/screens/review';

export default function ReviewRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  return <ReviewScreen key={groupId} groupId={groupId ?? ''} />;
}
