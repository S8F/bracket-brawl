// One group in the group stage: its name, how many advance, its bracket, its match lengths, and the
// group result once every match is played.

import { StyleSheet, Text, View } from 'react-native';
import { isComplete } from '../lib/engine';
import type { BracketSide, Group, MatchFormat, Player, PlayerId } from '../lib/types';
import { colors, spacing } from '../theme';
import { BracketView } from './BracketView';
import { Card } from './Card';
import { RoundFormatSettings } from './RoundFormatSettings';
import { StandingsList } from './StandingsList';

interface Props {
  group: Group;
  players: Record<PlayerId, Player>;
  onScore: (matchId: string, scoreA: number, scoreB: number) => Promise<string | null>;
  onEditScore: (matchId: string, scoreA: number, scoreB: number) => Promise<string | null>;
  onClear: (matchId: string) => Promise<void>;
  onFormat: (side: BracketSide, round: number, format: MatchFormat) => void;
}

export function GroupCard({ group, players, onScore, onEditScore, onClear, onFormat }: Props) {
  // Ask the bracket itself: its placements list is filled with every player from the start.
  const finished = isComplete(group.bracket);
  return (
    <Card>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>
          {group.name}
        </Text>
        <Text style={styles.advance}>Top {group.advanceCount} advance</Text>
      </View>
      <BracketView
        bracket={group.bracket}
        players={players}
        onScore={onScore}
        onEditScore={onEditScore}
        onClear={onClear}
      />
      <RoundFormatSettings
        bracket={group.bracket}
        title={`${group.name} formats`}
        onChange={onFormat}
      />
      {finished ? (
        <View>
          <Text style={styles.result}>Group result</Text>
          <StandingsList
            order={group.bracket.placements}
            players={players}
            advanceCount={group.advanceCount}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.gold, fontSize: 22, fontWeight: '800' },
  advance: { color: colors.cyan, fontSize: 14, fontWeight: '700' },
  result: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.xs },
});
