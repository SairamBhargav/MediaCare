import { Redirect, useLocalSearchParams } from 'expo-router';

import { CategoryScreen, isFindingCategory } from '@/screens/category';

export default function CategoryRoute() {
  const { category } = useLocalSearchParams<{ category: string }>();
  if (!isFindingCategory(category)) return <Redirect href="/" />;
  // Keyed so switching category starts with a fresh selection.
  return <CategoryScreen key={category} category={category} />;
}
