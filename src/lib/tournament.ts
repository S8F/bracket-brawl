// Tournament orchestration: turns a flat list of usernames into the
// esports tournament structure (as at the Esports World Cup) — group stage (double-elim mini-brackets)
// then a single double-elimination playoff.
//
// Grouping rule chosen (EWC model, scaled):
//  - Target group size = 8, top 4 advance (Esports World Cup).
//  - Players are split into the FEWEST groups of size <= 8, balanced.
//  - Advance count per group scales to half the group (rounded up to keep
//    the playoff a clean power-of-two-ish field), min 1, capped at 4.
//  - Non-divisible counts produce uneven groups; byes inside each group's
//    double-elim handle odd sizes gracefully.
//  - If there are <= 8 players total, we skip groups entirely and go
//    straight to one playoff double-elim (the field is already a "Top 8").

import { buildDoubleElim } from "./doubleElim";
import { refresh } from "./engine";
import {
  DEFAULT_CONFIG,
  type DoubleElimBracket,
  type Group,
  type Player,
  type PlayerId,
  type Tournament,
  type TournamentConfig,
} from "./types";

// Thrown when createTournament is given input that can't form a valid
// tournament (too few players, or duplicate names). The UI guards against
// these, but the engine enforces them too so any caller is protected.
export class InvalidTournamentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTournamentError";
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// Fisher-Yates shuffle (random seeding for v1).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface GroupingPlan {
  groupCount: number;
  sizes: number[]; // size of each group
  advancePerGroup: number[];
  skipGroups: boolean;
}

export function planGrouping(
  playerCount: number,
  forceSkipGroups = false
): GroupingPlan {
  if (forceSkipGroups || playerCount <= 8) {
    return {
      groupCount: 0,
      sizes: [],
      advancePerGroup: [],
      skipGroups: true,
    };
  }
  const maxGroupSize = 8;
  const groupCount = Math.ceil(playerCount / maxGroupSize);
  // Balance sizes as evenly as possible.
  const base = Math.floor(playerCount / groupCount);
  const remainder = playerCount % groupCount;
  const sizes: number[] = [];
  for (let i = 0; i < groupCount; i++) {
    sizes.push(base + (i < remainder ? 1 : 0));
  }
  // Advance count: EWC advances top 4 from groups of 8 (half). We mirror
  // "advance half", min 1, max 4.
  const advancePerGroup = sizes.map((s) =>
    Math.min(4, Math.max(1, Math.floor(s / 2)))
  );
  return { groupCount, sizes, advancePerGroup, skipGroups: false };
}

export function createTournament(
  usernames: string[],
  config: TournamentConfig = DEFAULT_CONFIG
): Tournament {
  const cleaned = usernames.map((u) => u.trim()).filter((u) => u.length > 0);

  // Validate in the engine, not just the UI: a tournament needs at least 2
  // players, and duplicate names (case-insensitive, like the create screen)
  // are rejected so the "pure" layer can never build a malformed bracket.
  if (cleaned.length < 2) {
    throw new InvalidTournamentError(
      `A tournament needs at least 2 players (got ${cleaned.length}).`
    );
  }
  const seen = new Set<string>();
  for (const name of cleaned) {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      throw new InvalidTournamentError(`Duplicate player name: "${name}".`);
    }
    seen.add(key);
  }

  const players: Record<PlayerId, Player> = {};
  const ids: PlayerId[] = [];
  for (const name of cleaned) {
    const id = uid();
    players[id] = { id, name };
    ids.push(id);
  }

  const seeded = shuffle(ids);
  const plan = planGrouping(seeded.length, config.skipGroups);

  if (plan.skipGroups) {
    // Straight to one double-elim playoff (groups skipped, or <=8 players).
    const playoff = buildDoubleElim(seeded, {
      idPrefix: "po",
      mainFormat: config.playoffFormat,
      grandFinalFormat: config.grandFinalFormat,
      labelPrefix: "",
    });
    refresh(playoff);
    return {
      players,
      config,
      phase: "playoff",
      groups: [],
      playoff,
      standings: [],
    };
  }

  // Split into groups round-robin style for balance.
  const groupBuckets: PlayerId[][] = Array.from(
    { length: plan.groupCount },
    () => []
  );
  seeded.forEach((id, i) => {
    groupBuckets[i % plan.groupCount].push(id);
  });

  const groups: Group[] = groupBuckets.map((members, i) => {
    const name = `Group ${LETTERS[i] ?? i + 1}`;
    const bracket = buildDoubleElim(members, {
      idPrefix: `g${i}`,
      mainFormat: config.groupFormat,
      // Group "grand finals" use the same group format (no special GF here).
      grandFinalFormat: config.groupFormat,
      labelPrefix: `${name} `,
    });
    refresh(bracket);
    return {
      id: `g${i}`,
      name,
      players: members,
      bracket,
      advanceCount: plan.advancePerGroup[i],
    };
  });

  return {
    players,
    config,
    phase: "groups",
    groups,
    playoff: null,
    standings: [],
  };
}

// Are all groups fully resolved?
export function groupsComplete(t: Tournament): boolean {
  return t.groups.every((g) => g.bracket.placements.length >= g.players.length);
}

// Pull the advancers (top N by placement) from each group.
export function advancersFromGroups(t: Tournament): PlayerId[] {
  const out: PlayerId[] = [];
  for (const g of t.groups) {
    const top = g.bracket.placements.slice(0, g.advanceCount);
    out.push(...top);
  }
  return out;
}

// Build the playoff once groups are done. Seeds advancers so that group
// winners are spread apart (snake seeding by group).
export function buildPlayoff(t: Tournament): DoubleElimBracket {
  // Collect per-group ranked advancers, then interleave by rank so that all
  // group winners seed first, then all 2nd places, etc.
  const perGroup = t.groups.map((g) =>
    g.bracket.placements.slice(0, g.advanceCount)
  );
  const maxAdv = Math.max(0, ...perGroup.map((a) => a.length));
  const seeds: PlayerId[] = [];
  for (let rank = 0; rank < maxAdv; rank++) {
    for (const arr of perGroup) {
      if (arr[rank]) seeds.push(arr[rank]);
    }
  }
  const playoff = buildDoubleElim(seeds, {
    idPrefix: "po",
    mainFormat: t.config.playoffFormat,
    grandFinalFormat: t.config.grandFinalFormat,
    labelPrefix: "",
  });
  refresh(playoff);
  return playoff;
}

// Final overall standings = playoff placements, with group non-advancers
// appended below (ranked by their group finish).
export function computeStandings(t: Tournament): PlayerId[] {
  if (!t.playoff) return [];
  const standings: PlayerId[] = [...t.playoff.placements];
  const inPlayoff = new Set(standings);

  // Append players who didn't make the playoff, grouped by their group rank.
  const leftovers: PlayerId[] = [];
  // Interleave by group rank for fairness.
  const perGroup = t.groups.map((g) =>
    g.bracket.placements.filter((p) => !inPlayoff.has(p))
  );
  const maxLen = Math.max(0, ...perGroup.map((a) => a.length));
  for (let rank = 0; rank < maxLen; rank++) {
    for (const arr of perGroup) {
      if (arr[rank] && !inPlayoff.has(arr[rank])) leftovers.push(arr[rank]);
    }
  }
  return [...standings, ...leftovers];
}
