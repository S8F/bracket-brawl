// Tests for correcting a decided match outcome (misclick fix) and its
// downstream recompute. Run: npx tsx scripts/test-edit-outcome.ts
//
// Covers:
//  - downstreamImpact preview is non-destructive and accurate
//  - clean flip of a leaf match with NO downstream (no resets)
//  - flipping an early winners-bracket match that already fed a later match
//    -> the later match is RESET (result cleared) and re-resolves from the
//       corrected feeder
//  - flipping a result that changes the CHAMPION -> standings / points /
//    Open-Closed status all update (they derive from the bracket)
//  - a grand-final / reset correction stays structurally valid
//  - clearing a decided result back to undecided
//  - robustness: editing an undecided match, an unknown id, an invalid winner

import { check } from './helpers/scriptCheck';
import { buildDoubleElim } from '../src/lib/doubleElim';
import {
  champion,
  downstreamImpact,
  editResult,
  isComplete,
  refresh,
  reportResult,
} from '../src/lib/engine';
import { isTournamentClosed, pointsForPlacement, tournamentPoints } from '../src/lib/scoring';
import { computeStandings, createTournament } from '../src/lib/tournament';
import type { DoubleElimBracket, Tournament } from '../src/lib/types';

function names(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `P${i + 1}`);
}

function build(n: number): DoubleElimBracket {
  const b = buildDoubleElim(names(n), {
    idPrefix: 'e',
    mainFormat: { kind: 'bestOf', n: 3 },
    grandFinalFormat: { kind: 'bestOf', n: 5 },
    labelPrefix: '',
  });
  refresh(b);
  return b;
}

function byId(b: DoubleElimBracket, id: string) {
  return b.matches.find((m) => m.id === id)!;
}

// --- 1. Clean flip of a leaf match with no downstream -----------------------
test('1. Clean flip of a leaf match with no downstream', () => {
  const b = build(4);
  // A WB Round 1 match feeds later, so pick a fresh bracket and only decide a
  // single LB-final-ish leaf. Easiest reliable leaf: decide just one WB R1
  // match and flip it BEFORE anything downstream is played.
  const m = byId(b, 'e-wb-r1-m1');
  const a = m.playerA!;
  const bp = m.playerB!;
  reportResult(b, m.id, a);
  check(byId(b, m.id).winner === a, 'leaf: initial winner recorded');

  // Nothing downstream has been played yet -> impact should be empty.
  const impact = downstreamImpact(b, m.id);
  check(impact.length === 0, `leaf: no downstream impact (got ${impact.length})`);

  editResult(b, m.id, bp);
  check(byId(b, m.id).winner === bp, 'leaf: winner flipped cleanly');
  check(byId(b, m.id).loser === a, 'leaf: loser updated to old winner');
});

// --- 2. Early WB match that already fed a later match -> downstream reset ----
test('2. Early WB match that already fed a later match -> downstream reset', () => {
  const b = build(4);
  // Decide both WB R1 matches, then the WB final (which is fed by them).
  reportResult(b, 'e-wb-r1-m1', byId(b, 'e-wb-r1-m1').playerA!);
  reportResult(b, 'e-wb-r1-m2', byId(b, 'e-wb-r1-m2').playerA!);
  const wbFinal = byId(b, 'e-wb-r2-m1');
  check(!!wbFinal.playerA && !!wbFinal.playerB, 'downstream: WB final populated');
  reportResult(b, wbFinal.id, wbFinal.playerA!);
  check(wbFinal.winner !== null, 'downstream: WB final decided');

  // Flipping WB R1 M1 must reset the WB final (its winner fed slot a).
  const impact = downstreamImpact(b, 'e-wb-r1-m1');
  check(
    impact.includes('e-wb-r2-m1'),
    `downstream: impact lists WB final (got ${impact.join(',')})`,
  );
  // Preview must NOT mutate the real bracket.
  check(byId(b, 'e-wb-r2-m1').winner !== null, 'downstream: preview left the WB final decided');

  const newWinner = byId(b, 'e-wb-r1-m1').playerB!;
  editResult(b, 'e-wb-r1-m1', newWinner);
  check(byId(b, 'e-wb-r1-m1').winner === newWinner, 'downstream: feeder flipped');
  const wbFinalAfter = byId(b, 'e-wb-r2-m1');
  // The WB final now has a different slot-a player and must be undecided again.
  check(wbFinalAfter.winner === null, 'downstream: WB final was RESET (undecided)');
  check(
    wbFinalAfter.playerA === newWinner,
    'downstream: WB final slot a re-resolved to the corrected winner',
  );
  // No match may reference a player who isn't actually present.
  for (const m of b.matches) {
    if (m.winner) {
      check(
        m.winner === m.playerA || m.winner === m.playerB,
        `downstream: ${m.id} winner is a real participant`,
      );
    }
  }
});

// --- 3. Flip that changes the CHAMPION updates standings/points/Closed ------
test('3. Flip that changes the CHAMPION updates standings/points/Closed', () => {
  const t: Tournament = createTournament(names(4), {
    groupFormat: { kind: 'bestOf', n: 3 },
    playoffFormat: { kind: 'bestOf', n: 3 },
    grandFinalFormat: { kind: 'bestOf', n: 3 },
    skipGroups: true,
  });
  const po = t.playoff!;
  // Resolve fully picking playerA every time.
  let guard = 0;
  while (!isComplete(po) && guard < 200) {
    guard++;
    const open = po.matches.find((m) => m.winner === null && m.playerA && m.playerB);
    if (!open) break;
    reportResult(po, open.id, open.playerA!);
  }
  t.phase = 'done';
  t.standings = computeStandings(t);
  check(isTournamentClosed(t), 'champ: tournament starts Closed');
  const oldChamp = champion(po)!;
  const oldStandings = [...t.standings];
  const oldPoints = tournamentPoints(t);

  // Find the grand final and flip it to the other finalist (the LB player in
  // slot b, who originally lost). That triggers a bracket RESET, so after the
  // edit the playoff is no longer complete until the reset is played.
  const gf = po.matches.find((m) => m.side === 'grandFinal' && m.round === 1)!;
  const other = gf.winner === gf.playerA ? gf.playerB! : gf.playerA!;

  editResult(po, gf.id, other);
  // A reset is now active (LB player won GF1). Play it so `other` wins outright
  // and truly becomes champion.
  const reset = po.matches.find((m) => m.id === 'po-gf-reset');
  if (reset && (reset.playerA || reset.playerB)) {
    reportResult(po, reset.id, other);
  }
  check(isComplete(po), 'champ: playoff complete after reset played');
  t.phase = isComplete(po) ? 'done' : 'playoff';
  t.standings = isComplete(po) ? computeStandings(t) : [];

  check(isTournamentClosed(t), 'champ: tournament Closed again after re-resolve');
  const newChamp = champion(po)!;
  check(newChamp !== oldChamp, `champ: champion changed (${oldChamp} -> ${newChamp})`);
  check(t.standings[0] === newChamp, 'champ: standings[0] is the new champion');
  check(
    JSON.stringify(t.standings) !== JSON.stringify(oldStandings),
    'champ: standings array changed',
  );
  const newPoints = tournamentPoints(t);
  check(newPoints.size > 0, 'champ: points map rebuilt (non-empty)');
  // The new champion now holds the 1000-point top placement; the old champion
  // no longer does.
  check(
    pointsForPlacement(t.standings.indexOf(newChamp) + 1) === 1000,
    'champ: new champion earns 1st-place points',
  );
  // Old and new points maps must differ for the two affected players.
  let differs = false;
  for (const [k, v] of newPoints) {
    if (oldPoints.get(k) !== v) differs = true;
  }
  check(differs, 'champ: per-player points changed after champion flip');
});

// --- 4. Grand-final / reset correction stays structurally valid -------------
test('4. Grand-final / reset correction stays structurally valid', () => {
  // Build a 4-player bracket, force a reset (LB player wins GF1), play the
  // reset, then CORRECT GF1 back to the WB player winning outright. The reset
  // must be neutralised and the bracket must complete with no dangling players.
  const b = build(4);
  let guard = 0;
  // Resolve everything up to (but not including) the grand final, pick-A.
  while (guard < 200) {
    guard++;
    const gf = b.matches.find((m) => m.side === 'grandFinal' && m.round === 1)!;
    if (gf.playerA && gf.playerB && gf.winner === null) break;
    const open = b.matches.find(
      (m) => m.winner === null && m.playerA && m.playerB && !(m.side === 'grandFinal'),
    );
    if (!open) break;
    reportResult(b, open.id, open.playerA!);
  }
  const gf = b.matches.find((m) => m.side === 'grandFinal' && m.round === 1)!;
  // LB player is slot b -> winning forces a reset.
  reportResult(b, gf.id, gf.playerB!);
  const reset = byId(b, 'e-gf-reset');
  check(!!reset.playerA && !!reset.playerB, 'gf: reset triggered');
  // Play the reset.
  reportResult(b, reset.id, reset.playerA!);
  check(isComplete(b), 'gf: bracket complete after reset played');
  const champWithReset = champion(b)!;

  // Now CORRECT GF1: the WB player (slot a) actually won outright.
  const wbPlayer = byId(b, 'e-gf').playerA!;
  const impact = downstreamImpact(b, 'e-gf');
  check(
    impact.includes('e-gf-reset'),
    `gf: impact includes the reset match (got ${impact.join(',')})`,
  );
  editResult(b, 'e-gf', wbPlayer);
  const resetAfter = byId(b, 'e-gf-reset');
  check(
    resetAfter.winner === null && resetAfter.a.kind === 'empty' && resetAfter.b.kind === 'empty',
    'gf: reset neutralised after correcting GF to WB-win',
  );
  check(isComplete(b), 'gf: bracket complete after correction (no reset)');
  check(champion(b) === wbPlayer, 'gf: champion is now the WB player who won outright');
  check(
    champion(b) !== champWithReset || wbPlayer === champWithReset,
    'gf: champion reflects the corrected outcome',
  );
  // Structural integrity: no decided match points at a non-participant.
  for (const m of b.matches) {
    if (m.winner) {
      check(
        m.winner === m.playerA || m.winner === m.playerB,
        `gf: ${m.id} winner is a real participant`,
      );
    }
  }
});

// --- 5. Clearing a decided result back to undecided -------------------------
test('5. Clearing a decided result back to undecided', () => {
  const b = build(4);
  reportResult(b, 'e-wb-r1-m1', byId(b, 'e-wb-r1-m1').playerA!);
  reportResult(b, 'e-wb-r1-m2', byId(b, 'e-wb-r1-m2').playerA!);
  reportResult(b, 'e-wb-r2-m1', byId(b, 'e-wb-r2-m1').playerA!);

  editResult(b, 'e-wb-r1-m1', null); // clear the feeder
  check(byId(b, 'e-wb-r1-m1').winner === null, 'clear: feeder undecided');
  check(byId(b, 'e-wb-r1-m1').loser === null, 'clear: feeder loser cleared');
  check(byId(b, 'e-wb-r2-m1').winner === null, 'clear: dependent WB final reset');
  // Both feeder players are still present (slots restored), so it's playable.
  check(
    !!byId(b, 'e-wb-r1-m1').playerA && !!byId(b, 'e-wb-r1-m1').playerB,
    'clear: feeder still has both players',
  );
});

// --- 6. Robustness: no-op / invalid edits never corrupt the bracket ---------
test('6. Robustness: no-op / invalid edits never corrupt the bracket', () => {
  const b = build(4);
  reportResult(b, 'e-wb-r1-m1', byId(b, 'e-wb-r1-m1').playerA!);
  const snapshot = JSON.stringify(b);

  // Unknown match id -> unchanged.
  editResult(b, 'does-not-exist', 'whoever');
  check(JSON.stringify(b) === snapshot, 'robust: unknown id is a no-op');

  // Invalid winner (not a participant) -> unchanged.
  editResult(b, 'e-wb-r1-m1', 'not-a-player');
  check(JSON.stringify(b) === snapshot, 'robust: invalid winner is a no-op');

  // Editing an undecided match to a valid winner just records it (like report).
  const undecided = byId(b, 'e-wb-r1-m2');
  editResult(b, undecided.id, undecided.playerB!);
  check(
    byId(b, undecided.id).winner === undecided.playerB,
    'robust: editing an undecided match records the winner',
  );

  // downstreamImpact on an undecided match is empty.
  check(
    downstreamImpact(b, 'e-wb-r2-m1').length === 0,
    'robust: impact of an undecided match is empty',
  );
});
