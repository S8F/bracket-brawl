// Generic double-elimination bracket generator.
//
// Used both for each group's mini double-elim and for the playoff.
// Approach: build the winners bracket (WB) as a standard seeded
// single-elim tree, then build the losers bracket (LB) that absorbs
// WB losers, then a grand final (with bracket reset).
//
// Players are padded with byes up to the next power of two so the tree
// is well-formed. Byes auto-resolve so small/odd counts work gracefully.

import type {
  DoubleElimBracket,
  Match,
  MatchFormat,
  PlayerId,
  SlotRef,
} from "./types";

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(p, 1);
}

// Standard single-elim seed order for a bracket of `size` (power of two).
// Returns 1-based seed positions arranged so 1 plays the lowest seed, etc.
function seedOrder(size: number): number[] {
  let rounds: number[][] = [[1, 2]];
  while (rounds[0].length < size) {
    const next: number[] = [];
    const total = rounds[0].length * 2 + 1;
    for (const s of rounds[0]) {
      next.push(s);
      next.push(total - s);
    }
    rounds = [next];
  }
  return rounds[0];
}

const empty: SlotRef = { kind: "empty" };

export interface BuildOpts {
  idPrefix: string;
  // Format for all ordinary (winners/losers) matches in this bracket.
  mainFormat: MatchFormat;
  // Format for the grand final (and its reset). Defaults to mainFormat.
  grandFinalFormat?: MatchFormat;
  labelPrefix?: string; // e.g. "Group A " or "" for playoff
}

export function buildDoubleElim(
  playerIds: PlayerId[],
  opts: BuildOpts
): DoubleElimBracket {
  const p = opts.idPrefix;
  const n = playerIds.length;
  const size = nextPow2(n);
  const matches: Match[] = [];
  const byId = new Map<string, Match>();

  const add = (m: Match) => {
    matches.push(m);
    byId.set(m.id, m);
    return m;
  };

  const lp = opts.labelPrefix ?? "";
  const mainFormat = opts.mainFormat;
  const gfFormat = opts.grandFinalFormat ?? opts.mainFormat;

  // --- Winners bracket ---
  const order = seedOrder(size); // seeds at positions, length=size
  const wbRounds: string[][] = []; // match ids per round
  const wbRoundCount = Math.log2(size);

  // Round 1 pairs consecutive seed positions.
  const r1: string[] = [];
  for (let i = 0; i < size; i += 2) {
    const seedA = order[i];
    const seedB = order[i + 1];
    const a: SlotRef =
      seedA <= n ? { kind: "player", playerId: playerIds[seedA - 1] } : empty;
    const b: SlotRef =
      seedB <= n ? { kind: "player", playerId: playerIds[seedB - 1] } : empty;
    const id = `${p}-wb-r1-m${i / 2 + 1}`;
    add({
      id,
      label: `${lp}WB Round 1 - Match ${i / 2 + 1}`,
      side: "winners",
      round: 1,
      a,
      b,
      playerA: null,
      playerB: null,
      winner: null,
      loser: null,
      scoreA: null,
      scoreB: null,
      format: mainFormat,
      winnerTo: null,
      loserTo: null,
      isBye: false,
    });
    r1.push(id);
  }
  wbRounds.push(r1);

  for (let r = 2; r <= wbRoundCount; r++) {
    const prev = wbRounds[r - 2];
    const cur: string[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const id = `${p}-wb-r${r}-m${i / 2 + 1}`;
      add({
        id,
        label: `${lp}WB Round ${r} - Match ${i / 2 + 1}`,
        side: "winners",
        round: r,
        a: { kind: "winnerOf", matchId: prev[i] },
        b: { kind: "winnerOf", matchId: prev[i + 1] },
        playerA: null,
        playerB: null,
        winner: null,
        loser: null,
        scoreA: null,
        scoreB: null,
        format: mainFormat,
        winnerTo: null,
        loserTo: null,
        isBye: false,
      });
      cur.push(id);
      // wire winner flow from prev matches into this one
      byId.get(prev[i])!.winnerTo = { matchId: id, slot: "a" };
      byId.get(prev[i + 1])!.winnerTo = { matchId: id, slot: "b" };
    }
    wbRounds.push(cur);
  }

  // --- Losers bracket ---
  // Standard LB structure: it alternates "minor" rounds (LB winners only)
  // and "major" rounds (LB winner vs a fresh WB loser).
  // LB has 2*(wbRoundCount-1) rounds for size>2.
  const lbRounds: string[][] = [];
  let lbRoundNum = 0;

  if (size >= 2) {
    // LB Round 1: pairs the losers of WB Round 1.
    lbRoundNum++;
    const wbR1Losers = wbRounds[0];
    const lbR1: string[] = [];
    for (let i = 0; i < wbR1Losers.length; i += 2) {
      const id = `${p}-lb-r${lbRoundNum}-m${i / 2 + 1}`;
      add({
        id,
        label: `${lp}LB Round ${lbRoundNum} - Match ${i / 2 + 1}`,
        side: "losers",
        round: lbRoundNum,
        a: { kind: "loserOf", matchId: wbR1Losers[i] },
        b: { kind: "loserOf", matchId: wbR1Losers[i + 1] },
        playerA: null,
        playerB: null,
        winner: null,
        loser: null,
        scoreA: null,
        scoreB: null,
        format: mainFormat,
        winnerTo: null,
        loserTo: null,
        isBye: false,
      });
      lbR1.push(id);
    }
    lbRounds.push(lbR1);

    // From here, alternate major (absorb WB losers from WB round k) and
    // minor (LB internal) rounds, for each subsequent WB round.
    let prevLb = lbR1;
    for (let wbR = 2; wbR <= wbRoundCount; wbR++) {
      // Major round: each prevLb winner faces a loser from WB round wbR.
      lbRoundNum++;
      const wbLosers = wbRounds[wbR - 1]; // matches whose losers drop in
      const major: string[] = [];
      // pair them 1:1 (counts match: len(prevLb) == len(wbLosers))
      for (let i = 0; i < prevLb.length; i++) {
        const id = `${p}-lb-r${lbRoundNum}-m${i + 1}`;
        add({
          id,
          label: `${lp}LB Round ${lbRoundNum} - Match ${i + 1}`,
          side: "losers",
          round: lbRoundNum,
          a: { kind: "winnerOf", matchId: prevLb[i] },
          b: { kind: "loserOf", matchId: wbLosers[i] },
          playerA: null,
          playerB: null,
          winner: null,
          loser: null,
          scoreA: null,
          scoreB: null,
          format: mainFormat,
          winnerTo: null,
          loserTo: null,
          isBye: false,
        });
        major.push(id);
        byId.get(prevLb[i])!.winnerTo = { matchId: id, slot: "a" };
      }
      lbRounds.push(major);
      prevLb = major;

      // Minor round: collapse major winners pairwise (skip if only 1 left).
      if (prevLb.length > 1) {
        lbRoundNum++;
        const minor: string[] = [];
        for (let i = 0; i < prevLb.length; i += 2) {
          const id = `${p}-lb-r${lbRoundNum}-m${i / 2 + 1}`;
          add({
            id,
            label: `${lp}LB Round ${lbRoundNum} - Match ${i / 2 + 1}`,
            side: "losers",
            round: lbRoundNum,
            a: { kind: "winnerOf", matchId: prevLb[i] },
            b: { kind: "winnerOf", matchId: prevLb[i + 1] },
            playerA: null,
            playerB: null,
            winner: null,
            loser: null,
            scoreA: null,
            scoreB: null,
            format: mainFormat,
            winnerTo: null,
            loserTo: null,
            isBye: false,
          });
          minor.push(id);
          byId.get(prevLb[i])!.winnerTo = { matchId: id, slot: "a" };
          byId.get(prevLb[i + 1])!.winnerTo = { matchId: id, slot: "b" };
        }
        lbRounds.push(minor);
        prevLb = minor;
      }
    }
  }

  // Wire WB losers into LB.
  // WB Round 1 losers -> LB Round 1 slots (already referenced via loserOf,
  // set loserTo pointers for forward navigation).
  wireLoserTo(byId, wbRounds, lbRounds);

  const wbFinalId = wbRounds[wbRoundCount - 1]?.[0];
  const lbFinalId = lbRounds.length ? lbRounds[lbRounds.length - 1][0] : null;

  // --- Grand final ---
  // Special case size === 1: single player, no matches.
  let grandFinalId: string | null = null;
  let resetId: string | null = null;

  if (wbFinalId && lbFinalId) {
    grandFinalId = `${p}-gf`;
    add({
      id: grandFinalId,
      label: `${lp}Grand Final`,
      side: "grandFinal",
      round: 1,
      a: { kind: "winnerOf", matchId: wbFinalId }, // WB champ
      b: { kind: "winnerOf", matchId: lbFinalId }, // LB champ
      playerA: null,
      playerB: null,
      winner: null,
      loser: null,
      scoreA: null,
      scoreB: null,
      format: gfFormat,
      winnerTo: null,
      loserTo: null,
      isBye: false,
    });
    byId.get(wbFinalId)!.winnerTo = { matchId: grandFinalId, slot: "a" };
    byId.get(lbFinalId)!.winnerTo = { matchId: grandFinalId, slot: "b" };

    // Bracket reset: only happens if the LB player wins the first GF.
    // We create it but it stays inert unless triggered.
    resetId = `${p}-gf-reset`;
    add({
      id: resetId,
      label: `${lp}Grand Final (Reset)`,
      side: "grandFinal",
      round: 2,
      a: empty,
      b: empty,
      playerA: null,
      playerB: null,
      winner: null,
      loser: null,
      scoreA: null,
      scoreB: null,
      format: gfFormat,
      winnerTo: null,
      loserTo: null,
      isBye: false,
    });
  } else if (wbFinalId && !lbFinalId) {
    // size === 2: WB final is effectively the whole thing, but double-elim
    // still gives the loser a second life. With 2 players, LB is empty and
    // the WB final winner faces the WB final loser again => grand final.
    grandFinalId = `${p}-gf`;
    add({
      id: grandFinalId,
      label: `${lp}Grand Final`,
      side: "grandFinal",
      round: 1,
      a: { kind: "winnerOf", matchId: wbFinalId },
      b: { kind: "loserOf", matchId: wbFinalId },
      playerA: null,
      playerB: null,
      winner: null,
      loser: null,
      scoreA: null,
      scoreB: null,
      format: gfFormat,
      winnerTo: null,
      loserTo: null,
      isBye: false,
    });
    byId.get(wbFinalId)!.winnerTo = { matchId: grandFinalId, slot: "a" };
    byId.get(wbFinalId)!.loserTo = { matchId: grandFinalId, slot: "b" };
    resetId = `${p}-gf-reset`;
    add({
      id: resetId,
      label: `${lp}Grand Final (Reset)`,
      side: "grandFinal",
      round: 2,
      a: empty,
      b: empty,
      playerA: null,
      playerB: null,
      winner: null,
      loser: null,
      scoreA: null,
      scoreB: null,
      format: gfFormat,
      winnerTo: null,
      loserTo: null,
      isBye: false,
    });
  }

  const bracket: DoubleElimBracket = {
    id: opts.idPrefix,
    matches,
    placements: [],
  };
  return bracket;
}

// Set loserTo pointers from WB matches into the LB matches that absorb them.
function wireLoserTo(
  byId: Map<string, Match>,
  wbRounds: string[][],
  lbRounds: string[][]
) {
  if (!lbRounds.length) return;
  // WB R1 losers -> LB R1 (slots a/b interleaved).
  const wbR1 = wbRounds[0];
  const lbR1 = lbRounds[0];
  for (let i = 0; i < wbR1.length; i++) {
    const target = lbR1[Math.floor(i / 2)];
    const slot: "a" | "b" = i % 2 === 0 ? "a" : "b";
    byId.get(wbR1[i])!.loserTo = { matchId: target, slot };
  }
  // WB round k (k>=2) losers -> the "major" LB round that references them
  // via loserOf. We find those by scanning LB matches for loserOf refs.
  for (const round of lbRounds) {
    for (const mid of round) {
      const m = byId.get(mid)!;
      for (const slot of ["a", "b"] as const) {
        const ref = m[slot];
        if (ref.kind === "loserOf") {
          const src = byId.get(ref.matchId);
          if (src && src.side === "winners" && src.round >= 2) {
            src.loserTo = { matchId: mid, slot };
          }
        }
      }
    }
  }
}

// Export helpers for tests / scaling decisions.
export { nextPow2, seedOrder };
