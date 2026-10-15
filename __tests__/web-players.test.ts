// Player-operation tests: replace identity (keeps results, blocks duplicates)
// and add player (rebuilds to a valid bracket).
// Copied from the old web app (scripts/test-players.ts). Run with: npm test

import { check } from './helpers/scriptCheck';
import { isComplete, recordWin, refresh, reportResult } from '../src/lib/engine';
import {
  PlayerOpError,
  addPlayer,
  participantNames,
  replacePlayerIdentity,
} from '../src/lib/players';
import { buildPlayoff, computeStandings, createTournament } from '../src/lib/tournament';
import type { DoubleElimBracket, Tournament } from '../src/lib/types';

const expectThrow = (fn: () => unknown, label: string) => {
  try {
    fn();
    check(false, `${label}: expected PlayerOpError, got none`);
  } catch (e) {
    check(e instanceof PlayerOpError, `${label}: threw PlayerOpError`);
  }
};

function resolveBracket(b: DoubleElimBracket) {
  let guard = 0;
  while (!isComplete(b) && guard < 1000) {
    guard++;
    const open = b.matches.find((m) => m.winner === null && m.playerA && m.playerB);
    if (!open) break;
    reportResult(b, open.id, open.playerA!);
  }
}

// --- Replace identity: keeps results, swaps the name everywhere. ---
test('Replace identity: keeps results, swaps the name everywhere.', () => {
  const t = createTournament(['Alice', 'Bob', 'Carol', 'Dave']);
  // Play one match in the playoff so there is a recorded result to preserve.
  const m = t.playoff!.matches.find((mm) => mm.winner === null && mm.playerA && mm.playerB)!;
  recordWin(t.playoff!, m.id, m.playerA!);
  refresh(t.playoff!);
  const decided = t.playoff!.matches.filter((x) => x.winner !== null);
  const winsBefore = decided.length;
  check(winsBefore > 0, 'replace: a result exists before swap');

  // Replace the player who has the FIRST recorded win with a substitute.
  const winnerId = decided[0].winner!;
  const oldName = t.players[winnerId].name;
  const t2 = replacePlayerIdentity(t, winnerId, 'Sub');

  check(t2.players[winnerId].name === 'Sub', 'replace: name changed');
  check(
    participantNames(t2).filter((n) => n === oldName).length === 0,
    'replace: old name no longer present',
  );
  // The match results (winner ids) are identical — same id, kept its win.
  const winsAfter = t2.playoff!.matches.filter((x) => x.winner !== null).length;
  check(winsAfter === winsBefore, 'replace: result count unchanged');
  check(
    t2.playoff!.matches.find((x) => x.id === decided[0].id)!.winner === winnerId,
    'replace: winner id of that match preserved',
  );
  check(
    Object.keys(t2.players).length === Object.keys(t.players).length,
    'replace: field size unchanged',
  );
  // Original tournament untouched (pure function).
  check(t.players[winnerId].name === oldName, 'replace: original unmutated');
});

// --- Replace blocks duplicates and bad input. ---
test('Replace blocks duplicates and bad input.', () => {
  const t = createTournament(['Alice', 'Bob', 'Carol', 'Dave']);
  const ids = Object.keys(t.players);
  expectThrow(() => replacePlayerIdentity(t, ids[0], 'Bob'), 'replace with existing name');
  expectThrow(
    () => replacePlayerIdentity(t, ids[0], 'bob'),
    'replace with existing name (case-insensitive)',
  );
  expectThrow(() => replacePlayerIdentity(t, ids[0], '  '), 'replace with blank name');
  expectThrow(() => replacePlayerIdentity(t, 'no-such-id', 'Zed'), 'replace unknown player');
  // Renaming to your own name (casing refresh) is allowed.
  let ok = true;
  try {
    replacePlayerIdentity(t, ids[0], t.players[ids[0]].name.toUpperCase());
  } catch {
    ok = false;
  }
  check(ok, 'replace: re-casing own name allowed');
});

// --- Add player: rebuilds to a valid bracket of the new size, config kept. ---
function validateRebuild(t: Tournament, expectedCount: number, label: string) {
  check(
    Object.keys(t.players).length === expectedCount,
    `${label}: player count = ${expectedCount}`,
  );
  // Rebuild must produce a resolvable bracket (or groups that lead to one).
  let tt = t;
  if (tt.phase === 'groups') {
    for (const g of tt.groups) resolveBracket(g.bracket);
    // Build playoff via the standard path.
    tt = { ...tt, playoff: buildPlayoff(tt), phase: 'playoff' };
  }
  check(tt.playoff !== null, `${label}: playoff exists after rebuild`);
  resolveBracket(tt.playoff!);
  check(isComplete(tt.playoff!), `${label}: rebuilt bracket completes`);
  const standings = computeStandings(tt);
  check(standings.length === expectedCount, `${label}: standings cover all (${standings.length})`);
  check(new Set(standings).size === standings.length, `${label}: no duplicate standings`);
}

test('block 3', () => {
  // Small field (no groups): 4 -> 5.
  const t = createTournament(['Alice', 'Bob', 'Carol', 'Dave']);
  const t2 = addPlayer(t, 'Eve');
  check(participantNames(t2).includes('Eve'), 'add: new player present');
  check(participantNames(t).includes('Eve') === false, 'add: original unmutated');
  validateRebuild(t2, 5, 'add 4->5');

  // Odd -> even and even -> odd both produce valid brackets.
  const t3 = addPlayer(t2, 'Frank');
  validateRebuild(t3, 6, 'add 5->6');
});

test('block 4', () => {
  // Crossing the groups threshold: 8 -> 9 should switch into the group phase
  // and still build a valid full tournament.
  const names = Array.from({ length: 8 }, (_, i) => `P${i + 1}`);
  const t = createTournament(names);
  check(t.phase === 'playoff', 'add: 8 players is single bracket');
  const t2 = addPlayer(t, 'P9');
  check(t2.phase === 'groups', 'add: 9 players switches to groups');
  validateRebuild(t2, 9, 'add 8->9 (into groups)');
});

test('block 5', () => {
  // Add blocks duplicates + blanks.
  const t = createTournament(['Alice', 'Bob']);
  expectThrow(() => addPlayer(t, 'Alice'), 'add existing name');
  expectThrow(() => addPlayer(t, 'alice'), 'add existing name (case)');
  expectThrow(() => addPlayer(t, '   '), 'add blank name');
});

test('block 6', () => {
  // Config (formats + skipGroups) is preserved across a rebuild.
  const cfg = {
    groupFormat: { kind: 'bestOf' as const, n: 3 },
    playoffFormat: { kind: 'firstTo' as const, n: 2 },
    grandFinalFormat: { kind: 'firstTo' as const, n: 3 },
    skipGroups: true,
  };
  const t = createTournament(['Alice', 'Bob', 'Carol', 'Dave'], cfg);
  const t2 = addPlayer(t, 'Eve');
  check(t2.config.skipGroups === true, 'add: skipGroups preserved');
  check(
    t2.config.playoffFormat.kind === 'firstTo' && t2.config.playoffFormat.n === 2,
    'add: playoff format preserved',
  );
  check(t2.phase === 'playoff', 'add: skipGroups stays single bracket');
});
