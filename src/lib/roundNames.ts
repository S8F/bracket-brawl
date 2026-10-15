// Human round names derived from bracket STRUCTURE, not hardcoded by player
// count. Given a bracket and one of its matches, return a proper esports-style
// round name: "Winners Round 1", "Winners Semi-Final", "Winners Final",
// "Losers Round N", "Losers Semi-Final", "Losers Final", "Grand Final",
// "Grand Final (Reset)". Group-stage matches keep a "Group X ..." style name.
//
// The logic is position-based: for each side we find the deepest round number
// present; the final round of a side is its "Final", the one before it the
// "Semi-Final", everything earlier is "Round N". This works for any field size
// (including odd / bye-padded brackets) and degrades to "Round N" when a clean
// name isn't derivable.

import type { BracketSide, DoubleElimBracket, Match } from "./types";

// Highest round number used on a given side of a bracket. 0 if the side is
// absent (e.g. a 2-player bracket has no losers side).
function maxRoundForSide(b: DoubleElimBracket, side: BracketSide): number {
  let max = 0;
  for (const m of b.matches) {
    if (m.side === side && m.round > max) max = m.round;
  }
  return max;
}

// Pretty name for a winners/losers round given how deep it is.
// finalRound = deepest round on that side.
function tieredName(
  prefix: "Winners" | "Losers",
  round: number,
  finalRound: number
): string {
  if (finalRound <= 0) return `${prefix} Round ${round}`;
  if (round === finalRound) return `${prefix} Final`;
  if (round === finalRound - 1) return `${prefix} Semi-Final`;
  return `${prefix} Round ${round}`;
}

// Derive the display name for one match from its position in the bracket.
// `groupName` (optional) prefixes group-stage matches, e.g. "Group A".
export function roundName(
  b: DoubleElimBracket,
  m: Match,
  groupName?: string
): string {
  // Grand final (and its reset) are unambiguous.
  if (m.side === "grandFinal") {
    const base = m.round >= 2 ? "Grand Final (Reset)" : "Grand Final";
    return groupName ? `${groupName} ${base}` : base;
  }

  const prefix = m.side === "winners" ? "Winners" : "Losers";
  const finalRound = maxRoundForSide(b, m.side);
  const base = tieredName(prefix, m.round, finalRound);
  return groupName ? `${groupName} ${base}` : base;
}

// Short version of a round name for compact cards (e.g. the per-match header).
// "Winners Round 2" -> "W R2", "Winners Semi-Final" -> "W Semi",
// "Losers Final" -> "L Final", "Grand Final" -> "Grand Final".
export function shortRoundName(name: string): string {
  return name
    .replace(/^Group [A-Z0-9]+ /, "")
    .replace(/^Winners Round (\d+)$/, "W R$1")
    .replace(/^Losers Round (\d+)$/, "L R$1")
    .replace(/^Winners Semi-Final$/, "W Semi")
    .replace(/^Losers Semi-Final$/, "L Semi")
    .replace(/^Winners Final$/, "W Final")
    .replace(/^Losers Final$/, "L Final")
    .replace(/^Grand Final \(Reset\)$/, "GF Reset")
    .replace(/^Grand Final$/, "Grand Final");
}

// Heading for a whole ROUND COLUMN in the bracket view (all matches in a
// column share a side + round). Same tiering as roundName but without a
// per-match group prefix, since the column lives under a side header already.
export function roundColumnLabel(
  b: DoubleElimBracket,
  side: BracketSide,
  round: number
): string {
  if (side === "grandFinal") {
    return round >= 2 ? "Reset" : "Final";
  }
  const prefix = side === "winners" ? "Winners" : "Losers";
  const finalRound = maxRoundForSide(b, side);
  // Column heads sit under a "Winners Bracket" section title, so drop the
  // redundant prefix on plain rounds but keep Semi-Final / Final explicit.
  if (finalRound > 0 && round === finalRound) return "Final";
  if (finalRound > 0 && round === finalRound - 1) return "Semi-Final";
  void prefix;
  return `Round ${round}`;
}
