// Reads the SQL files and checks the privacy rules are present (a text check; the real
// proof is supabase/tests/rls_isolation.sql run on the live project).
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = (name: string) =>
  readFileSync(join(__dirname, '..', 'supabase', 'migrations', name), 'utf8');
const tables = sql('20261015000001_private_tables.sql');
const deleteFn = sql('20261015000002_delete_my_account.sql');

describe('private tables migration', () => {
  it.each(['players', 'tournaments'])('turns row-level security on for %s', (t) => {
    expect(tables).toMatch(new RegExp(`alter table public\\.${t}\\s+enable row level security`));
  });
  it.each(['players', 'tournaments'])('has select/insert/update/delete rules for %s', (t) => {
    for (const op of ['select', 'insert', 'update', 'delete']) {
      expect(tables).toMatch(new RegExp(`create policy ${t}_${op} on public\\.${t}`));
    }
  });
  it('compares every rule to the caller id', () => {
    const policies = tables.split('create policy').slice(1);
    expect(policies).toHaveLength(8);
    for (const p of policies) expect(p).toMatch(/user_id = \(select auth\.uid\(\)\)/);
  });
  it('removes user rows when the login is deleted', () => {
    expect(tables.match(/references auth\.users \(id\) on delete cascade/g)).toHaveLength(2);
  });
  it('gives visitors who are not signed in no access', () => {
    expect(tables).toMatch(/revoke all on public\.players, public\.tournaments from anon/);
  });
});

describe('delete_my_account migration', () => {
  it('only deletes the caller own login', () =>
    expect(deleteFn).toMatch(/delete from auth\.users where id = caller/));
  it('locks the search path', () => expect(deleteFn).toMatch(/set search_path = ''/));
  it('is callable only by signed-in users', () => {
    expect(deleteFn).toMatch(
      /revoke all on function public\.delete_my_account\(\) from public, anon/,
    );
    expect(deleteFn).toMatch(
      /grant execute on function public\.delete_my_account\(\) to authenticated/,
    );
  });
});
