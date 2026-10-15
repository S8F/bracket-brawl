// One saved player on the Players screen: the name, with Edit and Remove buttons.
// Tapping Edit turns the name into a box with Save and Cancel.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { AppButton } from './AppButton';
import { StatusMessage } from './StatusMessage';
import { TextField } from './TextField';

interface Props {
  name: string;
  // Both return an error sentence to show, or null when it worked.
  onRename: (newName: string) => Promise<string | null>;
  onRemove: () => Promise<string | null>;
}

export function PlayerRow({ name, onRename, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const problem = await onRename(text);
    setBusy(false);
    setError(problem);
    if (!problem) setEditing(false);
  };

  const remove = async () => {
    setBusy(true);
    const problem = await onRemove();
    setBusy(false);
    setError(problem);
  };

  if (editing) {
    return (
      <View style={styles.row}>
        <TextField
          label={`New name for ${name}`}
          value={text}
          onChangeText={setText}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <StatusMessage message={error} />
        <AppButton label="Save name" onPress={save} busy={busy} />
        <AppButton
          label="Cancel"
          variant="secondary"
          onPress={() => {
            setEditing(false);
            setText(name);
            setError(null);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.name}>{name}</Text>
      <StatusMessage message={error} />
      <View style={styles.buttons}>
        <View style={styles.flex}>
          <AppButton
            label="Edit"
            variant="secondary"
            hint={`Change the name ${name}`}
            onPress={() => {
              setText(name);
              setEditing(true);
            }}
          />
        </View>
        <View style={styles.flex}>
          <AppButton
            label="Remove"
            variant="danger"
            hint={`Remove ${name} from your player list`}
            onPress={remove}
            busy={busy}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
