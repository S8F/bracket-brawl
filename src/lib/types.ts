// Core data types for the tournament engine.
// Everything is plain data so the bracket logic stays pure and testable,
// fully separate from React.

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
}

// A slot in a match is either a known player, a pending reference
// (winner/loser of another match), or empty (a bye).
export type SlotRef =
  | { kind: "player"; playerId: PlayerId }
  | { kind: "winnerOf"; matchId: string }
  | { kind: "loserOf"; matchId: string }
  | { kind: "empty" };

export type BracketSide = "winners" | "losers" | "grandFinal";

// How a match is won. The format governs the LABEL, the per-set scoring rules,
// and the winner-derivation. `n` is the headline number used in the label.
//  - bestOf: first to win the MAJORITY of n games (n is odd: 1, 3, 5, ...).
//      Bo1 -> first to 1 (max 1 game), Bo3 -> first to 2 (max 3),
//      Bo5 -> first to 3 (max 5).
//  - firstTo: first to reach n game wins, with up to (2n - 1) games played.
//      FT3 -> first to 3 (max 5 games).
export type MatchFormat =
  | { kind: "bestOf"; n: number }
  | { kind: "firstTo"; n: number };

// Short label for a format, e.g. "Bo3" or "FT3".
export function formatLabel(f: MatchFormat): string {
  return f.kind === "bestOf" ? `Bo${f.n}` : `FT${f.n}`;
}

// How many game wins one side needs to take the match.
//  - bestOf n  -> majority = (n + 1) / 2  (Bo1=1, Bo3=2, Bo5=3)
//  - firstTo n -> exactly n               (FT3=3)
export function winsToWin(f: MatchFormat): number {
  return f.kind === "bestOf" ? Math.ceil(f.n / 2) : f.n;
}

// The most games that can ever be played under a format (the loser can take at
// most one fewer than the winner's target).
//  - bestOf n  -> n                       (Bo1=1, Bo3=3, Bo5=5)
//  - firstTo n -> 2n - 1                   (FT3=5)
export function maxGames(f: MatchFormat): number {
  return f.kind === "bestOf" ? f.n : 2 * f.n - 1;
}

// Validate a game score against a format. A score is valid when exactly one
// side has reached the win target, the loser is strictly below it, neither side
// is negative, and the total games played does not exceed the format's max.
// `outcome` is the winning SIDE ("a" | "b") when valid, else the reason it isn't.
export type ScoreCheck =
  | { ok: true; winningSide: "a" | "b" }
  | { ok: false; reason: string };

export function checkScore(
  f: MatchFormat,
  scoreA: number,
  scoreB: number
): ScoreCheck {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return { ok: false, reason: "Scores must be whole numbers, zero or more." };
  }
  const target = winsToWin(f);
  // The match stops the moment someone clinches, so the WINNER's score is
  // exactly the target — never above it. Anything higher is an impossible line.
  if (scoreA > target || scoreB > target) {
    return { ok: false, reason: `No side can win more than ${target} game${target === 1 ? "" : "s"}.` };
  }
  const aWon = scoreA === target;
  const bWon = scoreB === target;
  if (aWon && bWon) {
    return { ok: false, reason: "Both sides can't reach the win total." };
  }
  if (!aWon && !bWon) {
    return { ok: false, reason: `Someone must reach ${target} game win${target === 1 ? "" : "s"}.` };
  }
  return { ok: true, winningSide: aWon ? "a" : "b" };
}

export interface Match {
  id: string;
  // Human label, e.g. "WB Round 1 - Match 2" or "Grand Final".
  label: string;
  side: BracketSide;
  round: number; // 1-based round number within its side
  a: SlotRef;
  b: SlotRef;
  // Resolved players once both refs are known.
  playerA: PlayerId | null;
  playerB: PlayerId | null;
  winner: PlayerId | null;
  loser: PlayerId | null;
  // Game score: wins for the player in slot a / slot b. Null until a result is
  // entered. The winner is DERIVED from this against `format` (see checkScore).
  // A bye resolves with no score (both null). Bo1 records as 1-0 / 0-1.
  scoreA: number | null;
  scoreB: number | null;
  // Win condition for this match (label + data model; see MatchFormat).
  format: MatchFormat;
  // Where the winner / loser flow to next (matchId + slot), null = exits bracket.
  winnerTo: { matchId: string; slot: "a" | "b" } | null;
  loserTo: { matchId: string; slot: "a" | "b" } | null;
  // True once this match has no real contest (a bye that auto-resolves).
  isBye: boolean;
}

// A single double-elimination bracket (used for a group OR the playoff).
export interface DoubleElimBracket {
  id: string;
  matches: Match[];
  // Final placement of players in THIS bracket, best to worst,
  // filled in as the bracket resolves.
  placements: PlayerId[];
}

export interface Group {
  id: string;
  name: string; // "Group A"
  players: PlayerId[];
  bracket: DoubleElimBracket;
  advanceCount: number; // how many advance to playoff
}

// Per-stage match formats + whether to skip the group stage. Chosen on the
// create screen and carried through the whole tournament. Defaults below
// reproduce the original behavior (groups Bo3, top bracket Bo3, GF Bo5).
export interface TournamentConfig {
  groupFormat: MatchFormat;
  playoffFormat: MatchFormat; // top 8 / main bracket
  grandFinalFormat: MatchFormat;
  skipGroups: boolean;
}

export const DEFAULT_CONFIG: TournamentConfig = {
  groupFormat: { kind: "bestOf", n: 3 },
  playoffFormat: { kind: "bestOf", n: 3 },
  grandFinalFormat: { kind: "bestOf", n: 5 },
  skipGroups: false,
};

export type Phase = "groups" | "playoff" | "done";

export interface Tournament {
  players: Record<PlayerId, Player>;
  config: TournamentConfig;
  phase: Phase;
  groups: Group[];
  playoff: DoubleElimBracket | null;
  // Final overall standings (player ids, best to worst), filled when done.
  standings: PlayerId[];
}
