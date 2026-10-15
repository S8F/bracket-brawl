// A numbered list of players, best first. Used for the final standings and for a group's result.

import { StyleSheet, Text, View } from 'react-native';
import type { Player, PlayerId } from '../lib/types';
import { colors, spacing } from '../theme';

interface Props {
  order: PlayerId[];
  players: Record<PlayerId, Player>;
  // The first N places get a tick (used for "advances to the playoff"). 0 = no ticks.
  advanceCount?: number;
}

export function StandingsList({ order, players, advanceCount = 0 }: Props) {
  return (
    <View>
      {order.map((pid, i) => {
        const name = players[pid]?.name ?? '?';
        const advances = i < advanceCount;
        return (
          <View
            key={pid}
            accessible
            accessibilityLabel={`Place ${i + 1}, ${name}${advances ? ', advances' : ''}`}
            style={styles.row}
          >
            <Text style={[styles.rank, i === 0 && styles.gold]}>{i + 1}</Text>
            <Text style={[styles.name, i === 0 && styles.gold]}>
              {name}
              {advances ? ' ✓' : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rank: { width: 28, color: colors.textMuted, fontSize: 17, fontWeight: '700' },
  name: { flex: 1, color: colors.text, fontSize: 17 },
  gold: { color: colors.gold, fontWeight: '800' },
});
