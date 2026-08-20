// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      'no-console': 'warn',
      // The Node entries read the Buffer global at module scope, which crashes
      // the client bundle on import. The browser builds ship their own.
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'csv-parse/sync', message: 'Use \'csv-parse/browser/esm/sync\' instead.' },
          { name: 'csv-stringify/sync', message: 'Use \'csv-stringify/browser/esm/sync\' instead.' },
        ],
      }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@stylistic/max-statements-per-line': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {
        args: 'after-used',
        argsIgnorePattern: '^_',
        vars: 'all',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
        caughtErrors: 'none',
      }],
    },
  },
)
