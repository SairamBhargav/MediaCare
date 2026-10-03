// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  // Formatting is Prettier's job; turn off stylistic lint rules that conflict.
  prettierConfig,
  {
    ignores: ['dist/*', 'dist-check/*', '.expo/*'],
  },
  {
    files: ['jest.setup.ts', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: { globals: { jest: 'readonly', expect: 'readonly', test: 'readonly' } },
  },
]);
