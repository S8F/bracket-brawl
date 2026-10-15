// Bracket engine: resolves slot references into concrete players,
// auto-resolves byes, records match results, advances winners/losers,
// handles the grand-final bracket reset, and computes placements.
//
// All functions are pure-ish: they mutate the passed-in bracket object
// (which the caller clones first). Kept free of React.

import { checkScore } from "./types";
import type {
  DoubleElimBracket,
  Match,
  MatchFormat,
  PlayerId,
  SlotRef,
} from "./types";

function matchMap(b: DoubleElimBracket): Map<string, Match> {
  const m = new Map<string, Match>();
  for (const x of b.matches) m.set(x.id, x);
  return m;
}

// A match is "dead" when both its slots are decided-empty: it can never
// produce a winner or loser. We compute this recursively (a match whose
// inputs are all dead/empty is itself dead).
function isDead(m: Match, byId: Map<string, Match>): boolean {
  const aEmpty = slotDecided(m.a, byId) && resolveSlot(m.a, byId) === null;
  const bEmpty = slotDecided(m.b, byId) && resolveSlot(m.b, byId) === null;
  return aEmpty && bEmpty;
}

// Resolve a slot ref to a player id, or null if not yet known / empty.
function resolveSlot(ref: SlotRef, byId: Map<string, Match>): PlayerId | null {
  switch (ref.kind) {
    case "player":
      return ref.playerId;
    case "empty":
      return null;
    case "winnerOf":
      return byId.get(ref.matchId)?.winner ?? null;
    case "loserOf":
      return byId.get(ref.matchId)?.loser ?? null;
  }
}

// Whether a slot ref is "decided" — i.e. we know it will never get a player
// (empty / dead source) or it already has one.
function slotDecided(ref: SlotRef, byId: Map<string, Match>): boolean {
  if (ref.kind === "empty") return true;
  if (ref.kind === "player") return true;
  const src = byId.get(ref.matchId);
  if (!src) return true;
  if (ref.kind === "winnerOf") {
    if (src.winner !== null) return true;
    // A dead source will never produce a winner -> this slot is decided-empty.
    return isDead(src, byId);
  }
  // loserOf: decided once the source has a winner (bye => no loser => empty),
  // or once the source is dead (no contest at all).
  return src.winner !== null || isDead(src, byId);
}

// Recompute every match's playerA/playerB from refs, then auto-resolve byes
// and cascade until stable. Returns the bracket (mutated).
export function refresh(b: DoubleElimBracket): DoubleElimBracket {
  const byId = matchMap(b);
  let changed = true;
  let guard = 0;
  while (changed && guard < 1000) {
    changed = false;
    guard++;
    for (const m of b.matches) {
      const pa = resolveSlot(m.a, byId);
      const pb = resolveSlot(m.b, byId);
      if (pa !== m.playerA) {
        m.playerA = pa;
        changed = true;
      }
      if (pb !== m.playerB) {
        m.playerB = pb;
        changed = true;
      }
      // Bye auto-resolution: if one side is decided-empty and the other has a
      // player, the player advances automatically.
      if (m.winner === null) {
        const aDecided = slotDecided(m.a, byId);
        const bDecided = slotDecided(m.b, byId);
        if (aDecided && bDecided) {
          if (m.playerA && !m.playerB) {
            recordWin(b, m.id, m.playerA, true);
            changed = true;
          } else if (m.playerB && !m.playerA) {
            recordWin(b, m.id, m.playerB, true);
            changed = true;
          }
          // both empty => match is dead; leave it.
        }
      }
    }
  }
  computePlacements(b);
  return b;
}

// Record a winner for a match and push winner/loser into downstream slots.
export function recordWin(
  b: DoubleElimBracket,
  matchId: string,
  winnerId: PlayerId,
  isBye = false
): DoubleElimBracket {
  const byId = matchMap(b);
  const m = byId.get(matchId);
  if (!m) return b;
  if (m.winner) return b; // already decided; ignore double-clicks

  const a = m.playerA;
  const bp = m.playerB;
  if (winnerId !== a && winnerId !== bp) return b; // invalid

  m.winner = winnerId;
  m.loser = winnerId === a ? bp : a;
  m.isBye = isBye;

  // Grand-final reset logic: if this is the first grand final and the LB
  // player (slot b) wins, trigger the reset match instead of ending.
  if (m.side === "grandFinal" && m.round === 1) {
    const resetId = `${m.id}-reset`;
    const reset = byId.get(resetId);
    if (reset) {
      const wbPlayer = a; // slot a = came from winners side
      const lbPlayer = bp; // slot b = came from losers side
      if (winnerId === lbPlayer) {
        // Bracket reset triggered: both play again, fresh.
        reset.a = { kind: "player", playerId: wbPlayer! };
        reset.b = { kind: "player", playerId: lbPlayer! };
      } else {
        // WB player won outright: reset never happens, kill it.
        reset.a = { kind: "empty" };
        reset.b = { kind: "empty" };
      }
    }
  }

  // Push to downstream slots.
  if (m.winnerTo) {
    const t = byId.get(m.winnerTo.matchId);
    if (t) setSlot(t, m.winnerTo.slot, { kind: "player", playerId: winnerId });
  }
  if (m.loserTo && m.loser) {
    const t = byId.get(m.loserTo.matchId);
    if (t) setSlot(t, m.loserTo.slot, { kind: "player", playerId: m.loser });
  }

  return b;
}

function setSlot(m: Match, slot: "a" | "b", ref: SlotRef) {
  if (slot === "a") m.a = ref;
  else m.b = ref;
}

// A public entry: record a result then re-stabilize the whole bracket.
export function reportResult(
  b: DoubleElimBracket,
  matchId: string,
  winnerId: PlayerId
): DoubleElimBracket {
  recordWin(b, matchId, winnerId);
  return refresh(b);
}

// Result of trying to enter a game score for a match.
export type ScoreResult =
  | { ok: true; bracket: DoubleElimBracket }
  | { ok: false; reason: string };

// Validate a per-game score for `matchId` against its format, then (if valid)
// record the DERIVED winner and re-stabilize the bracket. The score is stored
// on the match (scoreA / scoreB) so it can be displayed. An invalid score (e.g.
// 3-2 in a Bo3, or both sides reaching the target) is rejected and the bracket
// is left untouched. Slot a's wins = scoreA, slot b's = scoreB.
//
// Use this for a FRESH (undecided) match. To CHANGE an already-decided score,
// use editScore, which first tears down anything the old result fed downstream.
export function reportScore(
  b: DoubleElimBracket,
  matchId: string,
  scoreA: number,
  scoreB: number
): ScoreResult {
  const m = b.matches.find((x) => x.id === matchId);
  if (!m) return { ok: false, reason: "Match not found." };
  if (!m.playerA || !m.playerB) {
    return { ok: false, reason: "Both players must be known before entering a score." };
  }
  const check = checkScore(m.format, scoreA, scoreB);
  if (!check.ok) return { ok: false, reason: check.reason };

  const winnerId = check.winningSide === "a" ? m.playerA : m.playerB;
  m.scoreA = scoreA;
  m.scoreB = scoreB;
  recordWin(b, matchId, winnerId);
  return { ok: true, bracket: refresh(b) };
}

// Edit the score of an already-decided match (the score equivalent of
// editResult). Tears down whatever the OLD result fed downstream (so later
// matches that depended on the old winner are reset), then records the new
// score's derived winner and re-stabilizes. Invalid scores are rejected and the
// bracket is left untouched.
export function editScore(
  b: DoubleElimBracket,
  matchId: string,
  scoreA: number,
  scoreB: number
): ScoreResult {
  const byId = matchMap(b);
  const m = byId.get(matchId);
  if (!m) return { ok: false, reason: "Match not found." };
  if (!m.playerA || !m.playerB) {
    return { ok: false, reason: "Both players must be known before entering a score." };
  }
  const check = checkScore(m.format, scoreA, scoreB);
  if (!check.ok) return { ok: false, reason: check.reason };

  // Tear down whatever this match previously pushed downstream, then clear it.
  cascadeReset(b, byId, matchId);
  clearMatchResult(m);

  const winnerId = check.winningSide === "a" ? m.playerA : m.playerB;
  m.scoreA = scoreA;
  m.scoreB = scoreB;
  recordWin(b, matchId, winnerId);
  return { ok: true, bracket: refresh(b) };
}

// ----- Editing / correcting a decided result -------------------------------
//
// A result that's already been entered (a misclick) can be CHANGED — flipped to
// the other player, or cleared back to undecided. Because winners/losers were
// pushed forward into later matches, changing one can invalidate matches it fed
// into. Those downstream matches are RESET: their fed slot is put back to its
// original lazy reference (winnerOf/loserOf the feeder) and their own result is
// cleared, recursively. Then `refresh` re-resolves the whole bracket from the
// corrected state, so byes, the grand-final reset, placements (and therefore
// the live standings/points/Open-Closed status that derive from them) all
// recompute correctly.

// Reset ONE downstream match's fed slot back to the lazy ref of its feeder, and
// clear that downstream match's own result. Returns true if anything changed.
function resetFedSlot(
  target: Match,
  slot: "a" | "b",
  feederId: string,
  kind: "winnerOf" | "loserOf"
): void {
  setSlot(target, slot, { kind, matchId: feederId });
  // The pushed-in player is gone; this match can no longer stand as decided.
  clearMatchResult(target);
}

// Wipe a match's recorded outcome (but not its slot refs). Used when a feeder
// upstream changed and this match must be replayed.
function clearMatchResult(m: Match): void {
  m.winner = null;
  m.loser = null;
  m.isBye = false;
  // The recorded game score is part of the result and must clear with it, so a
  // reset / replayed match starts from a blank score.
  m.scoreA = null;
  m.scoreB = null;
  // A reset match cannot leave a stale player resolved from a now-lazy slot;
  // refresh() recomputes playerA/playerB from the refs.
}

// Walk everything a match feeds (winner side AND loser side, transitively) and
// reset each fed slot + clear the downstream result. `collect`, when provided,
// records every match id that was reset (used by the preview). The grand-final
// reset match is also handled: if the changed match is GF round 1, its reset
// child is neutralised so refresh can re-decide whether a reset is needed.
function cascadeReset(
  b: DoubleElimBracket,
  byId: Map<string, Match>,
  matchId: string,
  collect?: Set<string>
): void {
  const m = byId.get(matchId);
  if (!m) return;

  // Grand-final round 1 directly controls its reset child's slots.
  if (m.side === "grandFinal" && m.round === 1) {
    const reset = byId.get(`${m.id}-reset`);
    if (reset && (reset.playerA || reset.playerB || reset.winner)) {
      // Only a reset that was actually PLAYED counts as a result being cleared.
      if (reset.winner !== null) collect?.add(reset.id);
      reset.a = { kind: "empty" };
      reset.b = { kind: "empty" };
      clearMatchResult(reset);
      // Reset has no further downstream (it's the last match).
    }
  }

  if (m.winnerTo) {
    const t = byId.get(m.winnerTo.matchId);
    // Only act if the target is actually carrying our pushed-in player. If it's
    // still lazy/empty there's nothing downstream to undo. We always restore
    // the slot ref (so refresh re-resolves the corrected player), but a later
    // match only counts as "reset" — and only triggers the warning — when it
    // had a recorded RESULT to clear.
    if (t && (t.playerA || t.playerB || t.winner)) {
      if (t.winner !== null) collect?.add(t.id);
      resetFedSlot(t, m.winnerTo.slot, m.id, "winnerOf");
      cascadeReset(b, byId, t.id, collect);
    }
  }
  if (m.loserTo) {
    const t = byId.get(m.loserTo.matchId);
    if (t && (t.playerA || t.playerB || t.winner)) {
      if (t.winner !== null) collect?.add(t.id);
      resetFedSlot(t, m.loserTo.slot, m.id, "loserOf");
      cascadeReset(b, byId, t.id, collect);
    }
  }
}

// PREVIEW: which other matches would be RESET (their result cleared) if the
// given match's outcome were changed? Returns the affected match ids (NOT
// including the edited match itself). Pure — does not mutate the bracket.
// Empty array => the change is a clean flip with no downstream effect.
export function downstreamImpact(
  b: DoubleElimBracket,
  matchId: string
): string[] {
  const m = b.matches.find((x) => x.id === matchId);
  if (!m || m.winner === null) return [];
  // Work on a clone so the preview never touches the real bracket.
  const clone: DoubleElimBracket = JSON.parse(JSON.stringify(b));
  const byId = matchMap(clone);
  const collected = new Set<string>();
  cascadeReset(clone, byId, matchId, collected);
  return [...collected];
}

// Apply an EDIT to a decided match: set a new winner, or clear it entirely
// (newWinnerId = null). Resets every downstream match the old result fed, then
// re-stabilises the whole bracket. Safe to call on an undecided match (it just
// records the winner, like reportResult). Invalid winner ids are ignored.
export function editResult(
  b: DoubleElimBracket,
  matchId: string,
  newWinnerId: PlayerId | null
): DoubleElimBracket {
  const byId = matchMap(b);
  const m = byId.get(matchId);
  if (!m) return b;

  // Validate a non-null new winner against the CURRENT participants.
  if (newWinnerId !== null && newWinnerId !== m.playerA && newWinnerId !== m.playerB) {
    return b;
  }

  // Tear down whatever this match previously pushed downstream.
  cascadeReset(b, byId, matchId);

  // Clear this match's own result so recordWin will re-apply cleanly.
  clearMatchResult(m);

  if (newWinnerId !== null) {
    recordWin(b, matchId, newWinnerId);
  }
  return refresh(b);
}

// Is the bracket fully resolved? (grand final or reset has a winner, or only
// one match exists / trivial).
export function isComplete(b: DoubleElimBracket): boolean {
  const byId = matchMap(b);
  const gf = b.matches.find((m) => m.side === "grandFinal" && m.round === 1);
  if (!gf) {
    // No grand final (e.g. single player). Complete if no playable match is open.
    return b.matches.every((m) => m.winner !== null || deadMatch(m));
  }
  const reset = byId.get(`${gf.id}-reset`);
  if (gf.winner === null) return false;
  // If reset is active (has players), it must also be decided.
  if (reset && (reset.playerA || reset.playerB)) {
    return reset.winner !== null;
  }
  return true;
}

function deadMatch(m: Match): boolean {
  const aDead = m.a.kind === "empty";
  const bDead = m.b.kind === "empty";
  return aDead && bDead;
}

// The champion of a resolved bracket.
export function champion(b: DoubleElimBracket): PlayerId | null {
  const byId = matchMap(b);
  const gf = b.matches.find((m) => m.side === "grandFinal" && m.round === 1);
  if (!gf) {
    // Single-player bracket: that player is champion.
    const ids = new Set<PlayerId>();
    for (const m of b.matches) {
      if (m.playerA) ids.add(m.playerA);
      if (m.playerB) ids.add(m.playerB);
    }
    return ids.size === 1 ? [...ids][0] : null;
  }
  const reset = byId.get(`${gf.id}-reset`);
  if (reset && (reset.playerA || reset.playerB)) {
    return reset.winner;
  }
  return gf.winner;
}

// Compute placements (best -> worst) using elimination order.
// A player's finishing rank is determined by the latest match they lost in
// (later loss = better placement). The grand-final winner is 1st.
export function computePlacements(b: DoubleElimBracket): void {
  const byId = matchMap(b);
  const players = new Set<PlayerId>();
  for (const m of b.matches) {
    if (m.playerA) players.add(m.playerA);
    if (m.playerB) players.add(m.playerB);
  }

  // "Strength" score = the index of the deepest match (in resolution order)
  // a player participated in and lost. Higher = eliminated later = better.
  // We approximate match depth by a weight per side+round.
  const weight = (m: Match): number => {
    if (m.side === "grandFinal") return 100000 + m.round;
    if (m.side === "losers") return 10000 + m.round * 10;
    return m.round; // winners-bracket losses are "earliest" relative depth
  };

  // For double-elim, a player is truly eliminated when they lose in the LB
  // (or lose the grand final). Track each player's elimination weight.
  const elimWeight = new Map<PlayerId, number>();
  const champ = champion(b);

  for (const m of b.matches) {
    if (!m.loser) continue;
    // The grand-final loser and LB losers are eliminations.
    if (m.side === "winners") continue; // WB loss just drops to LB, not out
    const w = weight(m);
    const cur = elimWeight.get(m.loser);
    if (cur === undefined || w > cur) elimWeight.set(m.loser, w);
  }

  const ranked = [...players].sort((x, y) => {
    if (x === champ) return -1;
    if (y === champ) return 1;
    const wx = elimWeight.get(x) ?? -1;
    const wy = elimWeight.get(y) ?? -1;
    return wy - wx; // eliminated later first
  });

  b.placements = ranked;
}

// ----- Per-round format changes --------------------------------------------
//
// Change the match format for every match on one (side, round) of a bracket —
// e.g. make "Winners Round 1" a Bo5. Each match's stored score is re-checked
// against the new format:
//   - no score yet  -> just restamp the format.
//   - score still valid AND derives the same winner -> restamp, keep result.
//   - score still valid but derives a DIFFERENT winner -> treat like an edit:
//       tear down downstream, re-record the new winner, keep the score.
//   - score no longer valid under the new format -> clear the result (and any
//       downstream that depended on it); the match must be re-entered.
// After touching the affected matches, the whole bracket is re-stabilized.
//
// Returns the count of matches whose recorded RESULT was cleared (so the UI can
// warn). A bye match (winner with no score) is left as-is.
export function setRoundFormat(
  b: DoubleElimBracket,
  side: Match["side"],
  round: number,
  format: MatchFormat,
  collect?: Set<string>
): number {
  const byId = matchMap(b);
  const targets = b.matches.filter((m) => m.side === side && m.round === round);
  let cleared = 0;

  for (const m of targets) {
    m.format = format;
    if (m.scoreA === null || m.scoreB === null) continue; // no score (incl. byes)

    const check = checkScore(format, m.scoreA, m.scoreB);
    if (!check.ok) {
      // Score can't exist under the new format -> tear down + clear this match
      // AND every later match its old result fed.
      if (m.winner !== null) {
        cleared++;
        collect?.add(m.id);
      }
      cascadeReset(b, byId, m.id, collect);
      clearMatchResult(m);
      continue;
    }
    const newWinner = check.winningSide === "a" ? m.playerA : m.playerB;
    if (newWinner !== m.winner) {
      // Winner flips under the new format -> re-record (resets downstream too).
      if (m.winner !== null) {
        cleared++;
        collect?.add(m.id);
      }
      const sa = m.scoreA;
      const sb = m.scoreB;
      cascadeReset(b, byId, m.id, collect);
      clearMatchResult(m);
      if (newWinner) {
        m.scoreA = sa;
        m.scoreB = sb;
        recordWin(b, m.id, newWinner);
      }
    }
    // else: same winner, score still valid -> nothing else to do.
  }

  refresh(b);
  return cleared;
}

// PREVIEW (non-destructive): the ids of recorded results that would be CLEARED
// if the given (side, round) format changed to `format` — the affected matches
// themselves plus any later matches their old results fed. Runs on a clone so
// nothing real is touched. Empty => a clean change with no lost results.
export function roundFormatImpact(
  b: DoubleElimBracket,
  side: Match["side"],
  round: number,
  format: MatchFormat
): string[] {
  const clone: DoubleElimBracket = JSON.parse(JSON.stringify(b));
  const collected = new Set<string>();
  setRoundFormat(clone, side, round, format, collected);
  return [...collected];
}
