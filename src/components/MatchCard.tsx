// One match: both players, the score, and the buttons to enter, fix or clear the result.
// Single-game matches (Bo1) are decided by tapping the winner. Longer matches use two score boxes.
// Impossible scores (like 3-2 in a Bo3) are refused with a message before anything is saved.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { shortRoundName } from '../lib/roundNames';
import {
  checkScore,
  formatLabel,
  maxGames,
  type Match,
  type Player,
  type PlayerId,
} from '../lib/types';
import { colors, spacing } from '../theme';
import { AppButton } from './AppButton';
import { MatchSlot } from './MatchSlot';
import { StatusMessage } from './StatusMessage';
import { TextField } from './TextField';

interface Props {
  match: Match;
  players: Record<PlayerId, Player>;
  roundLabel: string;
  // Each returns an error sentence to show, or null when it worked.
  onScore: (matchId: string, scoreA: number, scoreB: number) => Promise<string | null>;
  onEditScore: (matchId: string, scoreA: number, scoreB: number) => Promise<string | null>;
  onClear: (matchId: string) => Promise<void>;
}

function placeholderFor(kind: string): string {
  if (kind === 'winnerOf') return 'Winner of previous';
  if (kind === 'loserOf') return 'Loser of previous';
  if (kind === 'empty') return '—';
  return 'TBD';
}

export function MatchCard({ match, players, roundLabel, onScore, onEditScore, onClear }: Props) {
  const aName = match.playerA ? (players[match.playerA]?.name ?? null) : null;
  const bName = match.playerB ? (players[match.playerB]?.name ?? null) : null;
  const decided = match.winner !== null;
  const playable = !decided && !!match.playerA && !!match.playerB;
  const editable = decided && !match.isBye && !!match.playerA && !!match.playerB;
  const isBo1 = maxGames(match.format) === 1;

  const [editing, setEditing] = useState(false);
  const [sa, setSa] = useState('');
  const [sb, setSb] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openEditor = () => {
    setSa(match.scoreA != null ? String(match.scoreA) : '');
    setSb(match.scoreB != null ? String(match.scoreB) : '');
    setError(null);
    setEditing(true);
  };

  // Sends a score to the screen's handler and shows the problem it reports, if any.
  const send = async (a: number, b: number) => {
    setBusy(true);
    const problem = await (decided ? onEditScore : onScore)(match.id, a, b);
    setBusy(false);
    setError(problem);
    if (!problem) setEditing(false);
  };

  const submitScore = async () => {
    if (sa.trim() === '' || sb.trim() === '') {
      setError('Type a score for both players.');
      return;
    }
    const a = Number(sa);
    const b = Number(sb);
    const check = checkScore(match.format, a, b);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    await send(a, b);
  };

  // Single-game matches: tapping a player's line makes them the winner (1-0 or 0-1).
  const pickWinner = (side: 'a' | 'b') => () =>
    void send(side === 'a' ? 1 : 0, side === 'a' ? 0 : 1);

  const bo1PlayableTap = isBo1 && playable;
  const bo1FlipA = isBo1 && editable && match.loser === match.playerA;
  const bo1FlipB = isBo1 && editable && match.loser === match.playerB;
  const aTap = bo1PlayableTap || bo1FlipA;
  const bTap = bo1PlayableTap || bo1FlipB;
  const outcomeOf = (id: PlayerId | null): 'winner' | 'loser' | null =>
    !decided || !id ? null : id === match.winner ? 'winner' : id === match.loser ? 'loser' : null;

  return (
    <View style={[styles.card, playable && styles.live]}>
      <View style={styles.head}>
        <Text style={styles.round}>{shortRoundName(roundLabel)}</Text>
        <Text style={styles.format}>
          {playable ? 'Live' : decided ? 'Final' : formatLabel(match.format)}
        </Text>
      </View>

      <MatchSlot
        name={aName}
        placeholder={placeholderFor(match.a.kind)}
        score={match.scoreA}
        outcome={outcomeOf(match.playerA)}
        onPress={aTap ? pickWinner('a') : undefined}
        actionLabel={`${aName ?? 'Player A'} wins`}
      />
      <MatchSlot
        name={bName}
        placeholder={match.isBye ? 'Bye' : placeholderFor(match.b.kind)}
        score={match.scoreB}
        outcome={outcomeOf(match.playerB)}
        onPress={bTap ? pickWinner('b') : undefined}
        actionLabel={`${bName ?? 'Player B'} wins`}
      />

      {!isBo1 && editing ? (
        <View style={styles.editor}>
          <TextField
            label={`${aName ?? 'Player A'} games won`}
            value={sa}
            onChangeText={setSa}
            keyboardType="number-pad"
          />
          <TextField
            label={`${bName ?? 'Player B'} games won`}
            value={sb}
            onChangeText={setSb}
            keyboardType="number-pad"
          />
          <AppButton label="Save score" onPress={submitScore} busy={busy} />
          <AppButton
            label="Cancel"
            variant="secondary"
            onPress={() => {
              setEditing(false);
              setError(null);
            }}
          />
        </View>
      ) : null}

      <StatusMessage message={error} />

      {!isBo1 && !editing && playable ? (
        <AppButton
          label="Enter score"
          hint={`Enter the score for ${aName ?? 'player A'} against ${bName ?? 'player B'}`}
          onPress={openEditor}
        />
      ) : null}
      {!isBo1 && !editing && editable ? (
        <AppButton
          label="Edit score"
          variant="secondary"
          hint={`Change the score for ${aName ?? 'player A'} against ${bName ?? 'player B'}`}
          onPress={openEditor}
        />
      ) : null}
      {editable && !editing ? (
        <AppButton
          label="Clear result"
          variant="danger"
          hint="Take this result back so the match can be played again"
          onPress={() => void onClear(match.id)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  live: { borderColor: colors.cyan },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  round: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  format: { color: colors.cyan, fontSize: 13, fontWeight: '800' },
  editor: { gap: spacing.sm },
});
