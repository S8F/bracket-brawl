// Renders the shared buttons / fields and checks screen-reader labels and the 44pt tap-size rule.
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { AppButton } from '../src/components/AppButton';
import { TextField } from '../src/components/TextField';
import { TextLink } from '../src/components/TextLink';
import { MIN_TAP_TARGET } from '../src/theme';

const minHeightOf = (style: StyleProp<ViewStyle>): number =>
  ((StyleSheet.flatten(style) as ViewStyle | undefined)?.minHeight as number) ?? 0;

describe('accessibility basics', () => {
  it('AppButton has a label, role, and is at least 44pt tall', async () => {
    await render(<AppButton label="Log in" onPress={() => {}} />);
    const button = screen.getByRole('button', { name: 'Log in' });
    expect(minHeightOf(button.props.style)).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
  });

  it('TextLink has a label and is at least 44pt tall', async () => {
    await render(<TextLink label="Forgot password?" onPress={() => {}} />);
    const link = screen.getByRole('link', { name: 'Forgot password?' });
    expect(minHeightOf(link.props.style)).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
  });

  it('TextField has an accessibility label and is at least 44pt tall', async () => {
    await render(<TextField label="Email" value="" onChangeText={() => {}} />);
    const input = screen.getByLabelText('Email');
    expect(minHeightOf(input.props.style)).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
  });
});
