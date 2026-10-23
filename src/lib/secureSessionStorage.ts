// Storage for the saved Supabase login session.
// Expo's SecureStore (iPhone Keychain) can refuse values over ~2048 bytes, and a Supabase session
// (two tokens plus the user record) can be bigger. So we use Supabase's documented "LargeSecureStore"
// pattern: a fresh AES-256 key lives in SecureStore (Keychain); the encrypted session lives in
// AsyncStorage. AsyncStorage never holds a readable session.
// Source: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/getting-started/tutorials/with-expo-react-native.mdx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';

export class LargeSecureStore {
  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    try {
      const keyHex = await SecureStore.getItemAsync(key);
      if (!keyHex) {
        // No Keychain key: whatever sits in AsyncStorage is unreadable ciphertext or a plain session
        // from an older build. Delete it so no readable session is left behind.
        await AsyncStorage.removeItem(key);
        return null;
      }
      const cipher = new aesjs.ModeOfOperation.ctr(
        aesjs.utils.hex.toBytes(keyHex),
        new aesjs.Counter(1),
      );
      return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(encrypted)));
    } catch {
      return null; // unreadable or half-written: treat as logged out
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = Crypto.getRandomBytes(32); // 256-bit key, new on every save
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encrypted = aesjs.utils.hex.fromBytes(cipher.encrypt(aesjs.utils.utf8.toBytes(value)));
    // Ciphertext first, key second: a crash in between leaves an unreadable session (read as
    // logged out), never a mismatched one.
    await AsyncStorage.setItem(key, encrypted);
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}
