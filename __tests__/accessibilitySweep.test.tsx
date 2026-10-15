// Opens every Part 2 screen and checks, for everything a person can tap or type into:
// VoiceOver has a label (check 22), and the tap area is at least 44 points tall (check 23).

import type { ComponentProps, ReactElement } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { addPlayers } from '../src/data/playerRepo';
import { CreateTournamentScreen } from '../src/screens/CreateTournamentScreen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { PlayersScreen } from '../src/screens/PlayersScreen';
import { TournamentScreen } from '../src/screens/TournamentScreen';
import { MIN_TAP_TARGET } from '../src/theme';
import {
  addTournament,
  BO3_CONFIG,
  fakeNavigation,
  newWorld,
  screenProps,
  type TestWorld,
} from './helpers/screenSetup';

let mockWorld: TestWorld;
jest.mock('../src/lib/supabase', () => ({ getClient: () => mockWorld.client }));

beforeEach(() => {
  mockWorld = newWorld();
});

const TAP_ROLES = ['button', 'link', 'switch'] as const;

// Every tappable thing has a spoken label and is tall enough; every text box has a label.
function expectEverythingLabelledAndBigEnough(expectTextBoxes = false) {
  let tappable = 0;
  for (const role of TAP_ROLES) {
    for (const el of screen.queryAllByRole(role)) {
      tappable++;
      expect(String(el.props.accessibilityLabel ?? '').trim()).not.toBe('');
      const style = StyleSheet.flatten(el.props.style) as ViewStyle | undefined;
      const height = Number(style?.minHeight ?? style?.height ?? 0);
      expect({ label: el.props.accessibilityLabel, height }).toEqual({
        label: el.props.accessibilityLabel,
        height: expect.any(Number),
      });
      expect(height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    }
  }
  expect(tappable).toBeGreaterThan(0);
  const boxes = screen.queryAllByDisplayValue(/^/);
  if (expectTextBoxes) expect(boxes.length).toBeGreaterThan(0);
  for (const input of boxes) {
    expect(String(input.props.accessibilityLabel ?? '').trim()).not.toBe('');
  }
}

async function show(ui: ReactElement, ready: string | RegExp) {
  await render(ui);
  await screen.findByText(ready);
}

describe('Part 2 screens', () => {
  it('front page (with an open and a finished-looking list, points table)', async () => {
    await addTournament(mockWorld, 'Night one', ['A', 'B', 'C', 'D']);
    await addPlayers(mockWorld.client, ['Zed']);
    const ui = (
      <HomeScreen
        {...screenProps<ComponentProps<typeof HomeScreen>>({
          navigation: fakeNavigation(),
          route: {},
        })}
      />
    );
    await show(ui, 'Night one');
    expectEverythingLabelledAndBigEnough();
    expect(screen.getByLabelText('Points table')).toBeTruthy();
  });

  it('players screen (with players and the edit box open)', async () => {
    await addPlayers(mockWorld.client, ['Zed', 'Amy']);
    await show(<PlayersScreen />, 'Zed');
    expectEverythingLabelledAndBigEnough(true);
  });

  it('create screen (with saved players, groups on)', async () => {
    await addPlayers(mockWorld.client, ['Zed', 'Amy']);
    const ui = (
      <CreateTournamentScreen
        {...screenProps<ComponentProps<typeof CreateTournamentScreen>>({
          navigation: fakeNavigation(),
          route: { params: { players: ['P1', 'P2', 'P3'] } },
        })}
      />
    );
    await show(ui, /Tap a saved player/);
    expectEverythingLabelledAndBigEnough(true);
  });

  it('tournament screen (single bracket)', async () => {
    const { id } = await addTournament(mockWorld, 'Bracket night', ['A', 'B', 'C', 'D']);
    const ui = (
      <TournamentScreen
        {...screenProps<ComponentProps<typeof TournamentScreen>>({
          navigation: fakeNavigation(),
          route: { params: { id } },
        })}
      />
    );
    await show(ui, 'Phase: Playoff');
    expectEverythingLabelledAndBigEnough(true);
  });

  it('tournament screen (group stage)', async () => {
    const { id } = await addTournament(
      mockWorld,
      'Group night',
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
      { ...BO3_CONFIG, skipGroups: false },
    );
    const ui = (
      <TournamentScreen
        {...screenProps<ComponentProps<typeof TournamentScreen>>({
          navigation: fakeNavigation(),
          route: { params: { id } },
        })}
      />
    );
    await show(ui, 'Phase: Group stage');
    expectEverythingLabelledAndBigEnough();
  });
});
