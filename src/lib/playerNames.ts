// Checks a typed player name: not empty, not longer than the database allows (60 characters).

export const MAX_PLAYER_NAME = 60;

export type NameCheck = { ok: true; name: string } | { ok: false; message: string };

export function checkPlayerName(raw: string): NameCheck {
  const name = raw.trim();
  if (!name) return { ok: false, message: 'Please type a name.' };
  if (name.length > MAX_PLAYER_NAME) {
    return { ok: false, message: `Names can be at most ${MAX_PLAYER_NAME} letters long.` };
  }
  return { ok: true, name };
}
