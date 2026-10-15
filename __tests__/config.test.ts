// Tests that placeholder or empty Supabase settings are treated as "not set up yet".
import { readSupabaseConfig } from '../src/config';

describe('readSupabaseConfig', () => {
  it('returns null when extra is missing', () => expect(readSupabaseConfig(undefined)).toBeNull());
  it('returns null for empty values', () =>
    expect(readSupabaseConfig({ supabaseUrl: '', supabasePublishableKey: '' })).toBeNull());
  it('returns null for the .env.example placeholders', () =>
    expect(
      readSupabaseConfig({
        supabaseUrl: 'https://YOUR-PROJECT-REF.supabase.co',
        supabasePublishableKey: 'YOUR-PUBLISHABLE-KEY',
      }),
    ).toBeNull());
  it('returns the values when filled in', () =>
    expect(
      readSupabaseConfig({
        supabaseUrl: 'https://abc.supabase.co',
        supabasePublishableKey: 'sb_publishable_x',
      }),
    ).toEqual({
      url: 'https://abc.supabase.co',
      publishableKey: 'sb_publishable_x',
    }));
});
