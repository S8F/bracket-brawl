// Normal paragraph text in the app's colours.

import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme';

export function BodyText({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.body, color: colors.textMuted, fontSize: 16, lineHeight: 22 },
});
