// Small "TEST" badge in the top-right corner. Shown only on builds that use the test database.
// It ignores touches, so it never blocks a button underneath.

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabaseConfig } from '../config';
import { isTestDatabase } from '../testLabel';
import { colors, fonts } from '../theme';

export function TestLabel({ url = supabaseConfig?.url }: { url?: string }) {
  if (!isTestDatabase(url)) return null;
  return (
    <SafeAreaView pointerEvents="none" edges={['top']} style={styles.wrap}>
      <View style={styles.badge}>
        <Text style={styles.text}>TEST</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 2, right: 8, zIndex: 1000 },
  badge: {
    backgroundColor: colors.red,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: { color: colors.onGold, fontFamily: fonts.display, fontSize: 12, letterSpacing: 1 },
});
