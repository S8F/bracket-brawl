// Lint rules: Expo's default set, with Prettier owning formatting.
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier/flat');

module.exports = [
  ...expoConfig,
  prettier,
  { ignores: ['dist/*', '.expo/*'] },
  {
    // The bracket maths is copied unchanged from the web app (see .prettierignore), so one harmless
    // unused variable in engine.ts is tolerated rather than editing the copied file.
    files: ['src/lib/engine.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
];
