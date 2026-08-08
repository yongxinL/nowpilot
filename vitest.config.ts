// vitest.config.ts — Source: RESEARCH Pattern 4 (lines 319-333) / wxt.dev unit-testing guide
// NOTE: wxt 0.19.29 exports WxtVitest + fakeBrowser from 'wxt/testing' — the
// 'wxt/testing/vitest-plugin' and 'wxt/testing/fake-browser' subpaths do not exist
// in this version's package.json exports map (Rule 3 deviation from the plan's import paths).
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';
export default defineConfig({
  plugins: [WxtVitest()],
  // environment: jsdom-align (custom wrapper over the builtin jsdom env) —
  // 01-04 Rule 3: vitest's jsdom setup leaves globalThis.TextEncoder in Node's
  // realm while globalThis.Uint8Array is overridden to the jsdom realm, which
  // breaks esbuild 0.25's load-time invariant and made the DEFAULT jsdom env
  // unloadable for any component test. The wrapper re-aligns the codecs after
  // setup. node-env tests keep their @vitest-environment node override.
  // pool: threads — the forks pool fails to load the custom environment module
  // in the worker ("Unknown system error -122, write" at loadEnvironment);
  // threads loads it correctly (01-04 Rule 3).
  test: {
    pool: 'threads',
    environment: './tests/environments/jsdom-align.ts',
    setupFiles: ['./tests/setup.ts'],
  },
});
