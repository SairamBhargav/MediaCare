import { useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { registerAnchor } from '@/features/tour/anchors';
import { useTour } from '@/state/tour';

/**
 * Marks a real control for the guided tour to point at. Layout-neutral (a
 * plain wrapper); a tap inside it tells the tour, which moves on when the
 * current step says "tap this".
 */
export function TourAnchor({
  id,
  children,
  style,
}: {
  id: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<View>(null);

  useEffect(
    () =>
      registerAnchor(
        id,
        () =>
          new Promise((resolve) => {
            const node = ref.current;
            if (!node) {
              resolve(null);
              return;
            }
            node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
          }),
      ),
    [id],
  );

  return (
    <View
      ref={ref}
      collapsable={false}
      style={style}
      onTouchEnd={() => useTour.getState().tapped(id)}
    >
      {children}
    </View>
  );
}
