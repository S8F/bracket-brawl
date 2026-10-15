// The big "Now playing" box: the two players, the live game score (0 : 0 until a score is saved),
// and which round and match length it is.

import { StyleSheet, Text, View } from 'react-native';
import type { MatchView } from '../lib/matchesView';
import { formatLabel, maxGames } from '../lib/types';
import { colors, fonts, spacing } from '../theme';
import { Card } from './Card';

function slotName(name: string | null, kind: string): string {
  if (name) return name;
  if (kind === 'winnerOf') return 'Winner of previous';
  if (kind === 'loserOf') return 'Loser of previous';
  return 'TBD';
}

export function NowPlayingCard({ view }: { view: MatchView }) {
  const m = view.match;
  const a = slotName(view.aName, m.a.kind);
  const b = slotName(view.bName, m.b.kind);
  const sa = m.scoreA ?? 0;
  const sb = m.scoreB ?? 0;
  const context = `${view.bracketLabel} · ${view.roundLabel} · ${formatLabel(m.format)}`;
  return (
    <Card>
      <View
        accessible
        accessibilityLabel={`Now playing. ${a} against ${b}. ${context}. Score ${sa} to ${sb}.`}
        style={styles.box}
      >
        <Text style={styles.tag}>● NOW PLAYING</Text>
        <Text style={styles.context}>{context}</Text>
        <Text style={styles.names}>
          {a} vs {b}
        </Text>
        <Text style={styles.score}>
          {sa} : {sb}
        </Text>
        <Text style={styles.live}>{maxGames(m.format) === 1 ? 'Single game' : 'Live'}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.xs, alignItems: 'center' },
  tag: { color: colors.red, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  context: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  names: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  score: { color: colors.gold, fontFamily: fonts.mono, fontSize: 40 },
  live: { color: colors.cyan, fontSize: 13, fontWeight: '700' },
});
