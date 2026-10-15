// Reads and writes the user's saved player list in Supabase (the names offered when creating a
// tournament). Each function takes the client as an argument so tests can pass a fake. Privacy comes
// from the database rules: a user only ever sees and changes their own players.
// Players inside a tournament are copies of the name, so editing or removing a saved player never
// changes a tournament that already exists.

import type { SupabaseClient } from '@supabase/supabase-js';
import { friendlyDataError } from '../lib/dataErrors';
import { checkPlayerName } from '../lib/playerNames';
import { nameKey } from '../lib/scoring';
import { bad, good, type DataResult } from './result';

export interface SavedPlayer {
  id: string;
  name: string;
}

// The user's players, sorted A to Z ignoring capitals.
export async function listPlayers(client: SupabaseClient): Promise<DataResult<SavedPlayer[]>> {
  try {
    const { data, error } = await client.from('players').select('id, name');
    if (error) return bad(friendlyDataError(error));
    const players = ((data ?? []) as SavedPlayer[]).sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    );
    return good(players);
  } catch (e) {
    return bad(friendlyDataError(e as Error));
  }
}

// Adds names that are not on the list yet (ignoring capitals). Names already there are skipped,
// so calling this twice with the same names never makes duplicates. Blank names are ignored.
export async function addPlayers(
  client: SupabaseClient,
  names: string[],
): Promise<DataResult<null>> {
  try {
    const existing = await listPlayers(client);
    if (!existing.ok) return bad(existing.message);
    const have = new Set(existing.value.map((p) => nameKey(p.name)));
    const fresh: { name: string }[] = [];
    for (const raw of names) {
      const checked = checkPlayerName(raw);
      if (!checked.ok) continue;
      const key = nameKey(checked.name);
      if (have.has(key)) continue;
      have.add(key);
      fresh.push({ name: checked.name });
    }
    if (fresh.length === 0) return good(null);
    const { error } = await client.from('players').insert(fresh);
    // 23505 = the same name was added by something else a moment ago: nothing to do.
    if (error && error.code !== '23505') return bad(friendlyDataError(error));
    return good(null);
  } catch (e) {
    return bad(friendlyDataError(e as Error));
  }
}

export async function renamePlayer(
  client: SupabaseClient,
  id: string,
  newName: string,
): Promise<DataResult<null>> {
  const checked = checkPlayerName(newName);
  if (!checked.ok) return bad(checked.message);
  try {
    const { error } = await client.from('players').update({ name: checked.name }).eq('id', id);
    if (error) return bad(friendlyDataError(error));
    return good(null);
  } catch (e) {
    return bad(friendlyDataError(e as Error));
  }
}

export async function removePlayer(client: SupabaseClient, id: string): Promise<DataResult<null>> {
  try {
    const { error } = await client.from('players').delete().eq('id', id);
    if (error) return bad(friendlyDataError(error));
    return good(null);
  } catch (e) {
    return bad(friendlyDataError(e as Error));
  }
}
