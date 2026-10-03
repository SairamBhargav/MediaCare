import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import { View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

/**
 * One icon family for the whole app: SF Symbols on iOS, Material Symbols as
 * the Android/web fallback. Screens refer to icons by these semantic names,
 * never by raw symbol strings, so swapping a glyph is a one-line change.
 */
const ICONS = {
  clean: { ios: 'sparkles', android: 'auto_awesome' },
  library: { ios: 'photo.on.rectangle.angled', android: 'photo_library' },
  studio: { ios: 'wand.and.stars', android: 'auto_fix_high' },
  settings: { ios: 'gearshape', android: 'settings' },
  close: { ios: 'xmark', android: 'close' },
  check: { ios: 'checkmark', android: 'check' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  lock: { ios: 'lock.fill', android: 'lock' },
  shield: { ios: 'checkmark.shield', android: 'verified_user' },
  stack: { ios: 'square.stack.3d.up', android: 'stacks' },
  duplicate: { ios: 'plus.square.on.square', android: 'content_copy' },
  blur: { ios: 'camera.aperture', android: 'blur_on' },
  storage: { ios: 'internaldrive', android: 'storage' },
  info: { ios: 'info.circle', android: 'info' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning' },
  photo: { ios: 'photo', android: 'image' },
  star: { ios: 'star.fill', android: 'star' },
  sun: { ios: 'sun.horizon.fill', android: 'wb_twilight' },
  water: { ios: 'water.waves', android: 'waves' },
  leaf: { ios: 'leaf.fill', android: 'eco' },
  building: { ios: 'building.2.fill', android: 'location_city' },
  mountain: { ios: 'mountain.2.fill', android: 'landscape' },
  person: { ios: 'person.fill', android: 'person' },
  car: { ios: 'car.fill', android: 'directions_car' },
  flower: { ios: 'camera.macro', android: 'local_florist' },
  motion: { ios: 'circle.dotted.and.circle', android: 'animation' },
  swatch: { ios: 'paintpalette', android: 'palette' },
} as const satisfies Record<string, { ios: SFSymbol; android: string }>;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  color: ColorValue;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 22, color, weight = 'regular', style }: IconProps) {
  const glyph = ICONS[name];
  return (
    <SymbolView
      // The Android names are Material Symbols; expo-symbols types them narrowly.
      name={{ ios: glyph.ios, android: glyph.android as never, web: glyph.android as never }}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={[{ width: size, height: size }, style]}
      // Keeps layout stable on platforms without a symbol renderer.
      fallback={<View style={{ width: size, height: size }} />}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
