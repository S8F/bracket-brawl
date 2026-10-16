// Underlined reminder to check the spam folder, shown after an email was sent.

import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme';

export function SpamHint() {
  return <Text style={styles.spamHint}>{"Didn't get it? Check your spam folder."}</Text>;
}

const styles = StyleSheet.create({
  spamHint: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 22,
    textDecorationLine: 'underline',
  },
});
