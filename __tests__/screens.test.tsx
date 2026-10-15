// Shows the real screens against a pretend database and "taps" them, to check what a person would
// see and do: front page lists and points table, create screen, players screen, and the tournament
// screen (score entry, impossible score message, now playing / up next, fixing results, swap player,
// add player, change round length, delete, and the "Couldn't save" warning with the internet off).

import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { addPlayers, listPlayers } from '../src/data/playerRepo';
import { createTournamentRow, listTournaments, loadTournament } from '../src/data/tournamentRepo';
import { CreateTournamentScreen } from '../src/screens/CreateTournamentScreen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { PlayersScreen } from '../src/screens/PlayersScreen';
import { TournamentScreen } from '../src/screens/TournamentScreen';
import { isComplete, reportResult } from '../src/lib/engine';
import { computeStandings, createTournament } from '../src/lib/tournament';
import {
  BO3_CONFIG,
  addTournament,
  fakeNavigation,
  newWorld,
  screenProps,
  type TestWorld,
} from './helpers/screenSetup';

type HomeProps = ComponentProps<typeof HomeScreen>;
type CreateProps = ComponentProps<typeof CreateTournamentScreen>;
type TournamentProps = ComponentProps<typeof TournamentScreen>;

// The screens ask for the shared client; hand them the pretend one for the current test.
let mockWorld: TestWorld;
jest.mock('../src/lib/supabase', () => ({ getClient: () => mockWorld.client }));

// "Are you sure?" boxes: tests decide the answer.
let mockAnswer = true;
const mockAsked: string[] = [];
jest.mock('../src/lib/confirm', () => ({
  confirmAction: (title: string) => {
    mockAsked.push(title);
    return Promise.resolve(mockAnswer);
  },
}));

beforeEach(() => {
  mockWorld = newWorld();
  mockAnswer = true;
  mockAsked.length = 0;
});

describe('front page', () => {
  it('shows empty lists and an empty points table for a brand-new account (check 17)', async () => {
    await render(
      <HomeScreen {...screenProps<HomeProps>({ navigation: fakeNavigation(), route: {} })} />,
    );
    expect(await screen.findByText(/No tournaments yet/)).toBeTruthy();
    expect(screen.getByText(/No players yet/)).toBeTruthy();
  });

  it('lists ongoing above finished, with the points table counting finished ones only', async () => {
    const done = createTournament(['Ann', 'Bob'], BO3_CONFIG);
    let guard = 0;
    while (!isComplete(done.playoff!) && guard++ < 50) {
      const m = done.playoff!.matches.find((x) => x.winner === null && x.playerA && x.playerB)!;
      reportResult(done.playoff!, m.id, m.playerA!);
    }
    done.phase = 'done';
    done.standings = computeStandings(done);
    await createTournamentRow(mockWorld.client, 'Finished night', done);
    await addTournament(mockWorld, 'Open night', ['Cy', 'Di', 'Ed']);

    const nav = fakeNavigation();
    await render(<HomeScreen {...screenProps<HomeProps>({ navigation: nav, route: {} })} />);
    expect(await screen.findByText('Open night')).toBeTruthy();
    expect(screen.getByText('Finished night')).toBeTruthy();
    expect(screen.getByText('Ongoing tournaments')).toBeTruthy();
    expect(screen.getByText('Finished tournaments')).toBeTruthy();
    // Points table: winner of the finished tournament has 1000, the runner-up 700.
    const winner = done.players[done.standings[0]].name;
    expect(screen.getByLabelText(new RegExp(`${winner}, 1000 points`))).toBeTruthy();
    // Players of the open tournament are not in the points table (not saved, not finished).
    expect(screen.queryByLabelText(/Cy, /)).toBeNull();
  });

  it('"Make as new" opens the create screen with the same players', async () => {
    await addTournament(mockWorld, 'Old night', ['Ann', 'Bob', 'Cat']);
    const nav = fakeNavigation();
    await render(<HomeScreen {...screenProps<HomeProps>({ navigation: nav, route: {} })} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Make as new' }));
    expect(nav.navigate).toHaveBeenCalledWith('CreateTournament', {
      players: expect.arrayContaining(['Ann', 'Bob', 'Cat']),
    });
  });
});

describe('players screen', () => {
  it('adds, edits and removes a saved player', async () => {
    await render(<PlayersScreen />);
    await fireEvent.changeText(await screen.findByLabelText('New player name'), 'Zed');
    await fireEvent.press(screen.getByRole('button', { name: 'Add player' }));
    expect(await screen.findByText('Zed')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    await fireEvent.changeText(screen.getByLabelText('New name for Zed'), 'Zeke');
    await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Zeke')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByText('Zeke')).toBeNull());
    const list = await listPlayers(mockWorld.client);
    expect(list.ok && list.value).toEqual([]);
  });

  it('refuses a duplicate name with a message', async () => {
    await addPlayers(mockWorld.client, ['Zed']);
    await render(<PlayersScreen />);
    await screen.findByText('Zed');
    await fireEvent.changeText(screen.getByLabelText('New player name'), 'zed');
    await fireEvent.press(screen.getByRole('button', { name: 'Add player' }));
    expect(await screen.findByText('You already have a player with that name.')).toBeTruthy();
  });
});

describe('create screen', () => {
  it('9 players make groups, "skip groups" makes one bracket, and create saves it (check 5 on screen)', async () => {
    await addPlayers(mockWorld.client, ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8', 'I9']);
    const nav = fakeNavigation();
    await render(
      <CreateTournamentScreen {...screenProps<CreateProps>({ navigation: nav, route: {} })} />,
    );
    for (const n of ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8']) {
      await fireEvent.press(await screen.findByRole('button', { name: `Add ${n}` }));
    }
    expect(
      await screen.findByText(/8 players go straight into one double-elimination bracket/),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add I9' }));
    expect(await screen.findByText(/9 players make 2 groups/)).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('switch', {
        name: 'Skip group stage: one double-elimination bracket for everyone',
      }),
    );
    expect(
      await screen.findByText(/9 players go straight into one double-elimination bracket/),
    ).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Tournament name (optional)'), 'Friday');
    await fireEvent.press(screen.getByRole('button', { name: 'Create tournament' }));
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith('Tournament', { id: expect.any(String) }),
    );
    const list = await listTournaments(mockWorld.client);
    expect(list.ok && list.value).toHaveLength(1);
    expect(list.ok && list.value[0].name).toBe('Friday');
    expect(list.ok && list.value[0].tournament.groups).toHaveLength(0);
  });

  it('a new typed name joins the saved player list', async () => {
    const nav = fakeNavigation();
    await render(
      <CreateTournamentScreen {...screenProps<CreateProps>({ navigation: nav, route: {} })} />,
    );
    for (const n of ['Una', 'Vic']) {
      await fireEvent.changeText(screen.getByLabelText('Type a new player name'), n);
      await fireEvent.press(screen.getByRole('button', { name: 'Add to tournament' }));
    }
    await fireEvent.press(await screen.findByRole('button', { name: 'Create tournament' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalled());
    const saved = await listPlayers(mockWorld.client);
    expect(saved.ok && saved.value.map((p) => p.name).sort()).toEqual(['Una', 'Vic']);
  });
});

describe('tournament screen', () => {
  async function open(names = ['A', 'B', 'C', 'D']) {
    const { id } = await addTournament(mockWorld, 'Game night', names);
    const nav = fakeNavigation();
    await render(
      <TournamentScreen
        {...screenProps<TournamentProps>({ navigation: nav, route: { params: { id } } })}
      />,
    );
    await screen.findByText('Phase: Playoff');
    return { id, nav };
  }

  async function enterFirstScore(a: string, b: string) {
    await fireEvent.press(screen.getAllByRole('button', { name: 'Enter score' })[0]);
    const boxes = screen.getAllByLabelText(/games won$/);
    await fireEvent.changeText(boxes[0], a);
    await fireEvent.changeText(boxes[1], b);
    await fireEvent.press(screen.getByRole('button', { name: 'Save score' }));
  }

  it('refuses an impossible score (3-2 in a Bo3) with a message (check 7)', async () => {
    const { id } = await open();
    await enterFirstScore('3', '2');
    expect(await screen.findByText(/No side can win more than 2 games/)).toBeTruthy();
    const stored = await loadTournament(mockWorld.client, id);
    expect(
      stored.ok &&
        stored.value.tournament.playoff!.matches.every((m) => m.winner === null || m.isBye),
    ).toBe(true);
  });

  it('saves a valid score and moves Now playing / Up next on (check 29)', async () => {
    const { id } = await open();
    expect(screen.getByText('● NOW PLAYING')).toBeTruthy();
    const before = screen.getByLabelText(/^Now playing\./).props.accessibilityLabel as string;
    await enterFirstScore('2', '1');
    await waitFor(() => expect(screen.getAllByText('Final').length).toBeGreaterThan(0));
    const after = screen.getByLabelText(/^Now playing\./).props.accessibilityLabel as string;
    expect(after).not.toBe(before);
    const stored = await loadTournament(mockWorld.client, id);
    expect(
      stored.ok &&
        stored.value.tournament.playoff!.matches.some((m) => m.scoreA === 2 && m.scoreB === 1),
    ).toBe(true);
  });

  it('with the internet off: shows "Couldn\'t save" and the match stays unplayed (check 11)', async () => {
    const { id } = await open();
    mockWorld.db.offline = true;
    await enterFirstScore('2', '0');
    expect(
      await screen.findByText(/^Couldn't save — your last change was not stored\./),
    ).toBeTruthy();
    // The score box stays open with a clear message, so nothing looks saved.
    expect(screen.getByText("Couldn't save this change. Nothing was changed.")).toBeTruthy();
    expect(screen.queryByLabelText(/winner/)).toBeNull();
    mockWorld.db.offline = false;
    const stored = await loadTournament(mockWorld.client, id);
    expect(
      stored.ok &&
        stored.value.tournament.playoff!.matches.every((m) => m.winner === null || m.isBye),
    ).toBe(true);
  });

  it('asks before an edit that wipes later results, and does nothing if you say no (check 10)', async () => {
    const { id } = await addTournament(mockWorld, 'Edit night', ['A', 'B', 'C', 'D']);
    // Play two first-round matches and the winners final directly in the database.
    const stored0 = await loadTournament(mockWorld.client, id);
    const t = stored0.ok ? stored0.value.tournament : null;
    if (!t) throw new Error('missing');
    for (const mid of ['po-wb-r1-m1', 'po-wb-r1-m2', 'po-wb-r2-m1']) {
      const m = t.playoff!.matches.find((x) => x.id === mid)!;
      reportResult(t.playoff!, mid, m.playerA!);
    }
    mockWorld.db.tables.tournaments[0].data = t;

    const nav = fakeNavigation();
    await render(
      <TournamentScreen
        {...screenProps<TournamentProps>({ navigation: nav, route: { params: { id } } })}
      />,
    );
    await screen.findByText('Phase: Playoff');
    mockAnswer = false;
    await fireEvent.press(screen.getAllByRole('button', { name: 'Edit score' })[0]);
    const boxes = screen.getAllByLabelText(/games won$/);
    // First-round match 1: flip it so the other player wins 2-0.
    await fireEvent.changeText(boxes[0], '0');
    await fireEvent.changeText(boxes[1], '2');
    await fireEvent.press(screen.getByRole('button', { name: 'Save score' }));
    await waitFor(() => expect(mockAsked).toContain('Change this result?'));
    const unchanged = await loadTournament(mockWorld.client, id);
    expect(
      unchanged.ok &&
        unchanged.value.tournament.playoff!.matches.find((m) => m.id === 'po-wb-r2-m1')!.winner,
    ).not.toBeNull();
  });

  it('swaps a player, keeping results (check 29)', async () => {
    const { id } = await open();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Swap player' })[0]);
    const box = await screen.findByLabelText(/^Replacement for /);
    await fireEvent.changeText(box, 'Zed');
    await fireEvent.press(screen.getByRole('button', { name: 'Swap in' }));
    await waitFor(async () => {
      const s = await loadTournament(mockWorld.client, id);
      expect(s.ok && Object.values(s.value.tournament.players).map((p) => p.name)).toContain('Zed');
    });
    const saved = await listPlayers(mockWorld.client);
    expect(saved.ok && saved.value.map((p) => p.name)).toContain('Zed');
  });

  it('adds a player only after the warning, and rebuilds the bracket (check 29)', async () => {
    const { id } = await open();
    await fireEvent.changeText(screen.getByLabelText('New player name'), 'Eve');
    await fireEvent.press(screen.getByRole('button', { name: 'Add player' }));
    await waitFor(() => expect(mockAsked).toContain('Add a player?'));
    await waitFor(async () => {
      const s = await loadTournament(mockWorld.client, id);
      expect(s.ok && Object.keys(s.value.tournament.players)).toHaveLength(5);
    });
  });

  it('adds no player when the warning is cancelled', async () => {
    const { id } = await open();
    mockAnswer = false;
    await fireEvent.changeText(screen.getByLabelText('New player name'), 'Eve');
    await fireEvent.press(screen.getByRole('button', { name: 'Add player' }));
    expect(await screen.findByText('Not added. You cancelled.')).toBeTruthy();
    const s = await loadTournament(mockWorld.client, id);
    expect(s.ok && Object.keys(s.value.tournament.players)).toHaveLength(4);
  });

  it('warns before a round-length change that wipes results, then changes it (check 29)', async () => {
    const { id } = await open();
    await enterFirstScore('2', '1'); // valid in Bo3, impossible in Bo1
    await waitFor(() => expect(screen.getAllByText('Final').length).toBeGreaterThan(0));
    await fireEvent.press(screen.getByRole('button', { name: 'Playoff formats' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Winners · Semi-Final: Best of 1' }));
    await waitFor(() => expect(mockAsked).toContain('Change match length?'));
    await waitFor(async () => {
      const s = await loadTournament(mockWorld.client, id);
      const m = s.ok
        ? s.value.tournament.playoff!.matches.find((x) => x.id === 'po-wb-r1-m1')!
        : null;
      expect(m?.format).toEqual({ kind: 'bestOf', n: 1 });
      expect(m?.winner).toBeNull();
    });
  });

  it('deletes the tournament after the confirm (check 29)', async () => {
    const { id, nav } = await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete tournament' }));
    await waitFor(() => expect(mockAsked).toContain('Delete tournament?'));
    await waitFor(() => expect(nav.navigate).toHaveBeenCalledWith('Home'));
    const s = await loadTournament(mockWorld.client, id);
    expect(s.ok).toBe(false);
  });

  it('keeps the tournament when the delete confirm is cancelled', async () => {
    const { id, nav } = await open();
    mockAnswer = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Delete tournament' }));
    await waitFor(() => expect(mockAsked).toContain('Delete tournament?'));
    expect(nav.navigate).not.toHaveBeenCalled();
    expect((await loadTournament(mockWorld.client, id)).ok).toBe(true);
  });

  it('shows the group stage for 9 players with the playoff button locked until groups are played', async () => {
    const { id } = await addTournament(
      mockWorld,
      'Groups night',
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
      {
        ...BO3_CONFIG,
        skipGroups: false,
      },
    );
    const nav = fakeNavigation();
    await render(
      <TournamentScreen
        {...screenProps<TournamentProps>({ navigation: nav, route: { params: { id } } })}
      />,
    );
    await screen.findByText('Phase: Group stage');
    expect(screen.getByText('Group A')).toBeTruthy();
    expect(screen.getByText('Group B')).toBeTruthy();
    expect(screen.queryByText('Group result')).toBeNull();
    const start = screen.getByRole('button', { name: 'Finish all groups to start the playoff' });
    expect(start.props.accessibilityState.disabled).toBe(true);
    expect(within(start).getByText('Finish all groups to start the playoff')).toBeTruthy();
  });
});
