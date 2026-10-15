// "Group stage: Bo3 / Bo5 / ..." — a label and a row of chips, one per match length.

import { StyleSheet, Text, View } from 'react-native';
import { formatShort, formatSpoken, sameFormat } from '../lib/formats';
import type { MatchFormat } from '../lib/types';
import { colors } from '../theme';
import { Chip } from './Chip';
import { ChipRow } from './ChipRow';

interface Props {
  label: string;
  options: MatchFormat[];
  value: MatchFormat;
  onChange: (format: MatchFormat) => void;
}

export function FormatPicker({ label, options, value, onChange }: Props) {
  // Make sure the current value can always be seen as selected, even if it is not in the list.
  const shown = options.some((o) => sameFormat(o, value)) ? options : [value, ...options];
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <ChipRow>
        {shown.map((f) => (
          <Chip
            key={`${f.kind}:${f.n}`}
            label={formatShort(f)}
            spokenLabel={`${label}: ${formatSpoken(f)}`}
            selected={sameFormat(f, value)}
            onPress={() => onChange(f)}
          />
        ))}
      </ChipRow>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
