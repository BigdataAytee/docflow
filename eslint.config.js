import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import docflow from './tools/eslint/no-hardcoded-type-name.js'

export default tseslint.config(
  // /legacy is read-only reference (CLAUDE.md). Never linted, never built.
  { ignores: ['dist', 'legacy', 'node_modules', 'coverage'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: { docflow },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Rule #3 — UI never imports a DB client (§C architecture rules).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/data/sqlite/*', '**/data/supabase/*', '@supabase/*', '@powersync/*'],
              message:
                'UI and domain code must go through src/data/repositories — never a DB client directly (v6 §C).',
            },
          ],
        },
      ],
    },
  },

  // Rule #5 — one word everywhere. Presentation code may not carry type names.
  {
    files: [
      'src/features/**/*.{ts,tsx}',
      'src/pdf/**/*.{ts,tsx}',
      'src/app/**/*.{ts,tsx}',
      'src/ui/**/*.{ts,tsx}',
    ],
    rules: { 'docflow/no-hardcoded-type-name': 'error' },
  },

  // The locale layer is where the words legitimately live. src/ui/tokens.ts
  // holds identifiers only — hex colours and Tabler icon names, one of which
  // is literally "receipt" — and by construction no user-visible text.
  {
    files: ['src/domain/locale/**/*.ts', 'src/ui/tokens.ts'],
    rules: { 'docflow/no-hardcoded-type-name': 'off' },
  },

  // The repository IMPLEMENTATIONS are the one place a DB client belongs —
  // that is what `src/data/repositories` exists to hide. Everything else,
  // including src/app, src/features, src/pdf and the whole domain layer, is
  // still forbidden from importing one.
  {
    files: ['src/data/supabase/**/*.ts', 'src/data/sqlite/**/*.ts', 'supabase/tests/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  {
    files: ['tools/**/*.js', '*.config.js', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
)
