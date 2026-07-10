export default [
  {
    ignores: ['dist/', 'node_modules/', 'pnpm-lock.yaml'],
  },
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/addons/*'],
              message: 'ADDON-10: src/core/ must not import from addons/',
            },
          ],
        },
      ],
    },
  },
];
