// One open tournament: Now playing / Up next, the group stage or the final bracket, scores,
// standings, players (swap or add) and the delete button. Every change is saved to Supabase first;
// if saving fails the screen stays on the saved data and a "Couldn't save" warning appears.

import { useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addPlayers, listPlayers } from '../data/playerRepo';
import { deleteTournament } from '../data/tournamentRepo';
import { useOpenTournament } from '../hooks/useOpenTournament';
import { AppButton } from '../components/AppButton';
import { BodyText } from '../components/BodyText';
import { BracketView } from '../components/BracketView';
import { ChampionBanner } from '../components/ChampionBanner';
import { GroupCard } from '../components/GroupCard';
import { Heading } from '../components/Heading';
import { LivePill } from '../components/LivePill';
import { PlayersPanel } from '../components/PlayersPanel';
import { RoundFormatSettings } from '../components/RoundFormatSettings';
import { SaveErrorBanner } from '../components/SaveErrorBanner';
import { Screen } from '../components/Screen';
import { SectionTitle } from '../components/SectionTitle';
import { SpotlightPanel } from '../components/SpotlightPanel';
import { StandingsList } from '../components/StandingsList';
import { StatusMessage } from '../components/StatusMessage';
import { champion } from '../lib/engine';
import { confirmAction } from '../lib/confirm';
import { matchesView } from '../lib/matchesView';
import { addPlayer, PlayerOpError, replacePlayerIdentity } from '../lib/players';
import { getClient } from '../lib/supabase';
import { advancersFromGroups } from '../lib/tournament';
import {
  changeRoundFormat,
  clearResult,
  correctScore,
  enterScore,
  groupsFinished,
  resultsLostByEdit,
  resultsLostByFormat,
  startPlayoff,
  type ActionResult,
  type BracketScope,
} from '../lib/tournamentActions';
import type { BracketSide, MatchFormat, PlayerId, Tournament } from '../lib/types';
import type { SignedInStackParams } from '../navigation/types';

const WAIT = 'Still saving the last change. Please try again in a moment.';
const NOT_SAVED = "Couldn't save this change. Nothing was changed.";

export function TournamentScreen({
  navigation,
  route,
}: NativeStackScreenProps<SignedInStackParams, 'Tournament'>) {
  const client = getClient();
  const { id } = route.params;
  const open = useOpenTournament(client, id);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const t: Tournament | null = open.stored?.tournament ?? null;
  const name = open.stored?.name ?? 'Tournament';

  useEffect(() => {
    navigation.setOptions({ title: name });
  }, [navigation, name]);

  const refreshSavedNames = () =>
    listPlayers(client).then((res) => {
      if (res.ok) setSavedNames(res.value.map((p) => p.name));
    });

  useEffect(() => {
    void refreshSavedNames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const matches = useMemo(() => (t ? matchesView(t) : null), [t]);

  if (open.loading && !t) {
    return (
      <Screen>
        <BodyText>Loading…</BodyText>
      </Screen>
    );
  }
  if (!t || !matches) {
    return (
      <Screen>
        <StatusMessage message={open.loadError ?? 'That tournament could not be found.'} />
        <AppButton label="Try again" variant="secondary" onPress={open.reload} />
      </Screen>
    );
  }

  // Saves the result of a change. Returns an error sentence for the match card, or null if stored.
  const commit = async (res: ActionResult): Promise<string | null> => {
    if (!res.ok) return res.reason;
    if (open.saving) return WAIT;
    return (await open.apply(res.tournament)) ? null : NOT_SAVED;
  };

  // Asks before wiping later results. Returns true if it is fine to go on.
  const confirmLoss = (count: number, clearing: boolean): Promise<boolean> =>
    count === 0
      ? Promise.resolve(true)
      : confirmAction(
          clearing ? 'Clear this result?' : 'Change this result?',
          `This will RESET ${count} later match${count === 1 ? '' : 'es'} that depended on it. ` +
            'Their results will be cleared and must be replayed.',
          'Continue',
        );

  const scoped = (scope: BracketScope) => ({
    onScore: (matchId: string, a: number, b: number) => commit(enterScore(t, scope, matchId, a, b)),
    onEditScore: async (matchId: string, a: number, b: number) => {
      if (!(await confirmLoss(resultsLostByEdit(t, scope, matchId), false))) return 'Cancelled.';
      return commit(correctScore(t, scope, matchId, a, b));
    },
    onClear: async (matchId: string) => {
      if (!(await confirmLoss(resultsLostByEdit(t, scope, matchId), true))) return;
      await commit(clearResult(t, scope, matchId));
    },
    onFormat: async (side: BracketSide, round: number, format: MatchFormat) => {
      const lost = resultsLostByFormat(t, scope, side, round, format);
      if (
        lost > 0 &&
        !(await confirmAction(
          'Change match length?',
          `This will clear ${lost} entered result${lost === 1 ? '' : 's'} that no longer fit. They must be entered again.`,
          'Continue',
        ))
      ) {
        return;
      }
      await commit(changeRoundFormat(t, scope, side, round, format));
    },
  });

  const replacePlayer = async (playerId: PlayerId, newName: string): Promise<string | null> => {
    let next: Tournament;
    try {
      next = replacePlayerIdentity(t, playerId, newName);
    } catch (e) {
      return e instanceof PlayerOpError ? e.message : 'Could not swap that player.';
    }
    const problem = await commit({ ok: true, tournament: next });
    if (!problem) void addPlayers(client, [newName]).then(refreshSavedNames);
    return problem;
  };

  const addNewPlayer = async (newName: string): Promise<string | null> => {
    const sure = await confirmAction(
      'Add a player?',
      `Adding "${newName.trim()}" rebuilds and re-seeds the bracket. All match results in this tournament will be lost.`,
      'Add player',
    );
    if (!sure) return 'Not added. You cancelled.';
    let next: Tournament;
    try {
      next = addPlayer(t, newName);
    } catch (e) {
      return e instanceof PlayerOpError ? e.message : 'Could not add that player.';
    }
    const problem = await commit({ ok: true, tournament: next });
    if (!problem) void addPlayers(client, [newName]).then(refreshSavedNames);
    return problem;
  };

  const removeTournament = async () => {
    const sure = await confirmAction(
      'Delete tournament?',
      `Delete "${name}"? This cannot be undone. Your saved players stay.`,
      'Delete forever',
    );
    if (!sure) return;
    const res = await deleteTournament(client, id);
    if (!res.ok) {
      setDeleteError(res.message);
      return;
    }
    navigation.navigate('Home');
  };

  const champ = t.phase === 'done' && t.playoff ? champion(t.playoff) : null;
  const playoff = scoped({ kind: 'playoff' });
  const phaseText =
    t.phase === 'groups' ? 'Group stage' : t.phase === 'playoff' ? 'Playoff' : 'Finished';

  return (
    <Screen>
      <Heading>{name}</Heading>
      {t.phase !== 'done' ? <LivePill /> : null}
      <BodyText>{`Phase: ${phaseText}${open.saving ? ' · Saving…' : ''}`}</BodyText>
      <SaveErrorBanner message={open.saveError} onDismiss={open.dismissSaveError} />
      {champ ? <ChampionBanner name={t.players[champ]?.name ?? '?'} /> : null}

      <SpotlightPanel view={matches} />

      {t.phase === 'groups' ? (
        <>
          {t.groups.map((g) => {
            const s = scoped({ kind: 'group', groupId: g.id });
            return (
              <GroupCard
                key={g.id}
                group={g}
                players={t.players}
                onScore={s.onScore}
                onEditScore={s.onEditScore}
                onClear={s.onClear}
                onFormat={s.onFormat}
              />
            );
          })}
          <AppButton
            label={
              groupsFinished(t)
                ? `Start playoff (${advancersFromGroups(t).length} qualified)`
                : 'Finish all groups to start the playoff'
            }
            disabled={!groupsFinished(t)}
            onPress={() => void commit(startPlayoff(t))}
          />
        </>
      ) : null}

      {(t.phase === 'playoff' || t.phase === 'done') && t.playoff ? (
        <>
          <BracketView
            bracket={t.playoff}
            players={t.players}
            onScore={playoff.onScore}
            onEditScore={playoff.onEditScore}
            onClear={playoff.onClear}
          />
          <RoundFormatSettings
            bracket={t.playoff}
            title="Playoff formats"
            onChange={playoff.onFormat}
          />
        </>
      ) : null}

      {t.phase === 'done' ? (
        <>
          <SectionTitle>Final standings</SectionTitle>
          <StandingsList order={t.standings} players={t.players} />
        </>
      ) : null}

      <PlayersPanel
        players={t.players}
        savedNames={savedNames}
        onReplace={replacePlayer}
        onAdd={addNewPlayer}
      />

      <SectionTitle>Settings</SectionTitle>
      <BodyText>Deleting removes this tournament for good. Your saved players stay.</BodyText>
      <StatusMessage message={deleteError} />
      <AppButton
        label="Delete tournament"
        variant="danger"
        hint="Permanently deletes this tournament after you confirm"
        onPress={removeTournament}
      />
    </Screen>
  );
}
