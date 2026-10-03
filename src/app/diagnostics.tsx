import { Redirect } from 'expo-router';

import { DiagnosticsScreen } from '@/screens/diagnostics';

/** Development-only diagnostics. Release builds redirect home. */
export default function DiagnosticsRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DiagnosticsScreen />;
}
