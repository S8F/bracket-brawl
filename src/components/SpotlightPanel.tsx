// "Now playing / Up next": exactly the current match and the single match after it.
// It is rebuilt from the bracket on every change, so it updates the moment a score is saved.

import { StyleSheet, View } from 'react-native';
import type { MatchesView } from '../lib/matchesView';
import { spacing } from '../theme';
import { BodyText } from './BodyText';
import { NowPlayingCard } from './NowPlayingCard';
import { SectionTitle } from './SectionTitle';
import { UpNextCard } from './UpNextCard';

export function SpotlightPanel({ view }: { view: MatchesView }) {
  if (view.complete) {
    return (
      <View style={styles.wrapper}>
        <SectionTitle>Spotlight</SectionTitle>
        <BodyText>Tournament complete. No matches left to play.</BodyText>
      </View>
    );
  }
  // Current = the first match ready now. Next = another ready match, or else the nearest waiting one.
  const current = view.playable[0] ?? null;
  const next = view.playable[1] ?? view.upcoming[0] ?? null;
  return (
    <View style={styles.wrapper}>
      <SectionTitle>Spotlight</SectionTitle>
      {current ? (
        <NowPlayingCard view={current} />
      ) : (
        <BodyText>
          No match is ready to play right now. Waiting on other results, or start the next phase.
        </BodyText>
      )}
      {next ? <UpNextCard view={next} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrapper: { gap: spacing.sm } });
