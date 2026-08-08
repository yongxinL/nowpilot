// eslint.config.mjs — flat config for eslint 10 (D-04 quality gate)
// Minimal TypeScript config for the WXT/React codebase. The scaffold did not ship
// an eslint config, so one is required for `eslint .` in verify:phase-1 (Rule 3).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.output/**',
      '.wxt/**',
      '.cache/**',
      'node_modules/**',
      'dist/**',
      'assets/**',
      'public/**',
      'references/**',
      '.planning/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow explicit any where the spec's canonical envelope types require it
      '@typescript-eslint/no-explicit-any': 'off',
      // WXT auto-imports (defineBackground etc.) are not module-scope issues
      'no-undef': 'off',
      // Underscore-prefixed args are intentionally-unused (mock implementations)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
