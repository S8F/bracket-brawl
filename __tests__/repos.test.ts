// Tests the saving and loading code (players and tournaments) against a pretend Supabase that, like
// the real database rules, shows each user only their own rows. Covers: a new account is empty,
// the saved player list (add / rename / remove / no duplicates), tournaments (create / list / load /
// save / delete), the finish date, "Make as new" names, the points table scope, and that user A
// cannot see or change user B's players or tournaments through the app's code.

import { addPlayers, listPlayers, removePlayer, renamePlayer } from '../src/data/playerRepo';
import {
  createTournamentRow,
  deleteTournament,
  listTournaments,
  loadTournament,
  saveTournament,
} from '../src/data/tournamentRepo';
import { isComplete, reportResult } from '../src/lib/engine';
import { computeLeaderboard } from '../src/lib/scoring';
import { computeStandings, createTournament } from '../src/lib/tournament';
import { summarize } from '../src/lib/tournamentSummary';
import type { Tournament } from '../src/lib/types';
import { createFakeDb, fakeClientFor } from './helpers/fakeSupabase';

const SKIP = {
  groupFormat: { kind: 'bestOf', n: 3 },
  playoffFormat: { kind: 'bestOf', n: 3 },
  grandFinalFormat: { kind: 'bestOf', n: 3 },
  skipGroups: true,
} as const;

function finished(names: string[]): Tournament {
  const t = createTournament(names, SKIP);
  let guard = 0;
  while (!isComplete(t.playoff!) && guard++ < 500) {
    const m = t.playoff!.matches.find((x) => x.winner === null && x.playerA && x.playerB);
    if (!m) break;
    reportResult(t.playoff!, m.id, m.playerA!);
  }
  t.phase = 'done';
  t.standings = computeStandings(t);
  return t;
}

describe('a brand-new account', () => {
  it('has no players, no tournaments and an empty points table', async () => {
    const client = fakeClientFor(createFakeDb(), 'new-user');
    const players = await listPlayers(client);
    const tournaments = await listTournaments(client);
    expect(players).toEqual({ ok: true, value: [] });
    expect(tournaments).toEqual({ ok: true, value: [] });
    expect(computeLeaderboard([], [])).toEqual([]);
  });
});

describe('saved player list', () => {
  it('adds, sorts, renames and removes players', async () => {
    const client = fakeClientFor(createFakeDb(), 'a');
    await addPlayers(client, ['Cara', 'abe', 'Bo']);
    const listed = await listPlayers(client);
    expect(listed.ok && listed.value.map((p) => p.name)).toEqual(['abe', 'Bo', 'Cara']);

    const bo = listed.ok ? listed.value.find((p) => p.name === 'Bo')! : null;
    expect((await renamePlayer(client, bo!.id, 'Bob')).ok).toBe(true);
    expect((await removePlayer(client, bo!.id)).ok).toBe(true);
    const after = await listPlayers(client);
    expect(after.ok && after.value.map((p) => p.name)).toEqual(['abe', 'Cara']);
  });

  it('never makes duplicates, ignoring capitals and blank names', async () => {
    const client = fakeClientFor(createFakeDb(), 'a');
    await addPlayers(client, ['Saief', 'saief', '  ', 'Player A']);
    await addPlayers(client, ['SAIEF', 'Player A']);
    const listed = await listPlayers(client);
    expect(listed.ok && listed.value.map((p) => p.name).sort()).toEqual(['Player A', 'Saief']);
  });

  it('refuses to rename onto an existing name, and refuses an empty or too-long name', async () => {
    const client = fakeClientFor(createFakeDb(), 'a');
    await addPlayers(client, ['Ann', 'Bob']);
    const listed = await listPlayers(client);
    const ann = listed.ok ? listed.value.find((p) => p.name === 'Ann')! : null;
    const dup = await renamePlayer(client, ann!.id, 'bob');
    expect(dup).toEqual({ ok: false, message: 'You already have a player with that name.' });
    expect((await renamePlayer(client, ann!.id, '   ')).ok).toBe(false);
    expect((await renamePlayer(client, ann!.id, 'x'.repeat(61))).ok).toBe(false);
  });
});

describe('tournaments', () => {
  it('creates, lists (newest first), loads, saves and deletes', async () => {
    const client = fakeClientFor(createFakeDb(), 'a');
    const t1 = createTournament(['A', 'B', 'C'], SKIP);
    const t2 = createTournament(['D', 'E'], SKIP);
    const id1 = await createTournamentRow(client, '  First ', t1);
    const id2 = await createTournamentRow(client, 'Second', t2);
    expect(id1.ok && id2.ok).toBe(true);

    const listed = await listTournaments(client);
    expect(listed.ok && listed.value.map((x) => x.name)).toEqual(['Second', 'First']);

    const loaded = await loadTournament(client, id1.ok ? id1.value : '');
    expect(loaded.ok && Object.keys(loaded.value.tournament.players)).toHaveLength(3);

    expect((await deleteTournament(client, id1.ok ? id1.value : '')).ok).toBe(true);
    const gone = await loadTournament(client, id1.ok ? id1.value : '');
    expect(gone.ok).toBe(false);
  });

  it('stamps the finish date once, keeps it, and clears it when a correction re-opens the tournament', async () => {
    const client = fakeClientFor(createFakeDb(), 'a');
    const open = createTournament(['A', 'B', 'C', 'D'], SKIP);
    const created = await createTournamentRow(client, 'T', open);
    const id = created.ok ? created.value : '';

    const done = finished(['A', 'B', 'C', 'D']);
    const first = await saveTournament(client, id, done, null);
    expect(first.ok && typeof first.value).toBe('string');
    const stamp = first.ok ? first.value : null;

    const again = await saveTournament(client, id, done, stamp);
    expect(again.ok && again.value).toBe(stamp);

    const reopened = await saveTournament(client, id, open, stamp);
    expect(reopened.ok && reopened.value).toBeNull();
  });

  it('gives "Make as new" the same player names and the right status', async () => {
    const client = fakeClientFor(createFakeDb(), 'a');
    const done = finished(['Alice', 'Bob', 'Carol', 'Dan']);
    await createTournamentRow(client, 'Done', done);
    const listed = await listTournaments(client);
    const summary = summarize(listed.ok ? listed.value[0] : (null as never));
    expect(summary.status).toBe('closed');
    expect(summary.topThreeNames).toHaveLength(3);
    expect([...summary.playerNames].sort()).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
    const clone = createTournament(summary.playerNames, SKIP);
    expect(
      Object.values(clone.players)
        .map((p) => p.name)
        .sort(),
    ).toEqual(['Alice', 'Bob', 'Carol', 'Dan']);
    expect(clone.standings).toHaveLength(0);
  });

  it('skips a stored row that does not look like a tournament instead of crashing', async () => {
    const db = createFakeDb();
    const client = fakeClientFor(db, 'a');
    await createTournamentRow(client, 'Good', createTournament(['A', 'B'], SKIP));
    db.tables.tournaments.push({
      id: 'bad',
      user_id: 'a',
      name: 'Bad',
      data: {},
      created_at: 'x',
      finished_at: null,
    });
    const listed = await listTournaments(client);
    expect(listed.ok && listed.value.map((t) => t.name)).toEqual(['Good']);
  });

  it('reports a failed save as a plain message, never a crash', async () => {
    const db = createFakeDb();
    const client = fakeClientFor(db, 'a');
    const created = await createTournamentRow(client, 'T', createTournament(['A', 'B'], SKIP));
    db.offline = true;
    const res = await saveTournament(
      client,
      created.ok ? created.value : '',
      createTournament(['A', 'B'], SKIP),
      null,
    );
    expect(res).toEqual({
      ok: false,
      message: "Couldn't reach the internet. Check your connection and try again.",
    });
  });
});

describe('privacy between two users (app side)', () => {
  it('user A cannot see or change user B players or tournaments', async () => {
    const db = createFakeDb();
    const a = fakeClientFor(db, 'user-a');
    const b = fakeClientFor(db, 'user-b');

    await addPlayers(a, ['A-only']);
    const aTournament = await createTournamentRow(a, 'A tournament', finished(['P', 'Q']));
    const aId = aTournament.ok ? aTournament.value : '';
    await addPlayers(b, ['B-only']);

    const bPlayers = await listPlayers(b);
    expect(bPlayers.ok && bPlayers.value.map((p) => p.name)).toEqual(['B-only']);
    const bTournaments = await listTournaments(b);
    expect(bTournaments).toEqual({ ok: true, value: [] });

    // B tries to open, change and delete A's tournament by its id.
    expect((await loadTournament(b, aId)).ok).toBe(false);
    expect((await saveTournament(b, aId, createTournament(['X', 'Y'], SKIP), null)).ok).toBe(false);
    await deleteTournament(b, aId);
    const stillThere = await loadTournament(a, aId);
    expect(stillThere.ok && stillThere.value.name).toBe('A tournament');

    // B's points table has nothing from A.
    const bRows = computeLeaderboard([], bPlayers.ok ? bPlayers.value.map((p) => p.name) : []);
    expect(bRows.map((r) => r.name)).toEqual(['B-only']);
  });
});
