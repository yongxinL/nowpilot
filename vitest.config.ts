import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      // D-02: `@` resolves to `src/` in all three resolvers — WXT's generated
      // alias, tsconfig `paths` and this alias.
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
