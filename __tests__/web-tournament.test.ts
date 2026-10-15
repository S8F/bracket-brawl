// Full tournament flow test: create -> resolve groups -> build playoff ->
// resolve playoff -> standings. Run: npx tsx scripts/test-tournament.ts

import { check } from './helpers/scriptCheck';
import { isComplete, reportResult } from '../src/lib/engine';
import {
  InvalidTournamentError,
  advancersFromGroups,
  buildPlayoff,
  computeStandings,
  createTournament,
  groupsComplete,
} from '../src/lib/tournament';
import type { DoubleElimBracket, TournamentConfig } from '../src/lib/types';

// Tiny deterministic pseudo-random generator (mulberry32) for reproducible
// randomized-winner runs.
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveBracket(b: DoubleElimBracket, rng?: () => number) {
  let guard = 0;
  while (!isComplete(b) && guard < 1000) {
    guard++;
    const open = b.matches.find((m) => m.winner === null && m.playerA && m.playerB);
    if (!open) break;
    const pick = rng && rng() < 0.5 ? open.playerB! : open.playerA!;
    reportResult(b, open.id, pick);
  }
}

// --- Input validation: the engine must reject bad input itself, not trust
// the UI. Covers duplicate names, empty input, 1 player, and a valid 2.
test('block 1', () => {
  const expectInvalid = (fn: () => unknown, label: string) => {
    try {
      fn();
      check(false, `${label}: expected InvalidTournamentError, got none`);
    } catch (e) {
      check(e instanceof InvalidTournamentError, `${label}: threw InvalidTournamentError`);
    }
  };

  expectInvalid(() => createTournament(['Dup', 'Dup']), 'duplicate names');
  expectInvalid(() => createTournament(['Dup', 'dup']), 'duplicate names (case-insensitive)');
  expectInvalid(() => createTournament([]), 'empty input');
  expectInvalid(() => createTournament(['', '  ']), 'blank-only input');
  expectInvalid(() => createTournament(['Solo']), 'single player');

  let twoOk = true;
  try {
    const t2 = createTournament(['A', 'B']);
    twoOk = t2.phase === 'playoff' && Object.keys(t2.players).length === 2;
  } catch {
    twoOk = false;
  }
  check(twoOk, 'two valid players: builds a tournament');
});

for (const n of [4, 8, 12, 16, 20, 24, 32]) {
  const names = Array.from({ length: n }, (_, i) => `Player${i + 1}`);
  let t = createTournament(names);

  if (t.phase === 'groups') {
    for (const g of t.groups) resolveBracket(g.bracket);
    check(groupsComplete(t), `n=${n}: groups complete`);
    const adv = advancersFromGroups(t);
    check(adv.length >= 2, `n=${n}: at least 2 advance (${adv.length})`);
    t = { ...t, playoff: buildPlayoff(t), phase: 'playoff' };
  }

  check(t.playoff !== null, `n=${n}: playoff exists`);
  resolveBracket(t.playoff!);
  check(isComplete(t.playoff!), `n=${n}: playoff completes`);

  const standings = computeStandings(t);
  check(standings.length === n, `n=${n}: standings cover all (${standings.length})`);
  check(new Set(standings).size === standings.length, `n=${n}: no dup standings`);
}

// Skip-groups path: with skipGroups on, even a large field goes straight to
// ONE double-elim bracket (no groups), using the chosen First-to-N formats.
test('block 2', () => {
  const cfg: TournamentConfig = {
    groupFormat: { kind: 'bestOf', n: 3 },
    playoffFormat: { kind: 'firstTo', n: 2 },
    grandFinalFormat: { kind: 'firstTo', n: 3 },
    skipGroups: true,
  };
  for (const n of [4, 12, 20]) {
    const names = Array.from({ length: n }, (_, i) => `Player${i + 1}`);
    const t = createTournament(names, cfg);
    check(t.phase === 'playoff', `skip n=${n}: starts in playoff phase`);
    check(t.groups.length === 0, `skip n=${n}: no groups created`);
    check(t.playoff !== null, `skip n=${n}: single bracket exists`);
    const ordinary = t.playoff!.matches.filter((m) => m.side !== 'grandFinal');
    check(
      ordinary.every((m) => m.format.kind === 'firstTo' && m.format.n === 2),
      `skip n=${n}: bracket matches use FT2`,
    );
    resolveBracket(t.playoff!);
    check(isComplete(t.playoff!), `skip n=${n}: bracket completes`);
    const standings = computeStandings(t);
    check(standings.length === n, `skip n=${n}: standings cover all (${standings.length})`);
  }
});

// Randomized-winner full-tournament runs (seeded, reproducible): resolve
// groups AND playoff by picking a random side each match, so the losers-bracket
// and reset paths are exercised end to end, not just with always-pick-A.
test('block 3', () => {
  const rng = makeRng(0x5eed42);
  for (const n of [4, 8, 12, 16, 24, 32]) {
    const names = Array.from({ length: n }, (_, i) => `Player${i + 1}`);
    let t = createTournament(names);
    if (t.phase === 'groups') {
      for (const g of t.groups) resolveBracket(g.bracket, rng);
      check(groupsComplete(t), `random n=${n}: groups complete`);
      t = { ...t, playoff: buildPlayoff(t), phase: 'playoff' };
    }
    resolveBracket(t.playoff!, rng);
    check(isComplete(t.playoff!), `random n=${n}: playoff completes`);
    const standings = computeStandings(t);
    check(standings.length === n, `random n=${n}: standings cover all (${standings.length})`);
    check(new Set(standings).size === standings.length, `random n=${n}: no dup standings`);
  }
});
