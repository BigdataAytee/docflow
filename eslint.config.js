import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import docflow from './tools/eslint/no-hardcoded-type-name.js'

export default tseslint.config(
  // /legacy is read-only reference (CLAUDE.md). Never linted, never built.
  // `android` is Capacitor's generated native project — a copy of the built
  // bundle plus Java the plugins own. Linting it reports thousands of problems
  // in code nobody here writes, which is the fastest way to make a lint run
  // something people stop reading.
  {
    ignores: [
      'dist',
      'dist-site',
      'dist-shots',
      'dist-shots-png',
      'legacy',
      'node_modules',
      'coverage',
      'android',
      'ios',
    ],
  },

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
              // Both spellings. `**/data/supabase/*` catches the way UI code
              // reaches for it (`../data/supabase/client`), and `./supabase/*`
              // catches the way a file already INSIDE src/data would — which
              // the first pattern does not match at all, and which is exactly
              // where a client leak is easiest to introduce by accident.
              group: [
                '**/data/sqlite/*',
                '**/data/supabase/*',
                './sqlite/*',
                './supabase/*',
                '@supabase/*',
                '@powersync/*',
              ],
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

  // Three exemptions, each because the file holds no user-visible text:
  //  · the locale layer, which is where the words legitimately live;
  //  · src/ui/tokens.ts — hex colours and Tabler icon names, one of which is
  //    literally "receipt";
  //  · test files, whose strings are test names, not shipped labels. The
  //    rule's own coverage test in src/domain/locale/resolve.test.ts lints
  //    fixtures through the ESLint API, so this does not weaken it.
  {
    files: [
      'src/domain/locale/**/*.ts',
      'src/ui/tokens.ts',
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
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

  // The backend factory is the one other place, and for the one other reason:
  // choosing between implementations means naming them. It hands back a
  // `Repositories` and a `SessionService` — two ports, no client — so nothing
  // downstream inherits the exemption. Listed as a single FILE, not a
  // directory, so a second file cannot quietly join it.
  {
    files: ['src/data/backend.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // The native shell, for the same reason and under the same restraint.
  // Somebody has to open the encrypted database, hand its key to SQLCipher and
  // run the on-device gate against the driver — and that somebody cannot go
  // through `src/data/repositories`, because repositories are what it BUILDS.
  //
  // Listed as three files rather than `src/native/**`, so a screen dropped into
  // this directory does not quietly inherit the exemption. What leaves these
  // files is a `Repositories` — no driver, no passphrase.
  {
    files: ['src/native/boot.ts', 'src/native/gate.ts', 'src/native/secure-storage.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // The penetration checks are the attacker. They hold a raw client on
  // purpose: the whole point is to hit the API with a real token and no
  // repository in the way, because a check routed through the repositories
  // would only prove that the repositories behave — which is not the question
  // §P asks. Two files by name, so the exemption cannot spread.
  {
    files: ['tools/pentest/checks.ts', 'tools/pentest/run.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  {
    files: ['tools/**/*.js', '*.config.js', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
)
