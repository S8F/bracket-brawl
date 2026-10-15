// The red "Couldn't save" box on the tournament screen, with a way to dismiss it.

import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import { AppButton } from './AppButton';
import { StatusMessage } from './StatusMessage';

interface Props {
  message: string | null;
  onDismiss: () => void;
}

export function SaveErrorBanner({ message, onDismiss }: Props) {
  if (!message) return null;
  return (
    <View style={styles.box}>
      <StatusMessage message={message} />
      <AppButton label="Dismiss" variant="secondary" onPress={onDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
