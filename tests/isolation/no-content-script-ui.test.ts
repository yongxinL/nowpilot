// tests/isolation/no-content-script-ui.test.ts
// Source: §24 (line 3594) + Appendix G rule (line 5455) + RESEARCH Pitfall 4.
// §24-named thin vitest wrapper over tests/isolation/check-content-bundle.mjs (I4) —
// keeps both the spec-named test file AND the node script present.
// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { it, expect } from 'vitest';

it('content-script bundle contains no UI/antd/React (Appendix G isolation rule)', () => {
  // The isolation grep is a build-time gate: verify:phase-1 runs `wxt build`
  // before this test. If .output is absent the script exits 0 (nothing to check).
  expect(() =>
    execFileSync('node', ['tests/isolation/check-content-bundle.mjs'], { stdio: 'pipe' }),
  ).not.toThrow();
});
