// The saved login session must never sit readable in AsyncStorage, and must survive a "restart".
const mockAsync: Record<string, string> = {};
const mockSecure: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockAsync[k] ?? null,
    setItem: async (k: string, v: string) => {
      mockAsync[k] = v;
    },
    removeItem: async (k: string) => {
      delete mockAsync[k];
    },
  },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockSecure[k] ?? null,
  setItemAsync: async (k: string, v: string) => {
    if (v.length > 2048) throw new Error('too large for SecureStore');
    mockSecure[k] = v;
  },
  deleteItemAsync: async (k: string) => {
    delete mockSecure[k];
  },
}));
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) % 256),
}));

import { LargeSecureStore } from '../src/lib/secureSessionStorage';

const KEY = 'sb-test-auth-token';
const session = JSON.stringify({
  access_token: 'a'.repeat(1200),
  refresh_token: 'r'.repeat(40),
  user: { id: 'u1', email: 'tester@example.com', user_metadata: { pad: 'x'.repeat(1500) } },
});

beforeEach(() => {
  for (const o of [mockAsync, mockSecure]) for (const k of Object.keys(o)) delete o[k];
});

test('a session bigger than 2048 bytes round-trips', async () => {
  expect(session.length).toBeGreaterThan(2048);
  const store = new LargeSecureStore();
  await store.setItem(KEY, session);
  expect(await new LargeSecureStore().getItem(KEY)).toBe(session); // fresh instance = restart
});

test('AsyncStorage holds no readable session; the key is in SecureStore', async () => {
  await new LargeSecureStore().setItem(KEY, session);
  expect(mockAsync[KEY]).not.toContain('tester@example.com');
  expect(mockAsync[KEY]).not.toContain('access_token');
  expect(mockSecure[KEY]).toHaveLength(64);
});

test('removeItem clears both places; lost key reads as logged out', async () => {
  const store = new LargeSecureStore();
  await store.setItem(KEY, session);
  delete mockSecure[KEY];
  expect(await store.getItem(KEY)).toBeNull();
  await store.setItem(KEY, session);
  await store.removeItem(KEY);
  expect(mockAsync[KEY]).toBeUndefined();
  expect(mockSecure[KEY]).toBeUndefined();
});

test('a plain session left by an older build is deleted on read when there is no key', async () => {
  mockAsync[KEY] = session; // old build stored it as plain text
  expect(await new LargeSecureStore().getItem(KEY)).toBeNull();
  expect(mockAsync[KEY]).toBeUndefined();
});
