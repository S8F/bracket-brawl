// Turns a database or network error into one plain sentence that is safe to show on screen.

interface ErrorLike {
  code?: string;
  message?: string;
}

const NETWORK_HINTS = ['network request failed', 'failed to fetch', 'network error', 'timed out'];

export function friendlyDataError(error: ErrorLike | null | undefined): string {
  const text = (error?.message ?? '').toLowerCase();
  if (NETWORK_HINTS.some((hint) => text.includes(hint))) {
    return "Couldn't reach the internet. Check your connection and try again.";
  }
  if (error?.code === '23505') return 'You already have a player with that name.';
  if (error?.code === '42501' || error?.code === 'PGRST301') {
    return 'Your login has expired. Please log out and log in again.';
  }
  return 'Something went wrong while talking to the server. Please try again.';
}
