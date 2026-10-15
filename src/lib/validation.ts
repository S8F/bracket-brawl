// Checks what the user typed on the login screens, before anything is sent to the server.
// Each function returns an error message, or null when the value is fine.

export const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (value === '') return 'Enter your email address.';
  // Deliberately simple: one "@", something on each side, a dot in the domain. The server has the final say.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'That email address does not look right.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password === '') return 'Enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export function validatePasswordMatch(password: string, confirm: string): string | null {
  return password === confirm ? null : 'The two passwords are not the same.';
}
