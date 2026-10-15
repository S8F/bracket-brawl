// Finished-tournament rules: is it closed, who placed where, how many points each place earns,
// the points table, and the fix-up that fills in missing game scores on old saved tournaments.
// Moved out of the web app's store.ts (which also held the shared player list and local storage,
// both removed here). No React and no network code lives in this file.

import { isComplete } from './engine';
import { computeStandings } from './tournament';
import { winsToWin } from './types';
import type { DoubleElimBracket, Match, PlayerId, Tournament } from './types';

// Case-insensitive key for a player name ("Player A" and "player a" are the same person).
export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

// ----- Score fix-up for old saved tournaments ------------------------------
// Older saved matches have a winner but no game score. For a decided match we fill in a clean
// "winner takes exactly the games needed, loser takes 0" score (a Bo3 shows 2-0). It never changes
// who won. Undecided and bye matches get null scores. Running it twice changes nothing.
function migrateMatch(m: Match): void {
  if (m.scoreA !== undefined && m.scoreB !== undefined) return;
  if (m.winner === null) {
    m.scoreA = null;
    m.scoreB = null;
    return;
  }
  const target = winsToWin(m.format);
  if (m.winner === m.playerA) {
    m.scoreA = target;
    m.scoreB = 0;
  } else if (m.winner === m.playerB) {
    m.scoreA = 0;
    m.scoreB = target;
  } else {
    // A bye or an odd state: no real games were played.
    m.scoreA = null;
    m.scoreB = null;
  }
}

function migrateBracket(b: DoubleElimBracket): void {
  for (const m of b.matches) migrateMatch(m);
}

// Brings a loaded tournament up to the current shape, in place. Safe on current data.
export function migrateTournament(t: Tournament): Tournament {
  if (t.playoff) migrateBracket(t.playoff);
  for (const g of t.groups) migrateBracket(g.bracket);
  return t;
}

// ----- Closed or open ------------------------------------------------------

// A tournament is closed only when its playoff bracket is fully played, so the champion and the
// final standings are decided. Worked out from the bracket itself, never from a stored flag.
export function isTournamentClosed(t: Tournament): boolean {
  return t.playoff !== null && isComplete(t.playoff);
}

// The player ids of 1st, 2nd and 3rd. Empty while the tournament is still open.
export function topThree(t: Tournament): PlayerId[] {
  if (!isTournamentClosed(t)) return [];
  return computeStandings(t).slice(0, 3);
}

export function participantCount(t: Tournament): number {
  return Object.keys(t.players).length;
}

// ----- Points --------------------------------------------------------------

// Points by final place (1 = winner). Tied places share a value:
// 1st 1000, 2nd 700, 3rd 500, 4th 350, 5th-6th 200, 7th-8th 100, 9th-16th 50, 17th and below 25.
export function pointsForPlacement(placement: number): number {
  if (placement < 1) return 0;
  if (placement === 1) return 1000;
  if (placement === 2) return 700;
  if (placement === 3) return 500;
  if (placement === 4) return 350;
  if (placement <= 6) return 200;
  if (placement <= 8) return 100;
  if (placement <= 16) return 50;
  return 25;
}

// Points earned in ONE tournament, keyed by lower-case player name. Open tournaments earn nothing.
export function tournamentPoints(t: Tournament): Map<string, number> {
  const out = new Map<string, number>();
  if (!isTournamentClosed(t)) return out;
  computeStandings(t).forEach((pid, i) => {
    const player = t.players[pid];
    if (!player) return;
    out.set(nameKey(player.name), pointsForPlacement(i + 1));
  });
  return out;
}

// One line of the points table.
export interface LeaderboardRow {
  name: string; // display name (the latest capital letters seen)
  points: number; // total over all finished tournaments
  played: number; // finished tournaments this player was in
  won: number; // finished tournaments this player won
}

// Builds the points table from the finished tournaments passed in, plus the saved player names
// (so a player with no finished tournament still shows at 0). Open tournaments add nothing.
// Totals are always worked out fresh, never stored. Sorted high to low, ties by name.
export function computeLeaderboard(
  tournaments: Tournament[],
  rosterNames: string[] = [],
): LeaderboardRow[] {
  const rows = new Map<string, LeaderboardRow>();

  for (const name of rosterNames) {
    const key = nameKey(name);
    if (!key) continue;
    if (!rows.has(key)) rows.set(key, { name: name.trim(), points: 0, played: 0, won: 0 });
  }

  for (const t of tournaments) {
    if (!isTournamentClosed(t)) continue;
    computeStandings(t).forEach((pid, i) => {
      const player = t.players[pid];
      if (!player) return;
      const key = nameKey(player.name);
      const row = rows.get(key) ?? { name: player.name.trim(), points: 0, played: 0, won: 0 };
      row.name = player.name.trim();
      row.points += pointsForPlacement(i + 1);
      row.played += 1;
      if (i === 0) row.won += 1;
      rows.set(key, row);
    });
  }

  return [...rows.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}
