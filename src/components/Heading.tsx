// Big page title. Marked as a "header" so VoiceOver users can jump between titles.

import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme';

export function Heading({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.gold, fontSize: 30, fontFamily: fonts.display, letterSpacing: 0.5 },
});
