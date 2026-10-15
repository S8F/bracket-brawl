// "Playoff formats" — a fold-out list with one row per round, to change how long matches are
// (Bo1, Bo3, FT3, Bo5). The screen asks for a confirm first if results would be wiped.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ROUND_FORMATS } from '../lib/formats';
import { roundColumnLabel } from '../lib/roundNames';
import type { BracketSide, DoubleElimBracket, Match, MatchFormat } from '../lib/types';
import { colors, MIN_TAP_TARGET, spacing } from '../theme';
import { FormatPicker } from './FormatPicker';

interface Props {
  bracket: DoubleElimBracket;
  title: string;
  onChange: (side: BracketSide, round: number, format: MatchFormat) => void;
}

const SIDES: BracketSide[] = ['winners', 'losers', 'grandFinal'];
const SIDE_NAME: Record<BracketSide, string> = {
  winners: 'Winners',
  losers: 'Losers',
  grandFinal: 'Grand final',
};

interface RoundRow {
  side: BracketSide;
  round: number;
  label: string;
  format: MatchFormat;
}

// One row per (side, round). All matches in a round share a length, so the first one is read.
function roundRows(bracket: DoubleElimBracket): RoundRow[] {
  const rows: RoundRow[] = [];
  for (const side of SIDES) {
    const byRound = new Map<number, Match[]>();
    for (const m of bracket.matches) {
      if (m.side !== side) continue;
      byRound.set(m.round, [...(byRound.get(m.round) ?? []), m]);
    }
    for (const round of [...byRound.keys()].sort((a, b) => a - b)) {
      const col = roundColumnLabel(bracket, side, round);
      rows.push({
        side,
        round,
        label: side === 'grandFinal' ? col : `${SIDE_NAME[side]} · ${col}`,
        format: byRound.get(round)![0].format,
      });
    }
  }
  return rows;
}

export function RoundFormatSettings({ bracket, title, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rows = roundRows(bracket);
  if (rows.length === 0) return null;
  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        accessibilityHint="Shows or hides the match length for each round"
        style={styles.header}
      >
        <Text style={styles.title}>
          {open ? '▾ ' : '▸ '}
          {title}
        </Text>
      </Pressable>
      {open
        ? rows.map((row) => (
            <FormatPicker
              key={`${row.side}-${row.round}`}
              label={row.label}
              options={ROUND_FORMATS}
              value={row.format}
              onChange={(f) => onChange(row.side, row.round, f)}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  header: { minHeight: MIN_TAP_TARGET, justifyContent: 'center' },
  title: { color: colors.cyan, fontSize: 16, fontWeight: '700' },
});
