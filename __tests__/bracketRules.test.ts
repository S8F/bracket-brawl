// Bracket rules checked on the phone app's code: one bracket or groups (8 vs 9 players, skip groups
// on and off), the stored finished web tournament replayed to the same champion and 14-place
// standings, and a made-up 9-player groups tournament whose result was first produced by running the
// web app's own code (see the numbers pinned in the last test).

import fixture from './fixtures/finished-tournament.json';
import { buildDoubleElim, seedOrder } from '../src/lib/doubleElim';
import { champion, isComplete, refresh, reportScore } from '../src/lib/engine';
import {
  computeStandings,
  createTournament,
  buildPlayoff,
  planGrouping,
} from '../src/lib/tournament';
import { winsToWin, type MatchFormat, type PlayerId, type Tournament } from '../src/lib/types';
import { groupsFinished } from '../src/lib/tournamentActions';

const BO3: MatchFormat = { kind: 'bestOf', n: 3 };
const BO5: MatchFormat = { kind: 'bestOf', n: 5 };
const config = (skipGroups: boolean) => ({
  groupFormat: BO3,
  playoffFormat: BO3,
  grandFinalFormat: BO5,
  skipGroups,
});
const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

describe('one bracket or groups (check 5)', () => {
  it('skip groups OFF: 8 players give one double-elimination bracket', () => {
    const t = createTournament(names(8), config(false));
    expect(t.groups).toHaveLength(0);
    expect(t.playoff).not.toBeNull();
    expect(t.phase).toBe('playoff');
  });

  it('skip groups OFF: 9 players give groups', () => {
    const t = createTournament(names(9), config(false));
    expect(t.groups.length).toBeGreaterThan(0);
    expect(t.groups.every((g) => g.players.length <= 8)).toBe(true);
    expect(t.playoff).toBeNull();
    expect(t.phase).toBe('groups');
  });

  it('skip groups ON: 9 players give one bracket and no groups', () => {
    const t = createTournament(names(9), config(true));
    expect(t.groups).toHaveLength(0);
    expect(t.playoff).not.toBeNull();
    expect(planGrouping(9, true).skipGroups).toBe(true);
  });
});

// Plays a bracket by always letting the player who comes first in `strength` win (clean score).
function playByStrength(
  b: Tournament['playoff'] & object,
  players: Tournament['players'],
  strength: string[],
  until: () => boolean,
) {
  let guard = 0;
  while (!until() && guard++ < 500) {
    const m = b.matches.find((x) => x.winner === null && x.playerA && x.playerB);
    if (!m) break;
    const aName = players[m.playerA!].name;
    const bName = players[m.playerB!].name;
    const aWins = strength.indexOf(aName) < strength.indexOf(bName);
    const w = winsToWin(m.format);
    const res = reportScore(b, m.id, aWins ? w : 0, aWins ? 0 : w);
    if (!res.ok) throw new Error(res.reason);
  }
}

describe('replaying the stored finished tournament (check 8, first half)', () => {
  it('gives the same champion and the same 14-place standings as the stored record', () => {
    expect(Object.keys(fixture.players)).toHaveLength(14);
    expect(Object.keys(fixture.winners)).toHaveLength(27);

    // Rebuild the seeding order from who sat where in round 1.
    const size = 16;
    const order = seedOrder(size);
    const seeded: (PlayerId | null)[] = Array(14).fill(null);
    fixture.round1.forEach(([a, b], i) => {
      if (a) seeded[order[2 * i] - 1] = a;
      if (b) seeded[order[2 * i + 1] - 1] = b;
    });
    expect(seeded.every((s) => s !== null)).toBe(true);

    const bracket = buildDoubleElim(seeded as PlayerId[], {
      idPrefix: 'po',
      mainFormat: fixture.config.playoffFormat as MatchFormat,
      grandFinalFormat: fixture.config.grandFinalFormat as MatchFormat,
      labelPrefix: '',
    });
    refresh(bracket);

    // Replay only the stored winners, match by match, in the order they become playable.
    const winners = fixture.winners as Record<string, string>;
    let decided = 0;
    let guard = 0;
    while (!isComplete(bracket) && guard++ < 500) {
      const m = bracket.matches.find((x) => x.winner === null && x.playerA && x.playerB);
      if (!m) break;
      const winner = winners[m.id];
      expect(winner).toBeDefined();
      const w = winsToWin(m.format);
      const aWon = winner === m.playerA;
      expect(aWon || winner === m.playerB).toBe(true);
      const res = reportScore(bracket, m.id, aWon ? w : 0, aWon ? 0 : w);
      expect(res.ok).toBe(true);
      decided++;
    }
    expect(decided).toBe(27);
    expect(isComplete(bracket)).toBe(true);

    const players = Object.fromEntries(
      Object.entries(fixture.players).map(([id, name]) => [id, { id, name }]),
    );
    const t: Tournament = {
      players,
      config: fixture.config as Tournament['config'],
      phase: 'done',
      groups: [],
      playoff: bracket,
      standings: [],
    };
    expect(champion(bracket)).toBe(fixture.storedChampion);
    expect(computeStandings(t)).toEqual(fixture.storedStandings);
    expect(fixture.storedStandings).toHaveLength(14);
  });
});

// Small deterministic random-number maker, so the seeding is the same on every run and on the web app.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('made-up 9-player tournament with groups ON (check 8, second half)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('gives the same champion and standings as the web app code gave for the same fixed winners', () => {
    jest.spyOn(Math, 'random').mockImplementation(mulberry32(12345));
    const people = ['Ann', 'Bob', 'Cat', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy'];
    // The fixed winners: whoever is earlier in this list always wins their match.
    const strength = ['Gus', 'Ann', 'Ivy', 'Dan', 'Fay', 'Bob', 'Hal', 'Cat', 'Eve'];

    let t = createTournament(people, config(false));
    expect(t.groups.map((g) => g.players.map((p) => t.players[p].name).sort())).toEqual([
      ['Ann', 'Bob', 'Eve', 'Gus', 'Hal'],
      ['Cat', 'Dan', 'Fay', 'Ivy'],
    ]);
    for (const g of t.groups) {
      playByStrength(g.bracket, t.players, strength, () => isComplete(g.bracket));
    }
    expect(groupsFinished(t)).toBe(true);
    t = { ...t, playoff: buildPlayoff(t), phase: 'playoff' };
    playByStrength(t.playoff!, t.players, strength, () => isComplete(t.playoff!));
    t.phase = 'done';

    // Re-run on the web app's code any time with scripts/compare-with-web-app.js (see its header).
    // These two results were produced by running the WEB app's own bracket code
    // (the old web app's src/lib) with the same random numbers and the same winners.
    expect(t.players[champion(t.playoff!)!].name).toBe('Gus');
    expect(computeStandings(t).map((id) => t.players[id].name)).toEqual([
      'Gus',
      'Ann',
      'Ivy',
      'Dan',
      'Bob',
      'Fay',
      'Eve',
      'Cat',
      'Hal',
    ]);
  });
});
