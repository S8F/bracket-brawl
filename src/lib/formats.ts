// The match-length choices shown on screen (Bo1, Bo3, FT3, Bo5 and friends) and how to name them.

import { formatLabel, type MatchFormat } from './types';

// Choices when creating a tournament (per stage).
export const CREATE_FORMATS: MatchFormat[] = [
  { kind: 'bestOf', n: 3 },
  { kind: 'bestOf', n: 5 },
  { kind: 'bestOf', n: 7 },
  { kind: 'firstTo', n: 2 },
  { kind: 'firstTo', n: 3 },
  { kind: 'firstTo', n: 5 },
];

// Choices when changing one round of a running tournament: Bo1, Bo3, FT3, Bo5.
export const ROUND_FORMATS: MatchFormat[] = [
  { kind: 'bestOf', n: 1 },
  { kind: 'bestOf', n: 3 },
  { kind: 'firstTo', n: 3 },
  { kind: 'bestOf', n: 5 },
];

export function sameFormat(a: MatchFormat, b: MatchFormat): boolean {
  return a.kind === b.kind && a.n === b.n;
}

// Short name for a button, for example "Bo3" or "FT3".
export function formatShort(f: MatchFormat): string {
  return formatLabel(f);
}

// Full name for the screen reader, for example "Best of 3" or "First to 3".
export function formatSpoken(f: MatchFormat): string {
  return f.kind === 'bestOf' ? `Best of ${f.n}` : `First to ${f.n}`;
}
