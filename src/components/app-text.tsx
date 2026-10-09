import { Text, type TextProps } from 'react-native';

import { usePreferences } from '@/state/preferences';
import {
  LARGER_TEXT_SCALE,
  typography,
  useTheme,
  type ColorToken,
  type TypographyVariant,
} from '@/theme';

type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  /** A palette token. Defaults to `label`. */
  color?: ColorToken;
};

const scaled = Object.fromEntries(
  Object.entries(typography).map(([variant, style]) => [
    variant,
    {
      ...style,
      fontSize: Math.round(style.fontSize * LARGER_TEXT_SCALE),
      lineHeight: Math.round(style.lineHeight * LARGER_TEXT_SCALE),
    },
  ]),
) as unknown as typeof typography;

/**
 * The only way screens render text. Font sizes come from the type ramp, colors
 * from the palette, and Dynamic Type stays enabled. "Bigger text" in Settings
 * steps the whole ramp up on top of the iOS text size.
 */
export function AppText({ variant = 'body', color = 'label', style, ...props }: AppTextProps) {
  const { colors } = useTheme();
  const larger = usePreferences((preferences) => preferences.largerText);
  const isHeading = variant === 'largeTitle' || variant === 'title1' || variant === 'title2';
  return (
    <Text
      accessibilityRole={isHeading ? 'header' : props.accessibilityRole}
      style={[(larger ? scaled : typography)[variant], { color: colors[color] }, style]}
      {...props}
    />
  );
}
