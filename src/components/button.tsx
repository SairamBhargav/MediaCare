import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { minTouchTarget, radius, spacing, useTheme, type ColorToken } from '@/theme';

import { AppText } from './app-text';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';

type Variant = 'primary' | 'secondary' | 'plain' | 'destructive';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const VARIANTS: Record<Variant, { background: ColorToken | null; text: ColorToken }> = {
  primary: { background: 'accentFill', text: 'onAccent' },
  secondary: { background: 'surfaceRaised', text: 'label' },
  plain: { background: null, text: 'accentText' },
  destructive: { background: 'dangerFill', text: 'onAccent' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  block,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const tokens = VARIANTS[variant];
  const textColor = colors[tokens.text];

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[
        styles.base,
        block && styles.block,
        tokens.background ? { backgroundColor: colors[tokens.background] } : styles.plain,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <>
            {icon ? <Icon name={icon} size={18} color={textColor} weight="semibold" /> : null}
            <AppText variant="headline" color={tokens.text}>
              {title}
            </AppText>
          </>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget + 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: { alignSelf: 'stretch' },
  plain: { paddingHorizontal: spacing.xs },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
