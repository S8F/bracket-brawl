// Every change a user can make to an open tournament, as plain functions: enter a score, fix a score,
// clear a result, change a round's match length, start the final bracket. Each one takes the current
// tournament and returns a NEW tournament (or a reason it was refused). Nothing here touches the
// screen or the network, so it is easy to test. The bracket maths itself lives in engine.ts.

import {
  downstreamImpact,
  editResult,
  editScore,
  isComplete,
  reportScore,
  roundFormatImpact,
  setRoundFormat,
} from './engine';
import { buildPlayoff, computeStandings } from './tournament';
import type { BracketSide, DoubleElimBracket, MatchFormat, Tournament } from './types';

// Which bracket a change applies to: one of the groups, or the final (playoff) bracket.
export type BracketScope = { kind: 'group'; groupId: string } | { kind: 'playoff' };

export type ActionResult = { ok: true; tournament: Tournament } | { ok: false; reason: string };

// A deep copy, so the old tournament stays untouched if the change is refused or fails to save.
function cloneBracket(b: DoubleElimBracket): DoubleElimBracket {
  return JSON.parse(JSON.stringify(b)) as DoubleElimBracket;
}

function bracketOf(t: Tournament, scope: BracketScope): DoubleElimBracket | null {
  if (scope.kind === 'playoff') return t.playoff;
  return t.groups.find((g) => g.id === scope.groupId)?.bracket ?? null;
}

// Puts an edited bracket back into the tournament. For the playoff it also recomputes the phase and
// the final standings, because a correction can un-finish or re-finish the whole event.
function withBracket(t: Tournament, scope: BracketScope, nb: DoubleElimBracket): Tournament {
  if (scope.kind === 'group') {
    return {
      ...t,
      groups: t.groups.map((g) => (g.id === scope.groupId ? { ...g, bracket: nb } : g)),
    };
  }
  const next: Tournament = { ...t, playoff: nb };
  if (isComplete(nb)) {
    next.phase = 'done';
    next.standings = computeStandings(next);
  } else {
    next.phase = 'playoff';
    next.standings = [];
  }
  return next;
}

const NOT_FOUND: ActionResult = { ok: false, reason: 'That bracket could not be found.' };

// Enter the score of a match that has not been played yet. Impossible scores are refused with a reason.
export function enterScore(
  t: Tournament,
  scope: BracketScope,
  matchId: string,
  scoreA: number,
  scoreB: number,
): ActionResult {
  const b = bracketOf(t, scope);
  if (!b) return NOT_FOUND;
  const nb = cloneBracket(b);
  const res = reportScore(nb, matchId, scoreA, scoreB);
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, tournament: withBracket(t, scope, nb) };
}

// Correct the score of a match that already has a result. Later results that depended on the old
// winner are cleared (use resultsLostByEdit first to warn the user how many).
export function correctScore(
  t: Tournament,
  scope: BracketScope,
  matchId: string,
  scoreA: number,
  scoreB: number,
): ActionResult {
  const b = bracketOf(t, scope);
  if (!b) return NOT_FOUND;
  const nb = cloneBracket(b);
  const res = editScore(nb, matchId, scoreA, scoreB);
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, tournament: withBracket(t, scope, nb) };
}

// Take a result back to "not played yet" (later results that depended on it are cleared too).
export function clearResult(t: Tournament, scope: BracketScope, matchId: string): ActionResult {
  const b = bracketOf(t, scope);
  if (!b) return NOT_FOUND;
  const nb = cloneBracket(b);
  editResult(nb, matchId, null);
  return { ok: true, tournament: withBracket(t, scope, nb) };
}

// How many OTHER matches would lose their result if this match's result changed or was cleared.
export function resultsLostByEdit(t: Tournament, scope: BracketScope, matchId: string): number {
  const b = bracketOf(t, scope);
  return b ? downstreamImpact(b, matchId).length : 0;
}

// Change the match length (Bo1, Bo3, FT3, Bo5) for one round. Results that no longer fit are cleared.
export function changeRoundFormat(
  t: Tournament,
  scope: BracketScope,
  side: BracketSide,
  round: number,
  format: MatchFormat,
): ActionResult {
  const b = bracketOf(t, scope);
  if (!b) return NOT_FOUND;
  const nb = cloneBracket(b);
  setRoundFormat(nb, side, round, format);
  return { ok: true, tournament: withBracket(t, scope, nb) };
}

// How many entered results a round-length change would wipe (0 = nothing is lost).
export function resultsLostByFormat(
  t: Tournament,
  scope: BracketScope,
  side: BracketSide,
  round: number,
  format: MatchFormat,
): number {
  const b = bracketOf(t, scope);
  return b ? roundFormatImpact(b, side, round, format).length : 0;
}

// True once every match of every group has been played.
// NOTE: tournament.ts has groupsComplete(), but it looks at the placements list, and the engine fills
// that list with ALL players from the very first minute, so it says "complete" before a single match
// is played. The copied bracket maths is left unchanged on purpose; this app asks the bracket itself.
export function groupsFinished(t: Tournament): boolean {
  return t.groups.length > 0 && t.groups.every((g) => isComplete(g.bracket));
}

// When every group is finished, build the final bracket from the players who advanced.
export function startPlayoff(t: Tournament): ActionResult {
  if (!groupsFinished(t))
    return { ok: false, reason: 'Finish all groups before starting the playoff.' };
  return { ok: true, tournament: { ...t, playoff: buildPlayoff(t), phase: 'playoff' } };
}
