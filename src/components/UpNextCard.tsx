// The smaller "Up next" box: the one match that plays after the current one.

import { StyleSheet, Text, View } from 'react-native';
import type { MatchView } from '../lib/matchesView';
import { formatLabel } from '../lib/types';
import { colors, spacing } from '../theme';
import { Card } from './Card';

function slotName(name: string | null, kind: string): string {
  if (name) return name;
  if (kind === 'winnerOf') return 'Winner of previous';
  if (kind === 'loserOf') return 'Loser of previous';
  return 'TBD';
}

export function UpNextCard({ view }: { view: MatchView }) {
  const m = view.match;
  const a = slotName(view.aName, m.a.kind);
  const b = slotName(view.bName, m.b.kind);
  const context = `${view.bracketLabel} · ${view.roundLabel} · ${formatLabel(m.format)}`;
  return (
    <Card>
      <View
        accessible
        accessibilityLabel={`Up next. ${a} against ${b}. ${context}.`}
        style={styles.box}
      >
        <Text style={styles.tag}>UP NEXT</Text>
        <Text style={styles.context}>{context}</Text>
        <Text style={styles.names}>
          {a} vs {b}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.xs },
  tag: { color: colors.cyan, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  context: { color: colors.textMuted, fontSize: 14 },
  names: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
