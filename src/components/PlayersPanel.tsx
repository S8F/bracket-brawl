// The "Players" section of an open tournament. Swap a player (a substitute takes the slot and keeps
// the wins and losses) or add a new player (this rebuilds the bracket, so the screen asks first).

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Player, PlayerId } from '../lib/types';
import { colors, spacing } from '../theme';
import { AddNameRow } from './AddNameRow';
import { AppButton } from './AppButton';
import { BodyText } from './BodyText';
import { Chip } from './Chip';
import { ChipRow } from './ChipRow';
import { SectionTitle } from './SectionTitle';
import { StatusMessage } from './StatusMessage';

interface Props {
  players: Record<PlayerId, Player>;
  // Names from the user's saved player list, offered as quick picks.
  savedNames: string[];
  // Both return an error sentence to show, or null when it worked.
  onReplace: (playerId: PlayerId, newName: string) => Promise<string | null>;
  onAdd: (newName: string) => Promise<string | null>;
}

export function PlayersPanel({ players, savedNames, onReplace, onAdd }: Props) {
  const [replacingId, setReplacingId] = useState<PlayerId | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const inTournament = new Set(Object.values(players).map((p) => p.name.trim().toLowerCase()));
  const available = savedNames.filter((n) => !inTournament.has(n.trim().toLowerCase()));

  const swap = async (id: PlayerId, name: string): Promise<string | null> => {
    const problem = await onReplace(id, name);
    if (!problem) setReplacingId(null);
    return problem;
  };

  return (
    <View style={styles.wrapper}>
      <SectionTitle>Players</SectionTitle>
      <BodyText>
        Swap a player to put a substitute in their place. Their wins and losses stay. Adding a new
        player rebuilds the bracket from scratch.
      </BodyText>

      {Object.values(players).map((p) => (
        <View key={p.id} style={styles.row}>
          <Text style={styles.name}>{p.name}</Text>
          <AppButton
            label={replacingId === p.id ? 'Cancel swap' : 'Swap player'}
            variant="secondary"
            hint={`Put someone else in the place of ${p.name}`}
            onPress={() => {
              setPickError(null);
              setReplacingId((id) => (id === p.id ? null : p.id));
            }}
          />
          {replacingId === p.id ? (
            <View style={styles.swap}>
              <AddNameRow
                label={`Replacement for ${p.name}`}
                buttonLabel="Swap in"
                onSubmit={(name) => swap(p.id, name)}
              />
              {available.length > 0 ? (
                <ChipRow>
                  {available.map((n) => (
                    <Chip
                      key={n}
                      label={n}
                      spokenLabel={`Swap in ${n}`}
                      onPress={() => void swap(p.id, n).then(setPickError)}
                    />
                  ))}
                </ChipRow>
              ) : null}
              <StatusMessage message={pickError} />
            </View>
          ) : null}
        </View>
      ))}

      <SectionTitle>Add a new player</SectionTitle>
      <StatusMessage
        kind="info"
        message="Warning: adding a player rebuilds the bracket. Results entered so far will be lost."
      />
      <AddNameRow label="New player name" buttonLabel="Add player" onSubmit={onAdd} />
      {available.length > 0 ? (
        <ChipRow>
          {available.map((n) => (
            <Chip
              key={n}
              label={`+ ${n}`}
              spokenLabel={`Add ${n} to the tournament`}
              onPress={() => void onAdd(n).then(setPickError)}
            />
          ))}
        </ChipRow>
      ) : null}
      {replacingId === null ? <StatusMessage message={pickError} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  row: {
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  swap: { gap: spacing.sm },
});
