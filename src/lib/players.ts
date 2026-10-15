// Mid-tournament player operations: REPLACE a player's identity (a substitute
// stepping into an existing slot, keeping that slot's recorded wins/losses) and
// ADD a brand-new player (which changes the field size, so the bracket is
// rebuilt / re-seeded from scratch).
//
// Both are pure: they take a Tournament and return a NEW Tournament (or throw a
// clear error). The UI clones / persists the result. Keeping this in the lib
// layer makes it unit-testable with no React.

import { createTournament } from "./tournament";
import type { Player, PlayerId, Tournament } from "./types";

// Thrown when a player operation can't be applied (unknown player, duplicate
// name, etc.). Carries a user-facing message.
export class PlayerOpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayerOpError";
  }
}

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

// Replace the IDENTITY of one player slot with a different person, keeping that
// player's id — and therefore every win/loss, every downstream advancement —
// exactly as it stands. Use case: a substitute steps in for someone who dropped
// out. The match history is unchanged; only the displayed name changes.
//
// Rules:
//  - `playerId` must be a current participant.
//  - `newName` must be non-blank.
//  - `newName` must NOT already belong to a DIFFERENT participant (that would
//    create two identical names in the bracket) — blocked with a clear message.
//  - Renaming to the same person (same id, same/closer casing) is allowed and
//    simply refreshes the casing.
export function replacePlayerIdentity(
  t: Tournament,
  playerId: PlayerId,
  newName: string
): Tournament {
  const name = newName.trim();
  if (!name) {
    throw new PlayerOpError("The replacement needs a name.");
  }
  const current = t.players[playerId];
  if (!current) {
    throw new PlayerOpError("That player is not in this tournament.");
  }

  // Block a name that already belongs to a DIFFERENT player in the tournament.
  const clashKey = nameKey(name);
  for (const [pid, p] of Object.entries(t.players)) {
    if (pid === playerId) continue;
    if (nameKey(p.name) === clashKey) {
      throw new PlayerOpError(
        `"${p.name}" is already in this tournament — pick someone else.`
      );
    }
  }

  const updated: Player = { ...current, name };
  return {
    ...t,
    players: { ...t.players, [playerId]: updated },
  };
}

// All participant display names, in insertion order.
export function participantNames(t: Tournament): string[] {
  return Object.values(t.players).map((p) => p.name);
}

// Add a NEW player to the tournament. Because the field size changes, the only
// correct thing to do is REBUILD the bracket from the new player set — there is
// no safe way to splice a fresh entrant into an in-progress double-elim tree.
// This DISCARDS all in-progress results (the UI warns + confirms first).
//
// Rules:
//  - `newName` must be non-blank.
//  - `newName` must not duplicate an existing participant (case-insensitive).
// Returns a fresh Tournament built from the existing players plus the new one,
// preserving the tournament's config (formats, skip-groups).
export function addPlayer(t: Tournament, newName: string): Tournament {
  const name = newName.trim();
  if (!name) {
    throw new PlayerOpError("The new player needs a name.");
  }
  const key = nameKey(name);
  for (const p of Object.values(t.players)) {
    if (nameKey(p.name) === key) {
      throw new PlayerOpError(
        `"${p.name}" is already in this tournament.`
      );
    }
  }

  const names = [...participantNames(t), name];
  // createTournament re-validates, re-seeds, and rebuilds groups/playoff using
  // the SAME config so the user's chosen formats carry over.
  return createTournament(names, t.config);
}
