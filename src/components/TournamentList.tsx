// The two lists on the front page: ongoing tournaments on top, finished ones below.

import { StyleSheet, View } from 'react-native';
import type { TournamentSummary } from '../lib/tournamentSummary';
import { spacing } from '../theme';
import { BodyText } from './BodyText';
import { SectionTitle } from './SectionTitle';
import { TournamentListItem } from './TournamentListItem';

interface Props {
  summaries: TournamentSummary[];
  onOpen: (id: string) => void;
  onMakeAsNew: (playerNames: string[]) => void;
}

export function TournamentList({ summaries, onOpen, onMakeAsNew }: Props) {
  const ongoing = summaries.filter((s) => s.status === 'open');
  const finished = summaries.filter((s) => s.status === 'closed');
  const item = (s: TournamentSummary) => (
    <TournamentListItem
      key={s.id}
      summary={s}
      onOpen={() => onOpen(s.id)}
      onMakeAsNew={() => onMakeAsNew(s.playerNames)}
    />
  );
  return (
    <View style={styles.wrapper}>
      <SectionTitle>Ongoing tournaments</SectionTitle>
      {summaries.length === 0 ? (
        <BodyText>No tournaments yet. Create your first one to get started.</BodyText>
      ) : ongoing.length === 0 ? (
        <BodyText>No ongoing tournaments. Start a new one.</BodyText>
      ) : (
        ongoing.map(item)
      )}
      {finished.length > 0 ? (
        <>
          <SectionTitle>Finished tournaments</SectionTitle>
          {finished.map(item)}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrapper: { gap: spacing.md } });
