import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['coverage/**'],
  },
  js.configs.recommended,
  {
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.mocha },
    },
    rules: {
      // Convention for exporting functions solely for unit tests.
      'no-underscore-dangle': 'off',
      'no-unused-vars': ['error', { args: 'after-used', caughtErrors: 'none' }],
    },
  },
];
