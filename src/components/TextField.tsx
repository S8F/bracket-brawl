// A labelled text box with an optional error line. The label is read aloud by VoiceOver.

import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, MIN_TAP_TARGET } from '../theme';

interface Props extends Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'secureTextEntry'
  | 'keyboardType'
  | 'autoComplete'
  | 'textContentType'
  | 'returnKeyType'
  | 'onSubmitEditing'
  | 'autoCapitalize'
> {
  label: string;
  error?: string | null;
}

export function TextField({ label, error, ...inputProps }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        accessibilityHint={error ?? undefined}
        autoCorrect={false}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  input: {
    minHeight: MIN_TAP_TARGET + 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: 14,
  },
  inputError: { borderColor: colors.red },
  error: { color: colors.red, fontSize: 14 },
});
