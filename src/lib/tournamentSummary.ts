// What the tournament list shows for each entry: name, dates, player count, top 3 or "in progress".
// Everything except the name and dates is worked out from the saved tournament, so it cannot go stale.

import { isTournamentClosed, participantCount, topThree } from './scoring';
import type { Tournament } from './types';

// A tournament as read from the database (see src/data/tournamentRepo.ts).
export interface StoredTournament {
  id: string;
  name: string;
  createdAt: string; // ISO date text from the database
  finishedAt: string | null; // null while in progress
  tournament: Tournament;
}

export interface TournamentSummary {
  id: string;
  name: string;
  createdAt: string;
  finishedAt: string | null;
  participantCount: number;
  status: 'open' | 'closed';
  topThreeNames: string[]; // empty while open
  playerNames: string[]; // used by "Make as new"
}

export function summarize(st: StoredTournament): TournamentSummary {
  const t = st.tournament;
  return {
    id: st.id,
    name: st.name,
    createdAt: st.createdAt,
    finishedAt: st.finishedAt,
    participantCount: participantCount(t),
    status: isTournamentClosed(t) ? 'closed' : 'open',
    topThreeNames: topThree(t).map((pid) => t.players[pid]?.name ?? '?'),
    playerNames: Object.values(t.players).map((p) => p.name),
  };
}

// "20 Jun 2026" style date, or a dash when there is none.
export function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
