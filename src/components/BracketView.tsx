// A whole double-elimination bracket stacked top to bottom for a phone: winners side, losers side,
// then the grand final. Each side is split into rounds with their names ("Winners Semi-Final").
// The grand final "reset" match stays hidden until it really happens.

import { StyleSheet, Text, View } from 'react-native';
import { roundColumnLabel, roundName } from '../lib/roundNames';
import type { BracketSide, DoubleElimBracket, Match, Player, PlayerId } from '../lib/types';
import { colors, spacing } from '../theme';
import { MatchCard } from './MatchCard';

interface Props {
  bracket: DoubleElimBracket;
  players: Record<PlayerId, Player>;
  onScore: (matchId: string, scoreA: number, scoreB: number) => Promise<string | null>;
  onEditScore: (matchId: string, scoreA: number, scoreB: number) => Promise<string | null>;
  onClear: (matchId: string) => Promise<void>;
}

const SIDE_ORDER: BracketSide[] = ['winners', 'losers', 'grandFinal'];
const SIDE_TITLE: Record<BracketSide, string> = {
  winners: 'Winners bracket',
  losers: 'Losers bracket',
  grandFinal: 'Grand final',
};

// Groups matches by round number, lowest round first.
function roundsOf(matches: Match[]): Match[][] {
  const byRound = new Map<number, Match[]>();
  for (const m of matches) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }
  return [...byRound.keys()].sort((a, b) => a - b).map((r) => byRound.get(r)!);
}

export function BracketView({ bracket, players, onScore, onEditScore, onClear }: Props) {
  return (
    <View style={styles.wrapper}>
      {SIDE_ORDER.map((side) => {
        let matches = bracket.matches.filter((m) => m.side === side);
        if (side === 'grandFinal') {
          matches = matches.filter((m) => m.round === 1 || m.playerA || m.playerB);
        }
        if (matches.length === 0) return null;
        return (
          <View key={side} style={styles.side}>
            <Text accessibilityRole="header" style={styles.sideTitle}>
              {SIDE_TITLE[side]}
            </Text>
            {roundsOf(matches).map((roundMatches) => {
              const round = roundMatches[0].round;
              return (
                <View key={round} style={styles.round}>
                  <Text style={styles.roundTitle}>{roundColumnLabel(bracket, side, round)}</Text>
                  {roundMatches.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      players={players}
                      roundLabel={roundName(bracket, m)}
                      onScore={onScore}
                      onEditScore={onEditScore}
                      onClear={onClear}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.lg },
  side: { gap: spacing.md },
  sideTitle: { color: colors.gold, fontSize: 18, fontWeight: '800' },
  round: { gap: spacing.sm },
  roundTitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
