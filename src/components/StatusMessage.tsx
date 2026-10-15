// A short error or info message. Marked as an "alert" so VoiceOver reads it out when it appears.

import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

interface Props {
  message: string | null;
  kind?: 'error' | 'info';
}

export function StatusMessage({ message, kind = 'error' }: Props) {
  if (!message) return null;
  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.text, { color: kind === 'error' ? colors.red : colors.cyan }]}
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
});
