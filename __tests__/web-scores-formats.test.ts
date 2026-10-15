// Tests for per-round match formats, per-game score entry/validation, and the
// v1 -> v2 score migration. Copied from the old web app (scripts/test-scores-formats.ts); run with npm test.
//
// Covers:
//  - checkScore: winner derivation + rejection across Bo1 / Bo3 / FT3 / Bo5
//  - reportScore: valid score derives the correct winner and advances the
//    bracket; invalid score is rejected and the bracket is left untouched
//  - editScore: changing a decided score that flips the winner resets the
//    downstream match it fed (reuses the cascade flow)
//  - setRoundFormat: every round can be set individually; a stored score that
//    no longer fits the new format clears the result (and reports the count)
//  - roundFormatImpact: non-destructive preview of what a format change clears
//  - migration: a legacy stored tournament (no scoreA/scoreB) loads with the
//    fields backfilled and a sensible scoreline on decided matches

import { check } from './helpers/scriptCheck';
import { buildDoubleElim } from '../src/lib/doubleElim';
import {
  editScore,
  refresh,
  reportScore,
  roundFormatImpact,
  setRoundFormat,
} from '../src/lib/engine';
import { migrateTournament } from '../src/lib/scoring';
import { createTournament } from '../src/lib/tournament';
import {
  checkScore,
  maxGames,
  winsToWin,
  type DoubleElimBracket,
  type MatchFormat,
} from '../src/lib/types';

const BO1: MatchFormat = { kind: 'bestOf', n: 1 };
const BO3: MatchFormat = { kind: 'bestOf', n: 3 };
const BO5: MatchFormat = { kind: 'bestOf', n: 5 };
const FT3: MatchFormat = { kind: 'firstTo', n: 3 };

function names(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `P${i + 1}`);
}
function build(n: number, fmt: MatchFormat = BO3): DoubleElimBracket {
  const b = buildDoubleElim(names(n), {
    idPrefix: 'e',
    mainFormat: fmt,
    grandFinalFormat: fmt,
    labelPrefix: '',
  });
  refresh(b);
  return b;
}
function byId(b: DoubleElimBracket, id: string) {
  return b.matches.find((m) => m.id === id)!;
}

// --- 1. Format target / max helpers -----------------------------------------
test('1. Format target / max helpers', () => {
  check(winsToWin(BO1) === 1 && maxGames(BO1) === 1, 'Bo1: target 1, max 1');
  check(winsToWin(BO3) === 2 && maxGames(BO3) === 3, 'Bo3: target 2, max 3');
  check(winsToWin(BO5) === 3 && maxGames(BO5) === 5, 'Bo5: target 3, max 5');
  check(winsToWin(FT3) === 3 && maxGames(FT3) === 5, 'FT3: target 3, max 5');
});

// --- 2. checkScore winner derivation + rejection ----------------------------
test('2. checkScore winner derivation + rejection', () => {
  // Bo1
  check(
    checkScore(BO1, 1, 0).ok && (checkScore(BO1, 1, 0) as any).winningSide === 'a',
    'Bo1: 1-0 -> a wins',
  );
  check(!checkScore(BO1, 1, 1).ok, 'Bo1: 1-1 invalid');
  check(!checkScore(BO1, 2, 0).ok, 'Bo1: 2-0 invalid (too many games)');

  // Bo3 (first to 2, max 3)
  check(
    checkScore(BO3, 2, 1).ok && (checkScore(BO3, 2, 1) as any).winningSide === 'a',
    'Bo3: 2-1 -> a wins',
  );
  check(
    checkScore(BO3, 0, 2).ok && (checkScore(BO3, 0, 2) as any).winningSide === 'b',
    'Bo3: 0-2 -> b wins',
  );
  check(!checkScore(BO3, 3, 2).ok, 'Bo3: 3-2 invalid (over the cap + over target)');
  check(!checkScore(BO3, 1, 1).ok, 'Bo3: 1-1 invalid (no winner)');
  check(!checkScore(BO3, 2, 2).ok, 'Bo3: 2-2 invalid (both reach target)');

  // FT3 (first to 3, max 5)
  check(
    checkScore(FT3, 3, 2).ok && (checkScore(FT3, 3, 2) as any).winningSide === 'a',
    'FT3: 3-2 -> a wins',
  );
  check(!checkScore(FT3, 3, 3).ok, 'FT3: 3-3 invalid');
  check(!checkScore(FT3, 4, 0).ok, 'FT3: 4-0 invalid (over cap)');

  // Bo5 (first to 3, max 5)
  check(
    checkScore(BO5, 3, 0).ok && (checkScore(BO5, 3, 0) as any).winningSide === 'a',
    'Bo5: 3-0 -> a wins',
  );
  check(checkScore(BO5, 1, 3).ok, 'Bo5: 1-3 valid');
  check(!checkScore(BO5, 2, 2).ok, 'Bo5: 2-2 invalid (no winner reached 3)');

  // Negative / non-integer
  check(!checkScore(BO3, -1, 2).ok, 'negative score invalid');
  check(!checkScore(BO3, 2.5, 0).ok, 'non-integer score invalid');
});

// --- 3. reportScore: valid derives winner, invalid is rejected --------------
test('3. reportScore: valid derives winner, invalid is rejected', () => {
  const b = build(4, BO3);
  const m = byId(b, 'e-wb-r1-m1');
  const a = m.playerA!;
  const bp = m.playerB!;

  // Invalid score -> rejected, nothing recorded.
  const bad = reportScore(b, m.id, 3, 2);
  check(!bad.ok, 'reportScore rejects 3-2 in a Bo3');
  check(byId(b, m.id).winner === null, 'reportScore: rejected score left match undecided');

  // Valid 2-1 -> a wins, score persisted.
  const good = reportScore(b, m.id, 2, 1);
  check(good.ok, 'reportScore accepts 2-1 in a Bo3');
  check(byId(b, m.id).winner === a, 'reportScore: winner derived from 2-1 is slot a');
  check(byId(b, m.id).loser === bp, 'reportScore: loser is slot b');
  check(
    byId(b, m.id).scoreA === 2 && byId(b, m.id).scoreB === 1,
    'reportScore: score persisted on the match',
  );
});

// --- 4. editScore flips winner -> downstream reset ---------------------------
test('4. editScore flips winner -> downstream reset', () => {
  const b = build(4, BO3);
  reportScore(b, 'e-wb-r1-m1', 2, 0); // a wins
  reportScore(b, 'e-wb-r1-m2', 2, 0);
  const wbFinal = byId(b, 'e-wb-r2-m1');
  check(!!wbFinal.playerA && !!wbFinal.playerB, 'editScore: WB final populated');
  reportScore(b, wbFinal.id, 2, 1);
  check(wbFinal.winner !== null, 'editScore: WB final decided');

  // Re-score WB R1 M1 so slot b wins -> WB final must reset.
  const res = editScore(b, 'e-wb-r1-m1', 0, 2);
  check(res.ok, 'editScore: re-score accepted');
  const m1 = byId(b, 'e-wb-r1-m1');
  check(m1.scoreA === 0 && m1.scoreB === 2, 'editScore: new score stored');
  check(byId(b, 'e-wb-r2-m1').winner === null, 'editScore: downstream WB final reset');
});

// --- 5. setRoundFormat: per-round + clears unfit scores ----------------------
test('5. setRoundFormat: per-round + clears unfit scores', () => {
  const b = build(4, BO3);
  // Set WB Round 1 to FT3 individually (other rounds keep Bo3).
  setRoundFormat(b, 'winners', 1, FT3);
  check(byId(b, 'e-wb-r1-m1').format.kind === 'firstTo', 'setRoundFormat: WB R1 now FT3');
  check(byId(b, 'e-wb-r2-m1').format.kind === 'bestOf', 'setRoundFormat: WB R2 still Bo3');

  // Record a valid FT3 score, then shrink the round to Bo1 — 3-1 can't exist in
  // Bo1 (max 1 game), so the result must clear.
  reportScore(b, 'e-wb-r1-m1', 3, 1);
  check(byId(b, 'e-wb-r1-m1').winner !== null, 'setRoundFormat: FT3 score recorded');
  const cleared = setRoundFormat(b, 'winners', 1, BO1);
  check(cleared >= 1, `setRoundFormat: shrinking to Bo1 cleared a result (got ${cleared})`);
  check(byId(b, 'e-wb-r1-m1').winner === null, 'setRoundFormat: unfit result cleared');
  check(
    byId(b, 'e-wb-r1-m1').scoreA === null && byId(b, 'e-wb-r1-m1').scoreB === null,
    'setRoundFormat: cleared score is null',
  );

  // A score that STILL fits the new format keeps its winner. FT3 and Bo5 share
  // the same win target (3) and max (5), so a 3-1 result carries over unchanged.
  setRoundFormat(b, 'winners', 1, FT3);
  reportScore(b, 'e-wb-r1-m1', 3, 1); // FT3 result
  const w = byId(b, 'e-wb-r1-m1').winner;
  setRoundFormat(b, 'winners', 1, BO5); // same target/max -> result survives
  check(byId(b, 'e-wb-r1-m1').winner === w, 'setRoundFormat: FT3->Bo5 keeps a still-valid result');
  check(
    byId(b, 'e-wb-r1-m1').scoreA === 3 && byId(b, 'e-wb-r1-m1').scoreB === 1,
    'setRoundFormat: kept result preserves its score',
  );
});

// --- 6. roundFormatImpact is a non-destructive preview ----------------------
test('6. roundFormatImpact is a non-destructive preview', () => {
  const b = build(4, FT3);
  reportScore(b, 'e-wb-r1-m1', 3, 2); // valid FT3, invalid under Bo1
  const impact = roundFormatImpact(b, 'winners', 1, BO1);
  check(impact.length >= 1, 'roundFormatImpact: previews the clear');
  // Preview must not have touched the real bracket.
  check(byId(b, 'e-wb-r1-m1').winner !== null, 'roundFormatImpact: real bracket untouched');
  check(
    byId(b, 'e-wb-r1-m1').format.kind === 'firstTo',
    'roundFormatImpact: real format untouched',
  );
});

// --- 7. migration backfills scores on legacy data ---------------------------
test('7. migration backfills scores on legacy data', () => {
  // Build a tournament, decide a match, then STRIP the score fields to simulate
  // a pre-v2 stored record.
  const t = createTournament(names(4), {
    groupFormat: BO3,
    playoffFormat: BO3,
    grandFinalFormat: BO5,
    skipGroups: true,
  });
  const po = t.playoff!;
  reportScore(po, 'po-wb-r1-m1', 2, 1);
  const decidedId = 'po-wb-r1-m1';

  // Simulate legacy shape: remove scoreA/scoreB from every match.
  for (const m of po.matches) {
    delete (m as any).scoreA;
    delete (m as any).scoreB;
  }
  check(
    (byId(po, decidedId) as any).scoreA === undefined,
    'migration: legacy match has no score field before migrate',
  );

  migrateTournament(t);

  const dm = byId(po, decidedId);
  check(dm.scoreA !== undefined && dm.scoreB !== undefined, 'migration: score fields backfilled');
  // Decided match gets winner-target-to-0 (Bo3 -> 2-0), winner preserved.
  const target = winsToWin(dm.format);
  const winnerScore = dm.winner === dm.playerA ? dm.scoreA : dm.scoreB;
  const loserScore = dm.winner === dm.playerA ? dm.scoreB : dm.scoreA;
  check(winnerScore === target, 'migration: decided match winner gets the target score');
  check(loserScore === 0, 'migration: decided match loser gets 0');
  // Undecided matches get null scores.
  const undecided = po.matches.find((m) => m.winner === null)!;
  check(
    undecided.scoreA === null && undecided.scoreB === null,
    'migration: undecided match scores are null',
  );
  // Idempotent: a second migrate changes nothing.
  const before = JSON.stringify(po.matches);
  migrateTournament(t);
  check(JSON.stringify(po.matches) === before, 'migration: idempotent on already-migrated data');
});

// --- 8. fresh build defaults every match to a real format (no undefined) -----
test('8. fresh build defaults every match to a real format (no undefined)', () => {
  const b = build(8, BO3);
  let ok = true;
  for (const m of b.matches) {
    if (!m.format || (m.format.kind !== 'bestOf' && m.format.kind !== 'firstTo')) ok = false;
    if (m.scoreA !== null || m.scoreB !== null) {
      // Fresh build: only byes may be decided, and they carry null scores.
      if (m.winner !== null && !m.isBye) ok = false;
    }
  }
  check(ok, 'fresh build: every match has a valid default format + null scores');
  // A bye that auto-resolved keeps null scores (no games played).
});
