// Tests the Expo settings: iPhone only, no secret keys in the config file.
import { readFileSync } from 'fs';
import { join } from 'path';
import config from '../app.config';

describe('app.config', () => {
  it('is iPhone only (iPad support off)', () => expect(config.ios?.supportsTablet).toBe(false));
  it('is named Bracket Brawl', () => expect(config.name).toBe('Bracket Brawl'));
  it('mentions no secret key', () => {
    const source = readFileSync(join(__dirname, '..', 'app.config.ts'), 'utf8');
    expect(source).not.toMatch(/service_role|SERVICE_ROLE|sb_secret/);
  });
});
