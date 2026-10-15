// The app's main button. At least 44pt tall (Apple's minimum), with a screen-reader label and busy state.

import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, MIN_TAP_TARGET } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  hint?: string;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  hint,
}: Props) {
  const inactive = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onGold : colors.text} />
      ) : (
        <Text style={[styles.label, variant === 'primary' && { color: colors.onGold }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TAP_TARGET + 4,
    minWidth: MIN_TAP_TARGET,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 17 },
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.5 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.gold },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.red },
});
