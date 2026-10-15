// The red "LIVE" badge with a slowly pulsing dot. Shown while a tournament is in progress.
// The dot is decoration only, so VoiceOver just reads "Live".

import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export function LivePill() {
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View accessible accessibilityLabel="Live" style={styles.pill}>
      <Animated.View style={[styles.dot, { opacity: pulse }]} />
      <Text style={styles.text}>LIVE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  text: { color: colors.red, fontFamily: fonts.display, fontSize: 14, letterSpacing: 1 },
});
