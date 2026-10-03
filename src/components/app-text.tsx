import { Text, type TextProps } from 'react-native';

import { typography, useTheme, type ColorToken, type TypographyVariant } from '@/theme';

type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  /** A palette token. Defaults to `label`. */
  color?: ColorToken;
};

/**
 * The only way screens render text. Font sizes come from the type ramp, colors
 * from the palette, and Dynamic Type stays enabled.
 */
export function AppText({ variant = 'body', color = 'label', style, ...props }: AppTextProps) {
  const { colors } = useTheme();
  const isHeading = variant === 'largeTitle' || variant === 'title1' || variant === 'title2';
  return (
    <Text
      accessibilityRole={isHeading ? 'header' : props.accessibilityRole}
      style={[typography[variant], { color: colors[color] }, style]}
      {...props}
    />
  );
}
