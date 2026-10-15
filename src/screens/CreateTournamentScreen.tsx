// Create a tournament: pick players from your saved list or type new ones, choose how long matches
// are, optionally skip the group stage, then start. New names also join your saved player list.

import { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addPlayers, listPlayers } from '../data/playerRepo';
import { createTournamentRow } from '../data/tournamentRepo';
import { AddNameRow } from '../components/AddNameRow';
import { AppButton } from '../components/AppButton';
import { BodyText } from '../components/BodyText';
import { Chip } from '../components/Chip';
import { ChipRow } from '../components/ChipRow';
import { FormatPicker } from '../components/FormatPicker';
import { Heading } from '../components/Heading';
import { Screen } from '../components/Screen';
import { SectionTitle } from '../components/SectionTitle';
import { StatusMessage } from '../components/StatusMessage';
import { TextField } from '../components/TextField';
import { ToggleRow } from '../components/ToggleRow';
import { CREATE_FORMATS } from '../lib/formats';
import { checkPlayerName } from '../lib/playerNames';
import { nameKey } from '../lib/scoring';
import { getClient } from '../lib/supabase';
import { createTournament, InvalidTournamentError, planGrouping } from '../lib/tournament';
import { DEFAULT_CONFIG, type TournamentConfig } from '../lib/types';
import type { SignedInStackParams } from '../navigation/types';

// "Tournament 15 Oct" when the user leaves the name empty.
function defaultName(): string {
  const day = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `Tournament ${day}`;
}

export function CreateTournamentScreen({
  navigation,
  route,
}: NativeStackScreenProps<SignedInStackParams, 'CreateTournament'>) {
  const client = getClient();
  const [tourName, setTourName] = useState('');
  const [players, setPlayers] = useState<string[]>(route.params?.players ?? []);
  const [config, setConfig] = useState<TournamentConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listPlayers(client).then((res) => {
      if (res.ok) setSaved(res.value.map((p) => p.name));
    });
  }, [client]);

  const hasPlayer = (name: string) => players.some((p) => nameKey(p) === nameKey(name));

  // Adds one name. Returns an error sentence, or null when it worked.
  const addName = (raw: string): string | null => {
    const checked = checkPlayerName(raw);
    if (!checked.ok) return checked.message;
    if (hasPlayer(checked.name)) return `${checked.name} is already in this tournament.`;
    setPlayers((p) => [...p, checked.name]);
    return null;
  };

  const available = saved.filter((n) => !hasPlayer(n));
  const canCreate = players.length >= 2;
  const plan = canCreate ? planGrouping(players.length, config.skipGroups) : null;

  const create = async () => {
    setBusy(true);
    setError(null);
    let tournament;
    try {
      tournament = createTournament(players, config);
    } catch (e) {
      setBusy(false);
      setError(
        e instanceof InvalidTournamentError ? e.message : 'Could not create that tournament.',
      );
      return;
    }
    const res = await createTournamentRow(client, tourName.trim() || defaultName(), tournament);
    if (!res.ok) {
      setBusy(false);
      setError(res.message);
      return;
    }
    // New names join the saved list. If this part fails the tournament still exists, so carry on.
    await addPlayers(client, players);
    setBusy(false);
    navigation.replace('Tournament', { id: res.value });
  };

  return (
    <Screen>
      <Heading>New tournament</Heading>
      <TextField
        label="Tournament name (optional)"
        value={tourName}
        onChangeText={setTourName}
        autoCapitalize="sentences"
      />

      <SectionTitle>Players</SectionTitle>
      {available.length > 0 ? (
        <>
          <BodyText>Tap a saved player to add them.</BodyText>
          <ChipRow>
            {available.map((n) => (
              <Chip
                key={n}
                label={`+ ${n}`}
                spokenLabel={`Add ${n}`}
                onPress={() => void addName(n)}
              />
            ))}
          </ChipRow>
        </>
      ) : null}
      <AddNameRow
        label="Type a new player name"
        buttonLabel="Add to tournament"
        onSubmit={addName}
      />
      {players.length > 0 ? (
        <>
          <BodyText>{`${players.length} player${players.length === 1 ? '' : 's'} (tap one to remove)`}</BodyText>
          <ChipRow>
            {players.map((p) => (
              <Chip
                key={p}
                label={`${p} ✕`}
                spokenLabel={`Remove ${p}`}
                selected
                onPress={() => setPlayers((list) => list.filter((x) => x !== p))}
              />
            ))}
          </ChipRow>
        </>
      ) : (
        <BodyText>Add at least 2 players.</BodyText>
      )}

      <SectionTitle>Match lengths</SectionTitle>
      {config.skipGroups ? (
        <BodyText>Group stage is skipped. Everyone plays in one bracket.</BodyText>
      ) : (
        <FormatPicker
          label="Group stage"
          options={CREATE_FORMATS}
          value={config.groupFormat}
          onChange={(f) => setConfig((c) => ({ ...c, groupFormat: f }))}
        />
      )}
      <FormatPicker
        label={config.skipGroups ? 'Bracket matches' : 'Playoff'}
        options={CREATE_FORMATS}
        value={config.playoffFormat}
        onChange={(f) => setConfig((c) => ({ ...c, playoffFormat: f }))}
      />
      <FormatPicker
        label="Grand final"
        options={CREATE_FORMATS}
        value={config.grandFinalFormat}
        onChange={(f) => setConfig((c) => ({ ...c, grandFinalFormat: f }))}
      />
      <ToggleRow
        label="Skip group stage: one double-elimination bracket for everyone"
        value={config.skipGroups}
        onValueChange={(v) => setConfig((c) => ({ ...c, skipGroups: v }))}
      />

      {plan ? (
        <BodyText>
          {plan.skipGroups
            ? `${players.length} players go straight into one double-elimination bracket (no groups).`
            : `${players.length} players make ${plan.groupCount} groups (sizes ${plan.sizes.join(', ')}). Each group is double-elimination. The top ${plan.advancePerGroup.join('/')} of each group go on to the playoff.`}
        </BodyText>
      ) : null}

      <StatusMessage message={error} />
      <AppButton label="Create tournament" onPress={create} disabled={!canCreate} busy={busy} />
    </Screen>
  );
}
