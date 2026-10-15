// Reads and writes the user's tournaments in Supabase. Each function takes the client as an argument,
// so tests can pass a fake. The database's privacy rules (row-level security) make sure a user only
// ever gets their own rows, whatever is asked for here. The "data" column holds the whole Tournament.

import type { SupabaseClient } from '@supabase/supabase-js';
import { friendlyDataError } from '../lib/dataErrors';
import { isTournamentClosed, migrateTournament } from '../lib/scoring';
import type { StoredTournament } from '../lib/tournamentSummary';
import type { Tournament } from '../lib/types';
import { bad, good, type DataResult } from './result';

interface Row {
  id: string;
  name: string;
  data: unknown;
  created_at: string;
  finished_at: string | null;
}

const COLUMNS = 'id, name, data, created_at, finished_at';
const NOT_FOUND = 'That tournament could not be found. It may have been deleted.';

// A saved tournament must at least have players and groups; anything else is skipped, not crashed on.
function looksLikeTournament(data: unknown): data is Tournament {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return typeof d.players === 'object' && d.players !== null && Array.isArray(d.groups);
}

function fromRow(row: Row): StoredTournament | null {
  if (!looksLikeTournament(row.data)) return null;
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    tournament: migrateTournament(row.data),
  };
}

// All of the user's tournaments, newest first.
export async function listTournaments(
  client: SupabaseClient,
): Promise<DataResult<StoredTournament[]>> {
  try {
    const { data, error } = await client
      .from('tournaments')
      .select(COLUMNS)
      .order('created_at', { ascending: false });
    if (error) return bad(friendlyDataError(error));
    const items = ((data ?? []) as Row[])
      .map(fromRow)
      .filter((x): x is StoredTournament => x !== null);
    return good(items);
  } catch (e) {
    return bad(friendlyDataError(e as Error));
  }
}

// One tournament by id.
export async function loadTournament(
  client: SupabaseClient,
  id: string,
): Promise<DataResult<StoredTournament>> {
  try {
    const { data, error } = await client
      .from('tournaments')
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) return bad(friendlyDataError(error));
    const found = data ? fromRow(data as Row) : null;
    return found ? good(found) : bad(NOT_FOUND);
  } catch (e) {
    return bad(friendlyDataError(e as Error));
  }
}

// Saves a brand-new tournament. The owner (user_id) is filled in by the database from the login.
export async function createTournamentRow(
  client: SupabaseClient,
  name: string,
  tournament: Tournament,
): Promise<DataResult<string>> {
  try {
    const { data, error } = await client
      .from('tournaments')
      .insert({ name: name.trim(), data: tournament, finished_at: null })
      .select('id')
      .single();
    if (error) return bad(friendlyDataError(error));
    return good((data as { id: string }).id);
  } catch (e) {
    return bad(friendlyDataError(e as Error));
  }
}

// Saves a changed tournament. The finish date is stamped the first time it becomes finished, kept
// after that, and cleared again if a correction re-opens it. Returns the finish date now stored.
export async function saveTournament(
  client: SupabaseClient,
  id: string,
  tournament: Tournament,
  previousFinishedAt: string | null,
): Promise<DataResult<string | null>> {
  const now = new Date().toISOString();
  const finishedAt = isTournamentClosed(tournament) ? (previousFinishedAt ?? now) : null;
  try {
    const { data, error } = await client
      .from('tournaments')
      .update({ data: tournament, finished_at: finishedAt, updated_at: now })
      .eq('id', id)
      .select('id');
    if (error) return bad(friendlyDataError(error));
    // Zero rows changed means the row is not there (or not ours).
    if (!data || data.length === 0) return bad(NOT_FOUND);
    return good(finishedAt);
  } catch (e) {
    return bad(friendlyDataError(e as Error));
  }
}

export async function deleteTournament(
  client: SupabaseClient,
  id: string,
): Promise<DataResult<null>> {
  try {
    const { error } = await client.from('tournaments').delete().eq('id', id);
    if (error) return bad(friendlyDataError(error));
    return good(null);
  } catch (e) {
    return bad(friendlyDataError(e as Error));
  }
}
