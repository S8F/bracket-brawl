// Points and points-table tests, copied from the web app (the old web app's scripts/test-points.ts).
// The web parts that tested the shared player list, the old local-storage classes (TournamentStore,
// summarize, KVStorage) and the 14 built-in players are NOT copied; they are replaced by the
// private-list and Supabase tests in repos.test.ts and tournamentSummary.test.ts.
//
// Covers: the points table with tied places, standings turned into points, open tournaments earn
// nothing, totals added across several finished tournaments, and players with 0 points still listed.

import { check } from './helpers/scriptCheck';
import { isComplete, reportResult } from '../src/lib/engine';
import { computeLeaderboard, pointsForPlacement, tournamentPoints } from '../src/lib/scoring';
import { computeStandings, createTournament } from '../src/lib/tournament';
import type { DoubleElimBracket, Tournament } from '../src/lib/types';

// Resolve a bracket fully by always picking playerA (deterministic).
function resolveBracket(b: DoubleElimBracket) {
  let guard = 0;
  while (!isComplete(b) && guard < 1000) {
    guard++;
    const open = b.matches.find((m) => m.winner === null && m.playerA && m.playerB);
    if (!open) break;
    reportResult(b, open.id, open.playerA!);
  }
}

// Build a fully-finished skip-groups tournament from a name list.
function finishedTournament(names: string[]): Tournament {
  const t = createTournament(names, {
    groupFormat: { kind: 'bestOf', n: 3 },
    playoffFormat: { kind: 'bestOf', n: 3 },
    grandFinalFormat: { kind: 'bestOf', n: 3 },
    skipGroups: true,
  });
  resolveBracket(t.playoff!);
  t.phase = 'done';
  t.standings = computeStandings(t);
  return t;
}

// --- pointsForPlacement table, incl. tied bands -----------------------------
test('pointsForPlacement table, incl. tied bands', () => {
  check(pointsForPlacement(1) === 1000, 'points: 1st = 1000');
  check(pointsForPlacement(2) === 700, 'points: 2nd = 700');
  check(pointsForPlacement(3) === 500, 'points: 3rd = 500');
  check(pointsForPlacement(4) === 350, 'points: 4th = 350');
  check(pointsForPlacement(5) === 200, 'points: 5th = 200');
  check(pointsForPlacement(6) === 200, 'points: 6th = 200 (tied band)');
  check(pointsForPlacement(7) === 100, 'points: 7th = 100');
  check(pointsForPlacement(8) === 100, 'points: 8th = 100 (tied band)');
  check(pointsForPlacement(9) === 50, 'points: 9th = 50');
  check(pointsForPlacement(12) === 50, 'points: 12th = 50 (tied band)');
  check(pointsForPlacement(16) === 50, 'points: 16th = 50 (tied band)');
  check(pointsForPlacement(17) === 25, 'points: 17th = 25');
  check(pointsForPlacement(40) === 25, 'points: 40th = 25');
  check(pointsForPlacement(0) === 0, 'points: 0 placement = 0');
});

// --- tournamentPoints maps standings onto the table -------------------------
test('tournamentPoints maps standings onto the table', () => {
  const t = finishedTournament(['A', 'B', 'C', 'D']);
  const standings = computeStandings(t);
  const pts = tournamentPoints(t);
  standings.forEach((pid, i) => {
    const name = t.players[pid].name.toLowerCase();
    check(
      pts.get(name) === pointsForPlacement(i + 1),
      `tournamentPoints: ${name} (rank ${i + 1}) = ${pointsForPlacement(i + 1)}`,
    );
  });
  check(
    pts.get(t.players[standings[0]].name.toLowerCase()) === 1000,
    'tournamentPoints: champion = 1000',
  );
});

// --- Open tournaments award nothing -----------------------------------------
test('Open tournaments award nothing', () => {
  const open = createTournament(['A', 'B', 'C', 'D']);
  const pts = tournamentPoints(open);
  check(pts.size === 0, 'open tournament: awards zero points');
  const lb = computeLeaderboard([open]);
  check(
    lb.every((r) => r.points === 0 && r.played === 0),
    'open tournament: contributes nothing to leaderboard',
  );
});

// --- Leaderboard aggregates across multiple finished tournaments ------------
test('Leaderboard aggregates across multiple finished tournaments', () => {
  const t1 = finishedTournament(['Alice', 'Bob', 'Carol', 'Dan']);
  const t2 = finishedTournament(['Alice', 'Bob', 'Eve']);

  const expected = new Map<string, number>();
  const add = (t: Tournament) => {
    computeStandings(t).forEach((pid, i) => {
      const key = t.players[pid].name.toLowerCase();
      expected.set(key, (expected.get(key) ?? 0) + pointsForPlacement(i + 1));
    });
  };
  add(t1);
  add(t2);

  const lb = computeLeaderboard([t1, t2]);
  for (const [key, want] of expected) {
    const row = lb.find((r) => r.name.toLowerCase() === key);
    check(
      row !== undefined && row.points === want,
      `leaderboard: ${key} total = ${want} (got ${row?.points})`,
    );
  }
  const alice = lb.find((r) => r.name.toLowerCase() === 'alice');
  const bob = lb.find((r) => r.name.toLowerCase() === 'bob');
  const eve = lb.find((r) => r.name.toLowerCase() === 'eve');
  check(alice?.played === 2, 'leaderboard: Alice played 2');
  check(bob?.played === 2, 'leaderboard: Bob played 2');
  check(eve?.played === 1, 'leaderboard: Eve played 1');
  for (let i = 1; i < lb.length; i++) {
    check(lb[i - 1].points >= lb[i].points, 'leaderboard: sorted high to low');
  }
  const totalWon = lb.reduce((s, r) => s + r.won, 0);
  check(totalWon === 2, 'leaderboard: exactly one winner per tournament');
});

// --- Saved players with zero points still appear ----------------------------
test('Saved players with zero points still appear', () => {
  const t1 = finishedTournament(['Alice', 'Bob']);
  const lb = computeLeaderboard([t1], ['Alice', 'Bob', 'Zara']);
  const zara = lb.find((r) => r.name === 'Zara');
  check(zara !== undefined, 'leaderboard: saved-only player appears');
  check(
    zara?.points === 0 && zara?.played === 0 && zara?.won === 0,
    'leaderboard: saved-only player at zero',
  );
});

// --- Open and finished mixed: only the finished one counts ------------------
// (replaces the web's store.leaderboard test; the phone app builds the table from a plain list)
test('Open and finished mixed: only the finished one counts', () => {
  const closed = finishedTournament(['Alice', 'Bob', 'Carol']);
  const open = createTournament(['Alice', 'Dan']);
  const lb = computeLeaderboard([closed, open], ['Alice', 'Bob', 'Carol', 'Dan', 'Zara']);
  const dan = lb.find((r) => r.name === 'Dan');
  check(dan?.points === 0 && dan?.played === 0, 'mixed: open-only player at 0');
  check(
    lb.some((r) => r.name === 'Zara' && r.points === 0),
    'mixed: saved-only player at 0',
  );
  const alice = lb.find((r) => r.name === 'Alice');
  check((alice?.points ?? 0) > 0, 'mixed: Alice has points from the finished tournament');
  check(alice?.played === 1, 'mixed: Alice played 1 (only the finished one counts)');
});
