import { Redirect } from 'expo-router';

import { GalleryScreen } from '@/screens/gallery';

/** Development-only component and motion gallery. Release builds redirect home. */
export default function GalleryRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <GalleryScreen />;
}
