// One line in the tournament list: name, status, dates, player count, and top 3 or "In progress".
// Tap the card to open it; "Make as new" starts a fresh tournament with the same players.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { shortDate, type TournamentSummary } from '../lib/tournamentSummary';
import { colors, MIN_TAP_TARGET, spacing } from '../theme';
import { AppButton } from './AppButton';
import { Card } from './Card';

interface Props {
  summary: TournamentSummary;
  onOpen: () => void;
  onMakeAsNew: () => void;
}

const PLACES = ['1st', '2nd', '3rd'];

export function TournamentListItem({ summary: s, onOpen, onMakeAsNew }: Props) {
  const closed = s.status === 'closed';
  const podium =
    closed && s.topThreeNames.length > 0
      ? s.topThreeNames.map((n, i) => `${PLACES[i]} ${n}`).join('   ')
      : 'In progress';
  return (
    <Card>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${s.name}`}
        accessibilityHint={`${closed ? 'Finished' : 'Ongoing'}. ${s.participantCount} players. ${podium}`}
        style={styles.pressable}
      >
        <View style={styles.top}>
          <Text style={styles.name}>{s.name}</Text>
          <Text style={[styles.status, closed ? styles.closed : styles.ongoing]}>
            {closed ? 'Finished' : 'Ongoing'}
          </Text>
        </View>
        <Text style={styles.meta}>
          {s.participantCount} players · Created {shortDate(s.createdAt)} ·{' '}
          {closed ? `Finished ${shortDate(s.finishedAt)}` : 'In progress'}
        </Text>
        <Text style={styles.podium}>{podium}</Text>
      </Pressable>
      <AppButton
        label="Make as new"
        variant="secondary"
        hint={`Start a new tournament with the same players as ${s.name}`}
        onPress={onMakeAsNew}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  pressable: { minHeight: MIN_TAP_TARGET, gap: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '800' },
  status: { fontSize: 14, fontWeight: '700' },
  closed: { color: colors.gold },
  ongoing: { color: colors.cyan },
  meta: { color: colors.textMuted, fontSize: 14 },
  podium: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
