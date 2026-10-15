// Standalone sanity test for the bracket engine.
// Copied from the old web app (scripts/test-engine.ts). Run with: npm test
// Simulates full tournaments for several player counts, always picking
// playerA as winner (deterministic), and asserts each phase resolves to a
// single champion with full standings and no stuck matches.

import { check } from './helpers/scriptCheck';
import { buildDoubleElim } from '../src/lib/doubleElim';
import { champion, isComplete, refresh, reportResult } from '../src/lib/engine';
import type { DoubleElimBracket } from '../src/lib/types';

function names(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `P${i + 1}`);
}

// Tiny deterministic pseudo-random generator (mulberry32) so the randomized
// winner runs below are reproducible from a fixed seed.
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

// Resolve a double-elim bracket by always picking playerA, return champion.
function runBracket(b: DoubleElimBracket): string | null {
  let guard = 0;
  while (!isComplete(b) && guard < 500) {
    guard++;
    const open = b.matches.find((m) => m.winner === null && m.playerA && m.playerB);
    if (!open) break;
    reportResult(b, open.id, open.playerA!);
  }
  return champion(b);
}

// Resolve a bracket picking a random side each match (seeded). This exercises
// the losers-bracket drop ordering and reset-from-either-side paths that the
// always-pick-A runs never reach.
function runBracketRandom(b: DoubleElimBracket, rng: () => number): string | null {
  let guard = 0;
  while (!isComplete(b) && guard < 500) {
    guard++;
    const open = b.matches.find((m) => m.winner === null && m.playerA && m.playerB);
    if (!open) break;
    const pick = rng() < 0.5 ? open.playerA! : open.playerB!;
    reportResult(b, open.id, pick);
  }
  return champion(b);
}

for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 11, 16, 24, 32]) {
  const ids = names(n);
  const b = buildDoubleElim(ids, {
    idPrefix: 't',
    mainFormat: { kind: 'bestOf', n: 3 },
    grandFinalFormat: { kind: 'bestOf', n: 5 },
    labelPrefix: '',
  });
  // need to refresh to resolve initial byes
  refresh(b);
  const champ = runBracket(b);
  check(champ !== null || n === 0, `n=${n}: has a champion (got ${champ})`);
  check(isComplete(b), `n=${n}: bracket completes`);
  check(
    b.placements.length === n,
    `n=${n}: placements covers all players (got ${b.placements.length})`,
  );
  // No duplicate placements.
  check(new Set(b.placements).size === b.placements.length, `n=${n}: no duplicate placements`);
}

// Test grand-final bracket reset path: pick the LB player in GF1.
test('block 1', () => {
  const ids = names(4);
  const b = buildDoubleElim(ids, {
    idPrefix: 'r',
    mainFormat: { kind: 'bestOf', n: 3 },
    grandFinalFormat: { kind: 'bestOf', n: 5 },
    labelPrefix: '',
  });
  refresh(b);
  let guard = 0;
  while (!isComplete(b) && guard < 200) {
    guard++;
    const gf = b.matches.find((m) => m.side === 'grandFinal' && m.round === 1);
    if (gf && gf.winner === null && gf.playerA && gf.playerB) {
      // LB player is slot b -> pick playerB to force a reset.
      reportResult(b, gf.id, gf.playerB!);
      continue;
    }
    const open = b.matches.find((m) => m.winner === null && m.playerA && m.playerB);
    if (!open) break;
    reportResult(b, open.id, open.playerA!);
  }
  const reset = b.matches.find((m) => m.id === 'r-gf-reset');
  check(!!reset && !!reset.playerA && !!reset.playerB, 'reset got triggered');
  check(isComplete(b), 'reset bracket completes');
});

// Test First-to-N formats: every ordinary match carries the main format,
// the grand final carries its own, and the bracket still resolves cleanly.
test('block 2', () => {
  const ids = names(8);
  const b = buildDoubleElim(ids, {
    idPrefix: 'ft',
    mainFormat: { kind: 'firstTo', n: 3 },
    grandFinalFormat: { kind: 'firstTo', n: 5 },
    labelPrefix: '',
  });
  refresh(b);
  const ordinary = b.matches.filter((m) => m.side !== 'grandFinal');
  const gfs = b.matches.filter((m) => m.side === 'grandFinal');
  check(
    ordinary.every((m) => m.format.kind === 'firstTo' && m.format.n === 3),
    'firstTo: all ordinary matches are FT3',
  );
  check(
    gfs.every((m) => m.format.kind === 'firstTo' && m.format.n === 5),
    'firstTo: grand final matches are FT5',
  );
  const champ = runBracket(b);
  check(champ !== null, 'firstTo: bracket resolves to a champion');
  check(isComplete(b), 'firstTo: bracket completes');
});

// Randomized-winner runs (seeded, reproducible): pick a random side every
// match across many runs and player counts, to permanently exercise the
// losers-bracket and reset-from-the-other-side paths the pick-A runs skip.
test('block 3', () => {
  const rng = makeRng(0x7e44e7); // fixed seed -> reproducible
  for (const n of [2, 3, 4, 5, 8, 11, 16, 24]) {
    for (let trial = 0; trial < 25; trial++) {
      const b = buildDoubleElim(names(n), {
        idPrefix: 'rnd',
        mainFormat: { kind: 'bestOf', n: 3 },
        grandFinalFormat: { kind: 'bestOf', n: 5 },
        labelPrefix: '',
      });
      refresh(b);
      const champ = runBracketRandom(b, rng);
      check(champ !== null, `random n=${n} #${trial}: has a champion`);
      check(isComplete(b), `random n=${n} #${trial}: completes`);
      check(
        b.placements.length === n,
        `random n=${n} #${trial}: placements cover all (${b.placements.length})`,
      );
      check(
        new Set(b.placements).size === b.placements.length,
        `random n=${n} #${trial}: no duplicate placements`,
      );
    }
  }
});
