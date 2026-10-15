// A line of text with an on/off switch. The whole line (at least 44pt tall and full width) is the
// tap target, and VoiceOver reads it as one switch with its label and on/off state.

import { Pressable, StyleSheet, Switch, Text } from 'react-native';
import { colors, MIN_TAP_TARGET } from '../theme';

interface Props {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function ToggleRow({ label, value, onValueChange }: Props) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={styles.row}
    >
      <Text style={styles.label}>{label}</Text>
      {/* The row handles taps, so the switch itself is only a picture. */}
      <Switch
        value={value}
        pointerEvents="none"
        accessible={false}
        trackColor={{ true: colors.gold, false: colors.border }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: { flex: 1, color: colors.text, fontSize: 16 },
});
