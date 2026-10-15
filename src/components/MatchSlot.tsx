// One player's line inside a match card: avatar initials, name, game score, and winner marker.
// When onPress is given the line is a button (used in single-game matches: tap the winner).

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, MIN_TAP_TARGET } from '../theme';

interface Props {
  name: string | null;
  placeholder: string;
  score: number | null;
  outcome: 'winner' | 'loser' | null;
  // Present only when tapping this line does something; actionLabel is what VoiceOver reads.
  onPress?: () => void;
  actionLabel?: string;
}

// "Player A" becomes "PA", "Saief" becomes "SA".
function initialsOf(name: string | null): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MatchSlot({ name, placeholder, score, outcome, onPress, actionLabel }: Props) {
  const spoken = `${name ?? placeholder}${score != null ? `, ${score}` : ''}${
    outcome ? `, ${outcome === 'winner' ? 'winner' : 'eliminated'}` : ''
  }`;
  const body = (
    <>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initialsOf(name)}</Text>
      </View>
      <Text
        style={[
          styles.name,
          !name && styles.pending,
          outcome === 'winner' && styles.winner,
          outcome === 'loser' && styles.loser,
        ]}
        numberOfLines={1}
      >
        {name ?? placeholder}
      </Text>
      {score != null ? <Text style={styles.score}>{score}</Text> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={actionLabel ?? spoken}
        style={styles.row}
      >
        {body}
        <Text style={styles.pick}>tap</Text>
      </Pressable>
    );
  }
  return (
    <View accessible accessibilityLabel={spoken} style={styles.row}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  pending: { color: colors.textMuted, fontStyle: 'italic' },
  winner: { color: colors.gold, fontWeight: '800' },
  loser: { color: colors.textMuted, textDecorationLine: 'line-through' },
  score: {
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 18,
    minWidth: 20,
    textAlign: 'right',
  },
  pick: { color: colors.cyan, fontSize: 13, fontWeight: '700' },
});
