// A plain-text link button (for example "Forgot password?"). Tap area is at least 44pt tall.

import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, MIN_TAP_TARGET } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  hint?: string;
}

export function TextLink({ label, onPress, hint }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={styles.pressable}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: MIN_TAP_TARGET,
    minWidth: MIN_TAP_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { color: colors.cyan, fontSize: 16, fontWeight: '600' },
});
