// Decides whether the small "TEST" label shows. It shows on every build that uses a database other
// than the real one (AC39). The real project's id is public (it is in the app's web address).

export const REAL_PROJECT_ID = 'tuoqpcgdvoiruwtfymjk';

// True when a Supabase address is set and it is not the real project.
export function isTestDatabase(url: string | undefined): boolean {
  if (!url || url.trim() === '') return false; // no database set: the setup screen shows instead
  return !url.toLowerCase().includes(`//${REAL_PROJECT_ID}.`);
}
