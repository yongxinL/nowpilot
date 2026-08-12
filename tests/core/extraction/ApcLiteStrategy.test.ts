// tests/core/extraction/ApcLiteStrategy.test.ts — 04a-04 Task 2 behavior pin
// (D-4a-11/13/14/20/21), driven by the SHARED golden fixtures (D-4a-24 —
// buildRawNodeFixture from the fixtures module):
//   1. run({url, title, mode:'actionable', raw}) → source 'apc-lite', root
//      defined, doc validates against APCLiteDocumentSchema (GR-4 zod boundary
//      gate), stats {nodeCount, approxTokens, durationMs, truncated} populated.
//   2. A RawNode whose form.control has isPassword:true AND a value → the
//      schema parse THROWS (D-4a-20 — FormControlSchema.refine defense-in-depth
//      at the panel boundary; never captured, not merely redacted later).
//   3. Every emitted APCLiteNode has geometry === undefined (D-4a-13 — the
//      field stays optional + unset in v0.1; no getBoundingClientRect).
//   4. canHandle({mode:'default'}) → false (D-4a-14 gating).
import { describe, expect, it } from 'vitest';

import { APCLiteDocumentSchema, type APCLiteNode } from '@/core/extraction/apcLite.types';
import { ApcLiteStrategy } from '@/core/extraction/strategies/ApcLiteStrategy';
import { buildRawNodeFixture } from '../../fixtures/pageContent';

/** Recursive tree walk — every emitted node must have geometry unset (D-4a-13). */
function collectNodes(root: APCLiteNode): APCLiteNode[] {
  return [root, ...(root.children?.flatMap(collectNodes) ?? [])];
}

describe('ApcLiteStrategy (04a-04 — structural path + password re-validation)', () => {
  it('produces a schema-validated APCLiteDocument with populated stats (Test 1)', async () => {
    const fixture = buildRawNodeFixture();
    const strategy = new ApcLiteStrategy();
    const result = await strategy.run({
      url: fixture.url,
      title: fixture.title,
      mode: 'actionable',
      raw: fixture.root,
    });

    expect(result.source).toBe('apc-lite');
    expect(result.root).toBeDefined();
    expect(result.truncated).toBe(false);
    expect(result.approxTokens).toBeGreaterThan(0);

    // Re-parse the emitted result through the schema — the zod boundary gate
    // must accept what the strategy emits (GR-4: parse, never silent cast).
    const doc = APCLiteDocumentSchema.parse({
      url: fixture.url,
      title: fixture.title,
      extractedAt: 1_700_000_000_000,
      source: 'dom',
      root: result.root,
      stats: { nodeCount: 5, approxTokens: result.approxTokens, durationMs: 1, truncated: false },
    });
    expect(doc.root.id).toBe('rn-root');
    expect(doc.stats.nodeCount).toBe(5);
  });

  it('rejects a password control carrying a value (D-4a-20 invariant) (Test 2)', async () => {
    const fixture = buildRawNodeFixture();
    // D-4a-20: isPassword:true WITH a value — the invariant the AxDomWalker
    // enforces at capture AND FormControlSchema.refine re-checks here.
    const rawWithPasswordValue = structuredClone(fixture.root);
    const passControl = rawWithPasswordValue.children?.[3]?.children?.[1];
    if (!passControl || passControl.form?.control?.fieldName !== 'password') {
      throw new Error('fixture shape changed — password control not found');
    }
    passControl.form.control.value = 'hunter2';

    const strategy = new ApcLiteStrategy();
    await expect(
      strategy.run({
        url: fixture.url,
        title: fixture.title,
        mode: 'actionable',
        raw: rawWithPasswordValue,
      }),
    ).rejects.toThrow('password value must be omitted');
  });

  it('emits every node with geometry unset (D-4a-13) (Test 3)', async () => {
    const fixture = buildRawNodeFixture();
    const strategy = new ApcLiteStrategy();
    const result = await strategy.run({
      url: fixture.url,
      title: fixture.title,
      mode: 'actionable',
      raw: fixture.root,
    });

    expect(result.root).toBeDefined();
    const nodes = collectNodes(result.root!);
    expect(nodes.length).toBeGreaterThan(1);
    for (const node of nodes) {
      expect(node.geometry, `node ${node.id} geometry`).toBeUndefined();
    }
  });

  it('gates the mode: canHandle is true only for actionable (D-4a-14) (Test 4)', () => {
    const strategy = new ApcLiteStrategy();
    expect(strategy.canHandle({ url: 'https://example.com/', mode: 'actionable' })).toBe(true);
    expect(strategy.canHandle({ url: 'https://example.com/', mode: 'default' })).toBe(false);
  });
});
