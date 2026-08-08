// vitest.config.ts — Source: RESEARCH Pattern 4 (lines 319-333) / wxt.dev unit-testing guide
// NOTE: wxt 0.19.29 exports WxtVitest + fakeBrowser from 'wxt/testing' — the
// 'wxt/testing/vitest-plugin' and 'wxt/testing/fake-browser' subpaths do not exist
// in this version's package.json exports map (Rule 3 deviation from the plan's import paths).
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';
export default defineConfig({
  plugins: [WxtVitest()],
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'] },
});
