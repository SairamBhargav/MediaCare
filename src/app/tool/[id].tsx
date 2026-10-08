import { Redirect, useLocalSearchParams } from 'expo-router';

import { ToolScreen, isToolKind } from '@/screens/tool';

export default function ToolRoute() {
  const { id, tool } = useLocalSearchParams<{ id: string; tool?: string }>();
  if (!isToolKind(tool)) return <Redirect href="/" />;
  return <ToolScreen id={id ?? ''} tool={tool} />;
}
