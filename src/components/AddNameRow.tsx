// A name box with an "Add" style button next to it. The parent decides what happens with the name:
// it returns an error sentence to show, or null when it worked (then the box is cleared).

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton } from './AppButton';
import { StatusMessage } from './StatusMessage';
import { TextField } from './TextField';
import { spacing } from '../theme';

interface Props {
  label: string;
  buttonLabel: string;
  onSubmit: (name: string) => Promise<string | null> | string | null;
}

export function AddNameRow({ label, buttonLabel, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const problem = await onSubmit(text);
    setBusy(false);
    setError(problem);
    if (!problem) setText('');
  };

  return (
    <View style={styles.wrapper}>
      <TextField
        label={label}
        value={text}
        onChangeText={setText}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <StatusMessage message={error} />
      <AppButton label={buttonLabel} variant="secondary" onPress={submit} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({ wrapper: { gap: spacing.sm } });
