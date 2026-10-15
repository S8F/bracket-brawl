// Shows a native "are you sure?" box and gives back true (confirmed) or false (cancelled).

import { Alert } from 'react-native';

export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  destructive = true,
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
