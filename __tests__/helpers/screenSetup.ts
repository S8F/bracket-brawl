// Shared set-up for the screen tests: a pretend signed-in user with a pretend database, and fake
// "navigation" objects so a screen can be shown on its own.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createTournamentRow } from '../../src/data/tournamentRepo';
import { createTournament } from '../../src/lib/tournament';
import type { Tournament, TournamentConfig } from '../../src/lib/types';
import { createFakeDb, fakeClientFor, type FakeDb } from './fakeSupabase';

export const BO3_CONFIG: TournamentConfig = {
  groupFormat: { kind: 'bestOf', n: 3 },
  playoffFormat: { kind: 'bestOf', n: 3 },
  grandFinalFormat: { kind: 'bestOf', n: 5 },
  skipGroups: true,
};

export interface TestWorld {
  db: FakeDb;
  client: SupabaseClient;
}

export function newWorld(userId = 'user-a'): TestWorld {
  const db = createFakeDb();
  return { db, client: fakeClientFor(db, userId) };
}

export async function addTournament(
  world: TestWorld,
  name: string,
  names: string[],
  config: TournamentConfig = BO3_CONFIG,
): Promise<{ id: string; tournament: Tournament }> {
  const tournament = createTournament(names, config);
  const res = await createTournamentRow(world.client, name, tournament);
  if (!res.ok) throw new Error(res.message);
  return { id: res.value, tournament };
}

// A fake "navigation" prop: records where the screen tried to go.
export function fakeNavigation() {
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn(() => () => {}),
  };
}

// Lets a test hand a screen only the few navigation functions it uses, typed as the screen's props.
export function screenProps<P>(partial: object): P {
  return partial as P;
}
