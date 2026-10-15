// Signed-in front page: ongoing tournaments on top, finished ones below, then the points table.
// Reloads every time the screen comes back into view, so it always shows what is saved.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listPlayers } from '../data/playerRepo';
import { listTournaments } from '../data/tournamentRepo';
import { AppButton } from '../components/AppButton';
import { BodyText } from '../components/BodyText';
import { Heading } from '../components/Heading';
import { LivePill } from '../components/LivePill';
import { PointsTable } from '../components/PointsTable';
import { Screen } from '../components/Screen';
import { SectionTitle } from '../components/SectionTitle';
import { StatusMessage } from '../components/StatusMessage';
import { TournamentList } from '../components/TournamentList';
import { computeLeaderboard } from '../lib/scoring';
import { getClient } from '../lib/supabase';
import { summarize, type StoredTournament } from '../lib/tournamentSummary';
import type { SignedInStackParams } from '../navigation/types';

export function HomeScreen({ navigation }: NativeStackScreenProps<SignedInStackParams, 'Home'>) {
  const client = getClient();
  const [tournaments, setTournaments] = useState<StoredTournament[]>([]);
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reads tournaments and players together, then shows them (or the problem).
  const show = useCallback(
    ([tRes, pRes]: [
      Awaited<ReturnType<typeof listTournaments>>,
      Awaited<ReturnType<typeof listPlayers>>,
    ]) => {
      if (!tRes.ok) return setError(tRes.message);
      if (!pRes.ok) return setError(pRes.message);
      setError(null);
      setTournaments(tRes.value);
      setPlayerNames(pRes.value.map((p) => p.name));
    },
    [],
  );
  const load = useCallback(
    () => Promise.all([listTournaments(client), listPlayers(client)]).then(show),
    [client, show],
  );

  useEffect(() => {
    void load();
    return navigation.addListener('focus', () => void load());
  }, [navigation, load]);

  const summaries = useMemo(() => tournaments.map(summarize), [tournaments]);
  const rows = useMemo(
    () =>
      computeLeaderboard(
        tournaments.map((t) => t.tournament),
        playerNames,
      ),
    [tournaments, playerNames],
  );
  const liveCount = summaries.filter((s) => s.status === 'open').length;

  return (
    <Screen>
      <Heading>Tournaments</Heading>
      {liveCount > 0 ? <LivePill /> : null}
      <StatusMessage message={error} />
      {error ? (
        <AppButton label="Try again" variant="secondary" onPress={() => void load()} />
      ) : null}
      <AppButton label="New tournament" onPress={() => navigation.navigate('CreateTournament')} />
      <TournamentList
        summaries={summaries}
        onOpen={(id) => navigation.navigate('Tournament', { id })}
        onMakeAsNew={(players) => navigation.navigate('CreateTournament', { players })}
      />
      <SectionTitle>Points table</SectionTitle>
      <BodyText>Points come from finished tournaments only.</BodyText>
      <PointsTable rows={rows} />
      <AppButton
        label="Players"
        variant="secondary"
        onPress={() => navigation.navigate('Players')}
      />
      <AppButton
        label="Settings"
        variant="secondary"
        onPress={() => navigation.navigate('Settings')}
      />
    </Screen>
  );
}
