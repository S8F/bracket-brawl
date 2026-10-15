// A smaller title inside a screen. Marked as a "header" so VoiceOver users can jump between sections.

import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme';

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.cyan,
    fontSize: 20,
    fontFamily: fonts.display,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
