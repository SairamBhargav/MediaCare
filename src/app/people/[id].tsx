import { Redirect, useLocalSearchParams } from 'expo-router';

import { PersonScreen } from '@/screens/person';

export default function PersonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const personId = Number(id);
  if (!Number.isInteger(personId)) return <Redirect href="/people" />;
  // Keyed so a merge that replaces the route starts fresh.
  return <PersonScreen key={personId} personId={personId} />;
}
