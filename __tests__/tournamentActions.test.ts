// Tests the changes a user can make to an open tournament (src/lib/tournamentActions.ts):
// entering a score, refusing impossible scores, fixing an earlier result (only later results that
// depended on it are cleared), clearing, changing a round's match length, and starting the playoff.

import { isComplete } from '../src/lib/engine';
import { createTournament } from '../src/lib/tournament';
import {
  changeRoundFormat,
  clearResult,
  correctScore,
  enterScore,
  groupsFinished,
  resultsLostByEdit,
  resultsLostByFormat,
  startPlayoff,
  type BracketScope,
} from '../src/lib/tournamentActions';
import type { Match, MatchFormat, Tournament } from '../src/lib/types';

const BO1: MatchFormat = { kind: 'bestOf', n: 1 };
const BO3: MatchFormat = { kind: 'bestOf', n: 3 };
const BO5: MatchFormat = { kind: 'bestOf', n: 5 };
const PLAYOFF: BracketScope = { kind: 'playoff' };

function config(skipGroups: boolean) {
  return { groupFormat: BO3, playoffFormat: BO3, grandFinalFormat: BO5, skipGroups };
}

function find(t: Tournament, id: string): Match {
  return t.playoff!.matches.find((m) => m.id === id)!;
}

// Plays a match so that slot A wins 2-0. Returns the new tournament (throws if refused).
function aWins(t: Tournament, scope: BracketScope, id: string): Tournament {
  const bracket =
    scope.kind === 'playoff' ? t.playoff! : t.groups.find((g) => g.id === scope.groupId)!.bracket;
  const m = bracket.matches.find((x) => x.id === id)!;
  const need = m.format.kind === 'bestOf' ? Math.ceil(m.format.n / 2) : m.format.n;
  const res = enterScore(t, scope, id, need, 0);
  if (!res.ok) throw new Error(res.reason);
  return res.tournament;
}

describe('entering a score', () => {
  it('refuses an impossible score with a message and changes nothing', () => {
    const t = createTournament(['A', 'B', 'C', 'D'], config(true));
    const id = 'po-wb-r1-m1';
    const res = enterScore(t, PLAYOFF, id, 3, 2); // 3-2 in a Bo3
    expect(res.ok).toBe(false);
    expect(!res.ok && res.reason).toMatch(/win more than 2 games/);
    expect(find(t, id).winner).toBeNull();
    // Other impossible lines
    expect(enterScore(t, PLAYOFF, id, 2, 2).ok).toBe(false);
    expect(enterScore(t, PLAYOFF, id, 1, 1).ok).toBe(false);
    expect(enterScore(t, PLAYOFF, id, -1, 2).ok).toBe(false);
    expect(enterScore(t, PLAYOFF, id, 1.5, 0).ok).toBe(false);
  });

  it('records a valid score, leaves the old tournament untouched, and stores the winner', () => {
    const t = createTournament(['A', 'B', 'C', 'D'], config(true));
    const id = 'po-wb-r1-m1';
    const res = enterScore(t, PLAYOFF, id, 2, 1);
    expect(res.ok).toBe(true);
    const next = res.ok ? res.tournament : t;
    expect(find(next, id).winner).toBe(find(next, id).playerA);
    expect(find(next, id).scoreA).toBe(2);
    expect(find(next, id).scoreB).toBe(1);
    expect(find(t, id).winner).toBeNull(); // the original was not changed
  });

  it('tells apart a score in Bo1 (1-0) from Bo5 (3-0)', () => {
    const t = createTournament(['A', 'B'], { ...config(true), playoffFormat: BO1 });
    const id = 'po-wb-r1-m1';
    expect(enterScore(t, PLAYOFF, id, 1, 0).ok).toBe(true);
    expect(enterScore(t, PLAYOFF, id, 2, 0).ok).toBe(false);
  });
});

describe('fixing an earlier result', () => {
  function played(): Tournament {
    let t = createTournament(['A', 'B', 'C', 'D'], config(true));
    t = aWins(t, PLAYOFF, 'po-wb-r1-m1');
    t = aWins(t, PLAYOFF, 'po-wb-r1-m2');
    t = aWins(t, PLAYOFF, 'po-wb-r2-m1'); // winners final
    t = aWins(t, PLAYOFF, 'po-lb-r1-m1'); // first losers match
    return t;
  }

  it('warns how many later results depend on it, then clears only those', () => {
    const t = played();
    const lost = resultsLostByEdit(t, PLAYOFF, 'po-wb-r1-m1');
    expect(lost).toBeGreaterThan(0);

    const m1 = find(t, 'po-wb-r1-m1');
    // Flip the result of match 1: the other player now wins 2-0.
    const res = correctScore(t, PLAYOFF, 'po-wb-r1-m1', 0, 2);
    expect(res.ok).toBe(true);
    const fixed = res.ok ? res.tournament : t;

    expect(find(fixed, 'po-wb-r1-m1').winner).toBe(m1.playerB);
    // Results that depended on it are gone ...
    expect(find(fixed, 'po-wb-r2-m1').winner).toBeNull();
    expect(find(fixed, 'po-lb-r1-m1').winner).toBeNull();
    // ... but the independent match keeps its result and score.
    expect(find(fixed, 'po-wb-r1-m2').winner).toBe(find(t, 'po-wb-r1-m2').winner);
    expect(find(fixed, 'po-wb-r1-m2').scoreA).toBe(find(t, 'po-wb-r1-m2').scoreA);
  });

  it('says 0 when a correction changes nothing downstream', () => {
    let t = createTournament(['A', 'B', 'C', 'D'], config(true));
    t = aWins(t, PLAYOFF, 'po-wb-r1-m1');
    expect(resultsLostByEdit(t, PLAYOFF, 'po-wb-r1-m1')).toBe(0);
  });

  it('can clear a result back to "not played"', () => {
    const t = played();
    const res = clearResult(t, PLAYOFF, 'po-wb-r1-m1');
    expect(res.ok).toBe(true);
    const cleared = res.ok ? res.tournament : t;
    expect(find(cleared, 'po-wb-r1-m1').winner).toBeNull();
    expect(find(cleared, 'po-wb-r1-m1').scoreA).toBeNull();
    expect(find(cleared, 'po-wb-r2-m1').winner).toBeNull();
  });

  it('refuses an impossible corrected score', () => {
    const t = played();
    expect(correctScore(t, PLAYOFF, 'po-wb-r1-m1', 3, 1).ok).toBe(false);
  });
});

describe('changing a round match length', () => {
  it('warns how many results would be wiped and clears exactly those', () => {
    let t = createTournament(['A', 'B', 'C', 'D'], config(true));
    // A 2-1 score is valid in Bo3 but impossible in Bo1.
    const res = enterScore(t, PLAYOFF, 'po-wb-r1-m1', 2, 1);
    t = res.ok ? res.tournament : t;
    expect(resultsLostByFormat(t, PLAYOFF, 'winners', 1, BO1)).toBeGreaterThanOrEqual(1);
    const changed = changeRoundFormat(t, PLAYOFF, 'winners', 1, BO1);
    expect(changed.ok).toBe(true);
    const next = changed.ok ? changed.tournament : t;
    expect(find(next, 'po-wb-r1-m1').format).toEqual(BO1);
    expect(find(next, 'po-wb-r1-m1').winner).toBeNull();
    // The preview itself changed nothing.
    expect(find(t, 'po-wb-r1-m1').winner).not.toBeNull();
  });

  it('changes with no loss when no result is entered yet', () => {
    const t = createTournament(['A', 'B', 'C', 'D'], config(true));
    expect(resultsLostByFormat(t, PLAYOFF, 'winners', 1, BO5)).toBe(0);
    const res = changeRoundFormat(t, PLAYOFF, 'winners', 1, BO5);
    expect(res.ok && find(res.tournament, 'po-wb-r1-m2').format).toEqual(BO5);
  });
});

describe('group stage to playoff', () => {
  function playGroups(t0: Tournament): Tournament {
    let t = t0;
    for (const g of t.groups) {
      let guard = 0;
      for (;;) {
        const current = t.groups.find((x) => x.id === g.id)!;
        if (isComplete(current.bracket) || guard++ > 500) break;
        const m = current.bracket.matches.find((x) => x.winner === null && x.playerA && x.playerB);
        if (!m) break;
        t = aWins(t, { kind: 'group', groupId: g.id }, m.id);
      }
    }
    return t;
  }

  it('is NOT finished at the start and the playoff cannot be started early', () => {
    const t = createTournament(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], config(false));
    expect(t.groups.length).toBe(2);
    expect(groupsFinished(t)).toBe(false);
    const early = startPlayoff(t);
    expect(early.ok).toBe(false);
  });

  it('starts the playoff once every group is played', () => {
    const t = playGroups(
      createTournament(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], config(false)),
    );
    expect(groupsFinished(t)).toBe(true);
    const res = startPlayoff(t);
    expect(res.ok).toBe(true);
    const next = res.ok ? res.tournament : t;
    expect(next.phase).toBe('playoff');
    expect(next.playoff).not.toBeNull();
    // 2 groups, top 2 of each advance (see planGrouping): 4 players in the final bracket.
    const inPlayoff = new Set(
      next.playoff!.matches.flatMap((m) => [m.playerA, m.playerB]).filter(Boolean),
    );
    expect(inPlayoff.size).toBe(4);
  });
});
