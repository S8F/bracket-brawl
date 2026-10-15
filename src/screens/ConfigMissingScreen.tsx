// Shown when the Supabase address or key in ".env" is still empty or a placeholder.

import { BodyText } from '../components/BodyText';
import { Heading } from '../components/Heading';
import { Screen } from '../components/Screen';

export function ConfigMissingScreen() {
  return (
    <Screen>
      <Heading>Setup needed</Heading>
      <BodyText>
        The app does not know your Supabase project yet. Copy .env.example to .env, paste your
        project address and publishable key, then restart the app.
      </BodyText>
    </Screen>
  );
}
