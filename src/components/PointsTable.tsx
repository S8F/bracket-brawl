// The points table: rank, player, points, tournaments played and won. Only finished tournaments count.

import { StyleSheet, Text, View } from 'react-native';
import type { LeaderboardRow } from '../lib/scoring';
import { colors, fonts, spacing } from '../theme';
import { BodyText } from './BodyText';

export function PointsTable({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return <BodyText>No players yet. Finished tournaments give points by final place.</BodyText>;
  }
  return (
    <View accessibilityLabel="Points table">
      <View style={styles.row}>
        <Text style={[styles.rank, styles.head]}>#</Text>
        <Text style={[styles.name, styles.head]}>Player</Text>
        <Text style={[styles.num, styles.head]}>Pts</Text>
        <Text style={[styles.num, styles.head]}>Played</Text>
        <Text style={[styles.num, styles.head]}>Won</Text>
      </View>
      {rows.map((r, i) => (
        <View
          key={r.name}
          accessible
          accessibilityLabel={`Place ${i + 1}, ${r.name}, ${r.points} points, played ${r.played}, won ${r.won}`}
          style={styles.row}
        >
          <Text style={[styles.rank, i < 3 && styles.top]}>{i + 1}</Text>
          <Text style={[styles.name, i < 3 && styles.top]} numberOfLines={1}>
            {r.name}
          </Text>
          <Text style={[styles.num, styles.points]}>{r.points}</Text>
          <Text style={styles.num}>{r.played}</Text>
          <Text style={styles.num}>{r.won}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  head: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  rank: { width: 28, color: colors.textMuted, fontSize: 16 },
  name: { flex: 1, color: colors.text, fontSize: 16 },
  num: { fontFamily: fonts.mono, width: 56, textAlign: 'right', color: colors.text, fontSize: 16 },
  points: { color: colors.gold, fontWeight: '800' },
  top: { color: colors.gold, fontWeight: '700' },
});
