// "Champion: Name" — shown at the top of a finished tournament.

import { StyleSheet, Text } from 'react-native';
import { colors, fonts, spacing } from '../theme';

export function ChampionBanner({ name }: { name: string }) {
  return (
    <Text accessibilityRole="header" style={styles.text}>
      Champion: {name}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: colors.gold,
    fontSize: 24,
    fontFamily: fonts.display,
    textAlign: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 12,
  },
});
