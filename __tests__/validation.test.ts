// Tests for the email / password checks on the login screens.
import { validateEmail, validatePassword, validatePasswordMatch } from '../src/lib/validation';

describe('validateEmail', () => {
  it('accepts a normal address', () => expect(validateEmail('a@b.co')).toBeNull());
  it('trims spaces', () => expect(validateEmail('  a@b.co ')).toBeNull());
  it.each(['', '   ', 'abc', 'a@b', '@b.co', 'a b@c.de'])('rejects %p', (v) =>
    expect(validateEmail(v)).not.toBeNull(),
  );
});

describe('validatePassword', () => {
  it('rejects empty', () => expect(validatePassword('')).not.toBeNull());
  it('rejects 7 characters', () => expect(validatePassword('1234567')).not.toBeNull());
  it('accepts 8 characters', () => expect(validatePassword('12345678')).toBeNull());
});

describe('validatePasswordMatch', () => {
  it('accepts equal', () => expect(validatePasswordMatch('x', 'x')).toBeNull());
  it('rejects different', () => expect(validatePasswordMatch('x', 'y')).not.toBeNull());
});
