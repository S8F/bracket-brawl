// Tests the "TEST" label rule (AC39): shown on the test database only, never on the real one.
import { render } from '@testing-library/react-native';
import { TestLabel } from '../src/components/TestLabel';
import { REAL_PROJECT_ID, isTestDatabase } from '../src/testLabel';

describe('isTestDatabase', () => {
  it('is false for the real project', () =>
    expect(isTestDatabase(`https://${REAL_PROJECT_ID}.supabase.co`)).toBe(false));
  it('is true for any other project', () =>
    expect(isTestDatabase('https://licovsxmzhedpbxumote.supabase.co')).toBe(true));
  it('is false when no address is set', () => {
    expect(isTestDatabase('')).toBe(false);
    expect(isTestDatabase(undefined)).toBe(false);
  });
});

describe('TestLabel', () => {
  it('shows TEST on the test database', async () => {
    const { queryByText } = await render(
      <TestLabel url="https://licovsxmzhedpbxumote.supabase.co" />,
    );
    expect(queryByText('TEST')).not.toBeNull();
  });
  it('shows nothing on the real database', async () => {
    const { queryByText } = await render(
      <TestLabel url={`https://${REAL_PROJECT_ID}.supabase.co`} />,
    );
    expect(queryByText('TEST')).toBeNull();
  });
});
