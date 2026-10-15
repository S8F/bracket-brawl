// Round-name derivation tests. Names must come from bracket STRUCTURE
// (side + round depth), not a hardcoded lookup by player count.
// Copied from the old web app (scripts/test-round-names.ts). Run with: npm test

import { check } from './helpers/scriptCheck';
import { buildDoubleElim } from '../src/lib/doubleElim';
import { recordWin, refresh } from '../src/lib/engine';
import { roundColumnLabel, roundName, shortRoundName } from '../src/lib/roundNames';
import type { DoubleElimBracket, Match } from '../src/lib/types';

function names(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `P${i + 1}`);
}

function build(n: number): DoubleElimBracket {
  const ids = names(n);
  const b = buildDoubleElim(ids, {
    idPrefix: 'po',
    mainFormat: { kind: 'bestOf', n: 3 },
    grandFinalFormat: { kind: 'bestOf', n: 5 },
    labelPrefix: '',
  });
  refresh(b);
  return b;
}

// Collect the set of round names produced for a bracket.
function allNames(b: DoubleElimBracket): Set<string> {
  return new Set(b.matches.map((m) => roundName(b, m)));
}

// --- 8 players: a "Top 8" double-elim should expose proper finals. ---
test('8 players: a "Top 8" double-elim should expose proper finals.', () => {
  const b = build(8);
  const ns = allNames(b);
  check(ns.has('Grand Final'), '8p: has Grand Final');
  check(ns.has('Winners Final'), '8p: has Winners Final');
  check(ns.has('Winners Semi-Final'), '8p: has Winners Semi-Final');
  check(ns.has('Winners Round 1'), '8p: has Winners Round 1');
  check(ns.has('Losers Final'), '8p: has Losers Final');
  check(ns.has('Losers Semi-Final'), '8p: has Losers Semi-Final');
  // No raw "Round N" without a side prefix should leak out.
  check(
    [...ns].every((x) => !/^Round \d/.test(x)),
    '8p: every name is side-qualified or a final',
  );
});

// --- 16 players: deeper bracket should still name semis/finals correctly. ---
test('16 players: deeper bracket should still name semis/finals correctly.', () => {
  const b = build(16);
  const ns = allNames(b);
  check(ns.has('Winners Final'), '16p: Winners Final');
  check(ns.has('Winners Semi-Final'), '16p: Winners Semi-Final');
  check(ns.has('Winners Round 1'), '16p: Winners Round 1');
  check(ns.has('Winners Round 2'), '16p: Winners Round 2');
  check(ns.has('Losers Final'), '16p: Losers Final');
  check(ns.has('Losers Semi-Final'), '16p: Losers Semi-Final');
  check(ns.has('Grand Final'), '16p: Grand Final');
});

// --- Grand Final RESET: should be named once it is actually triggered. ---
test('Grand Final RESET: should be named once it is actually triggered.', () => {
  // 2 players is the simplest reset path: WB final loser drops to the GF,
  // and if they win, the reset fires.
  const b = build(2);
  // resolve WB final (the only winners match): make player B win so they then
  // also need to be beaten in the GF — actually drive a reset:
  // Find WB final, let A win; then GF: let the LB player (B) win -> reset.
  const wbFinal = b.matches.find((m) => m.side === 'winners') as Match;
  recordWin(b, wbFinal.id, wbFinal.playerA!);
  refresh(b);
  const gf = b.matches.find((m) => m.side === 'grandFinal' && m.round === 1) as Match;
  // GF slot a = WB winner, slot b = WB loser. Make slot b (LB player) win.
  recordWin(b, gf.id, gf.playerB!);
  refresh(b);
  const reset = b.matches.find((m) => m.side === 'grandFinal' && m.round === 2) as Match;
  check(!!reset && (!!reset.playerA || !!reset.playerB), '2p: reset triggered');
  check(
    roundName(b, reset) === 'Grand Final (Reset)',
    `2p: reset named correctly (got "${roundName(b, reset)}")`,
  );
  check(roundName(b, gf) === 'Grand Final', '2p: first GF still named Grand Final');
});

// --- Group prefix + column labels. ---
test('Group prefix + column labels.', () => {
  const b = build(8);
  const wf = b.matches.find((m) => roundName(b, m) === 'Winners Final') as Match;
  check(roundName(b, wf, 'Group A') === 'Group A Winners Final', 'group prefix applied');
  check(
    roundColumnLabel(b, 'winners', wf.round) === 'Final',
    "column label for winners final is 'Final'",
  );
  check(
    roundColumnLabel(b, 'winners', wf.round - 1) === 'Semi-Final',
    "column label one before final is 'Semi-Final'",
  );
  check(roundColumnLabel(b, 'winners', 1) === 'Round 1', "column label round 1 is 'Round 1'");
  check(roundColumnLabel(b, 'grandFinal', 1) === 'Final', 'GF column = Final');
  check(roundColumnLabel(b, 'grandFinal', 2) === 'Reset', 'GF reset column');
});

// --- Short names. ---
test('Short names.', () => {
  check(shortRoundName('Winners Round 2') === 'W R2', 'short W R2');
  check(shortRoundName('Losers Semi-Final') === 'L Semi', 'short L Semi');
  check(shortRoundName('Winners Final') === 'W Final', 'short W Final');
  check(shortRoundName('Grand Final') === 'Grand Final', 'short Grand Final');
  check(shortRoundName('Grand Final (Reset)') === 'GF Reset', 'short GF Reset');
  check(shortRoundName('Group A Winners Final') === 'W Final', 'short strips group prefix');
});

// --- Graceful fallback: a bracket with only a single round must not crash and
// should still name its final. (3-player bracket has shallow losers side.) ---
test('block 6', () => {
  const b = build(3);
  for (const m of b.matches) {
    const name = roundName(b, m);
    check(typeof name === 'string' && name.length > 0, '3p: every match named');
  }
});
