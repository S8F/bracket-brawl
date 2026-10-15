// A pretend Supabase for tests. It keeps "players" and "tournaments" rows in memory and, like the real
// database rules, only lets each pretend user see and change their OWN rows. It can also pretend the
// internet is off. This checks the app's own code; the real privacy proof is supabase/tests/rls_isolation.sql.

import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown> & { id: string; user_id: string };
type Reply = { data: unknown; error: { code?: string; message: string } | null };

export interface FakeDb {
  tables: { players: Row[]; tournaments: Row[] };
  offline: boolean;
  nextId: number;
}

export function createFakeDb(): FakeDb {
  return { tables: { players: [], tournaments: [] }, offline: false, nextId: 1 };
}

class FakeQuery implements PromiseLike<Reply> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: Record<string, unknown> | Record<string, unknown>[] = {};
  private filters: [string, unknown][] = [];
  private orderCol: string | null = null;
  private ascending = true;
  private returnRows = false;
  private shape: 'many' | 'single' | 'maybe' = 'many';

  constructor(
    private db: FakeDb,
    private table: 'players' | 'tournaments',
    private userId: string,
  ) {}

  // Which columns are asked for does not matter here: whole rows are returned.
  select() {
    this.returnRows = true;
    return this;
  }
  insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
    this.op = 'insert';
    this.payload = rows;
    return this;
  }
  update(values: Record<string, unknown>) {
    this.op = 'update';
    this.payload = values;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orderCol = column;
    this.ascending = opts?.ascending ?? true;
    return this;
  }
  single() {
    this.shape = 'single';
    return this;
  }
  maybeSingle() {
    this.shape = 'maybe';
    return this;
  }

  then<R1 = Reply, R2 = never>(
    onfulfilled?: ((value: Reply) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  private run(): Reply {
    if (this.db.offline) {
      return { data: null, error: { message: 'TypeError: Network request failed' } };
    }
    const all = this.db.tables[this.table];
    // The privacy rule: only this user's own rows are ever visible.
    const visible = all.filter((r) => r.user_id === this.userId);
    const matching = visible.filter((r) => this.filters.every(([c, v]) => r[c] === v));

    let result: Row[] = [];
    if (this.op === 'select') {
      result = [...matching];
      if (this.orderCol) {
        const col = this.orderCol;
        result.sort(
          (a, b) => String(a[col]).localeCompare(String(b[col])) * (this.ascending ? 1 : -1),
        );
      }
    } else if (this.op === 'insert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const raw of rows) {
        if (this.table === 'players') {
          const key = String(raw.name).trim().toLowerCase();
          if (visible.some((r) => String(r.name).trim().toLowerCase() === key)) {
            return {
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            };
          }
        }
        const row: Row = {
          created_at: new Date(1_700_000_000_000 + this.db.nextId * 1000).toISOString(),
          finished_at: null,
          ...raw,
          id: `id-${this.db.nextId++}`,
          user_id: this.userId,
        };
        all.push(row);
        result.push(row);
      }
    } else if (this.op === 'update') {
      if (this.table === 'players' && 'name' in this.payload) {
        const key = String(this.payload.name).trim().toLowerCase();
        const clash = visible.some(
          (r) => !matching.includes(r) && String(r.name).trim().toLowerCase() === key,
        );
        if (clash) {
          return {
            data: null,
            error: { code: '23505', message: 'duplicate key value violates unique constraint' },
          };
        }
      }
      for (const row of matching) Object.assign(row, this.payload);
      result = matching;
    } else {
      this.db.tables[this.table] = all.filter((r) => !matching.includes(r));
    }

    const data = this.returnRows || this.op === 'select' ? result : null;
    if (this.shape === 'single') {
      return data && data.length === 1
        ? { data: data[0], error: null }
        : { data: null, error: { message: 'single row expected' } };
    }
    if (this.shape === 'maybe') return { data: data && data.length ? data[0] : null, error: null };
    return { data, error: null };
  }
}

// A client that acts as the given pretend user.
export function fakeClientFor(db: FakeDb, userId: string): SupabaseClient {
  return {
    from: (table: 'players' | 'tournaments') => new FakeQuery(db, table, userId),
  } as unknown as SupabaseClient;
}
