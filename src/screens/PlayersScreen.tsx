// Your saved player list: add a name, change a name, or remove one.
// These names are offered when you create a tournament. Changing or removing a saved player does not
// touch tournaments that already exist (they keep their own copy of the names).

import { useCallback, useEffect, useState } from 'react';
import { listPlayers, addPlayers, removePlayer, renamePlayer } from '../data/playerRepo';
import type { SavedPlayer } from '../data/playerRepo';
import { AddNameRow } from '../components/AddNameRow';
import { BodyText } from '../components/BodyText';
import { Heading } from '../components/Heading';
import { PlayerRow } from '../components/PlayerRow';
import { Screen } from '../components/Screen';
import { StatusMessage } from '../components/StatusMessage';
import { checkPlayerName } from '../lib/playerNames';
import { nameKey } from '../lib/scoring';
import { getClient } from '../lib/supabase';

export function PlayersScreen() {
  const client = getClient();
  const [players, setPlayers] = useState<SavedPlayer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const show = useCallback((res: Awaited<ReturnType<typeof listPlayers>>) => {
    setLoaded(true);
    if (res.ok) {
      setPlayers(res.value);
      setLoadError(null);
    } else {
      setLoadError(res.message);
    }
  }, []);
  const refresh = useCallback(() => listPlayers(client).then(show), [client, show]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = async (raw: string): Promise<string | null> => {
    const checked = checkPlayerName(raw);
    if (!checked.ok) return checked.message;
    if (players.some((p) => nameKey(p.name) === nameKey(checked.name))) {
      return 'You already have a player with that name.';
    }
    const res = await addPlayers(client, [checked.name]);
    if (!res.ok) return res.message;
    await refresh();
    return null;
  };

  const rename = (id: string) => async (newName: string) => {
    const res = await renamePlayer(client, id, newName);
    if (!res.ok) return res.message;
    await refresh();
    return null;
  };

  const remove = (id: string) => async () => {
    const res = await removePlayer(client, id);
    if (!res.ok) return res.message;
    await refresh();
    return null;
  };

  return (
    <Screen>
      <Heading>Players</Heading>
      <BodyText>Your saved players. They are offered when you create a tournament.</BodyText>
      <StatusMessage message={loadError} />
      <AddNameRow label="New player name" buttonLabel="Add player" onSubmit={add} />
      {loaded && players.length === 0 && !loadError ? (
        <BodyText>No players yet. Add your first one above.</BodyText>
      ) : null}
      {players.map((p) => (
        <PlayerRow key={p.id} name={p.name} onRename={rename(p.id)} onRemove={remove(p.id)} />
      ))}
    </Screen>
  );
}
