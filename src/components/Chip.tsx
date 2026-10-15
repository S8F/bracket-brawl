// A small pill button. Used to pick a saved player, or to pick one match length out of several.
// At least 44pt tall. When "selected" it is filled gold, and VoiceOver announces it as selected.

import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, MIN_TAP_TARGET } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  selected?: boolean;
  // What VoiceOver reads when it differs from the visible text (for example "Add Saief").
  spokenLabel?: string;
}

export function Chip({ label, onPress, selected = false, spokenLabel }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spokenLabel ?? label}
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.text, selected && { color: colors.onGold }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TAP_TARGET,
    minWidth: MIN_TAP_TARGET,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.gold, borderColor: colors.gold },
  text: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
