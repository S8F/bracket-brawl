// The "Now playing / Up next" view: which matches can be played right now and which are waiting.
// Worked out fresh from the bracket on every change, so it updates the moment a score is saved.
// Moved over from the web app's store.ts; no React and no storage code here.

import { roundName } from './roundNames';
import { isTournamentClosed } from './scoring';
import type { DoubleElimBracket, Match, Tournament } from './types';

// One match plus what the screen needs to show it.
export interface MatchView {
  match: Match;
  bracketLabel: string; // "Group A", "Playoff"
  roundLabel: string; // "Winners Semi-Final"
  aName: string | null; // null = player not known yet
  bName: string | null;
}

// complete: tournament is finished. playable: ready to play now. upcoming: waiting on other results.
export interface MatchesView {
  complete: boolean;
  playable: MatchView[];
  upcoming: MatchView[];
}

// The brackets in play: the groups during the group phase, otherwise the single playoff bracket.
function activeBrackets(t: Tournament): { bracket: DoubleElimBracket; label: string }[] {
  if (t.phase === 'groups') return t.groups.map((g) => ({ bracket: g.bracket, label: g.name }));
  if (t.playoff) return [{ bracket: t.playoff, label: 'Playoff' }];
  return [];
}

// Ready to play: no winner yet, not a bye, and both players are known.
function isPlayable(m: Match): boolean {
  return m.winner === null && !m.isBye && !!m.playerA && !!m.playerB;
}

// Upcoming: no winner yet, not a bye, not playable yet, and not a dead match (both slots empty).
function isUpcoming(m: Match): boolean {
  if (m.winner !== null || m.isBye || isPlayable(m)) return false;
  return !(m.a.kind === 'empty' && m.b.kind === 'empty');
}

function toView(
  m: Match,
  bracketLabel: string,
  bracket: DoubleElimBracket,
  t: Tournament,
): MatchView {
  return {
    match: m,
    bracketLabel,
    roundLabel: roundName(bracket, m),
    aName: m.playerA ? (t.players[m.playerA]?.name ?? null) : null,
    bName: m.playerB ? (t.players[m.playerB]?.name ?? null) : null,
  };
}

// Builds the view. Upcoming matches are ordered nearest first (earlier round, winners side first).
export function matchesView(t: Tournament): MatchesView {
  if (isTournamentClosed(t)) return { complete: true, playable: [], upcoming: [] };
  const playable: MatchView[] = [];
  const upcoming: MatchView[] = [];
  for (const { bracket, label } of activeBrackets(t)) {
    for (const m of bracket.matches) {
      if (isPlayable(m)) playable.push(toView(m, label, bracket, t));
      else if (isUpcoming(m)) upcoming.push(toView(m, label, bracket, t));
    }
  }
  const sideRank = (m: Match) => (m.side === 'winners' ? 0 : m.side === 'losers' ? 1 : 2);
  upcoming.sort((x, y) => x.match.round - y.match.round || sideRank(x.match) - sideRank(y.match));
  return { complete: false, playable, upcoming };
}
