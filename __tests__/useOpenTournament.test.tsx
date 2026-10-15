// Tests the "open tournament" saving hook: a good save updates the screen data; a failed save (no
// internet) leaves the screen on the saved data and shows the "Couldn't save" warning (check 11).

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createTournamentRow } from '../src/data/tournamentRepo';
import { useOpenTournament } from '../src/hooks/useOpenTournament';
import { enterScore } from '../src/lib/tournamentActions';
import { createTournament } from '../src/lib/tournament';
import { createFakeDb, fakeClientFor } from './helpers/fakeSupabase';

const config = {
  groupFormat: { kind: 'bestOf', n: 3 },
  playoffFormat: { kind: 'bestOf', n: 3 },
  grandFinalFormat: { kind: 'bestOf', n: 5 },
  skipGroups: true,
} as const;

async function setup() {
  const db = createFakeDb();
  const client = fakeClientFor(db, 'a');
  const t = createTournament(['A', 'B', 'C', 'D'], config);
  const created = await createTournamentRow(client, 'Night', t);
  const id = created.ok ? created.value : '';
  const hook = await renderHook(() => useOpenTournament(client, id));
  await waitFor(() => expect(hook.result.current.stored).not.toBeNull());
  return { db, hook };
}

function nextTournament(t: ReturnType<typeof createTournament>) {
  const res = enterScore(t, { kind: 'playoff' }, 'po-wb-r1-m1', 2, 0);
  if (!res.ok) throw new Error(res.reason);
  return res.tournament;
}

describe('useOpenTournament', () => {
  it('loads the tournament and shows a saved change', async () => {
    const { hook } = await setup();
    const before = hook.result.current.stored!.tournament;
    let ok = false;
    await act(async () => {
      ok = await hook.result.current.apply(nextTournament(before));
    });
    expect(ok).toBe(true);
    expect(hook.result.current.saveError).toBeNull();
    const m = hook.result.current.stored!.tournament.playoff!.matches.find(
      (x) => x.id === 'po-wb-r1-m1',
    )!;
    expect(m.winner).not.toBeNull();
  });

  it('with the internet off: warns "Couldn\'t save" and the screen stays on the saved data', async () => {
    const { db, hook } = await setup();
    const before = hook.result.current.stored!.tournament;
    db.offline = true;
    let ok = true;
    await act(async () => {
      ok = await hook.result.current.apply(nextTournament(before));
    });
    expect(ok).toBe(false);
    expect(hook.result.current.saveError).toMatch(/^Couldn't save/);
    expect(hook.result.current.saveError).toMatch(/internet/);
    // The screen data is exactly what was saved before.
    expect(hook.result.current.stored!.tournament).toBe(before);
    const m = hook.result.current.stored!.tournament.playoff!.matches.find(
      (x) => x.id === 'po-wb-r1-m1',
    )!;
    expect(m.winner).toBeNull();

    // Back online: dismiss the warning and save again.
    db.offline = false;
    await act(async () => hook.result.current.dismissSaveError());
    expect(hook.result.current.saveError).toBeNull();
    await act(async () => {
      ok = await hook.result.current.apply(nextTournament(before));
    });
    expect(ok).toBe(true);
  });
});
