// A tiny helper so the bracket tests copied from the web app keep their original "check(true/false, message)"
// lines. A false check fails the test and prints its message.

export function check(condition: boolean, message: string): void {
  expect({ message, passed: condition }).toEqual({ message, passed: true });
}
