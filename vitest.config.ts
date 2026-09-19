import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcAlias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
};

const sharedExclude = ['node_modules/**', 'dist/**', '.output/**', '.wxt/**'];

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: srcAlias },
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
          exclude: [
            ...sharedExclude,
            'tests/build/manifest.test.ts',
            'tests/build/isolation.test.ts',
          ],
        },
      },
      {
        test: {
          name: 'manifest',
          environment: 'node',
          include: ['tests/build/manifest.test.ts'],
          exclude: sharedExclude,
        },
      },
      {
        test: {
          name: 'isolation',
          environment: 'node',
          include: ['tests/build/isolation.test.ts'],
          exclude: sharedExclude,
        },
      },
    ],
  },
});
