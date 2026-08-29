// ApcLiteStrategy tests — §18 required test for the actionable path (06-02).
//
// Panel-side tier: RawNode → APCLiteNode normalization + APCLiteDocumentSchema
// validation (source 'ax'). Proven here: normalization hierarchy, schema
// acceptance with stats, the FormControlSchema.refine password backstop
// (D-86 — a password-carrying fixture must FAIL validation), canHandle gating
// on mode:'actionable' (D-86 — zero AX cost on the read path), the run()
// StrategyResult contract, and the failed-fallback shape for a missing raw
// payload that lets PageContentService surface CONTENT_EXTRACT_FAILED — never
// a silent empty result (D-91).
import { describe, it, expect } from 'vitest';

import { apcLiteStrategy, normalizeRawNode } from '@/core/extraction/strategies/ApcLiteStrategy';
import { APCLiteDocumentSchema } from '@/core/extraction/apcLite.types';
import type { RawNode } from '@/core/extraction/apcLite.types';
import type { StrategyInput } from '@/core/extraction/strategies/IExtractionStrategy';
import { PageContentService } from '@/core/extraction/PageContentService';

// --- Inline synthesized RawNode fixtures (walker output shape) ---

const RAW_TREE: RawNode = {
  id: 'n1',
  role: 'region',
  children: [
    { id: 'n1.1', role: 'heading', type: 'h1', text: 'ServiceNow Password Reset' },
    {
      id: 'n1.2',
      role: 'link',
      text: 'Incident Management',
      link: { href: 'https://support.servicenow.com/kb/incident-management/123' },
      interaction: { clickable: true, focusable: true },
    },
    { id: 'n1.3', role: 'button', text: 'Refresh', interaction: { clickable: true } },
    {
      id: 'n1.4',
      role: 'table',
      children: [
        {
          id: 'n1.4.1',
          role: 'rowgroup',
          children: [
            {
              id: 'n1.4.1.1',
              role: 'row',
              children: [
                { id: 'n1.4.1.1.1', role: 'cell', text: 'State' },
                { id: 'n1.4.1.1.2', role: 'cell', text: 'In Progress' },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const TREE_NODE_COUNT = 9; // n1 + 4 children + rowgroup + row + 2 cells

/** Fixture that violates the D-86 invariant: password value present at capture. */
const LEAKY_PASSWORD_TREE: RawNode = {
  id: 'n1',
  role: 'textbox',
  type: 'text',
  form: { control: { fieldName: 'password', fieldType: 'password', value: 'hunter2', isPassword: true } },
};

function input(overrides: Partial<StrategyInput> = {}): StrategyInput {
  return {
    url: 'https://support.servicenow.com/kb/article/123',
    title: 'How to reset a user password in ServiceNow',
    mode: 'actionable',
    ...overrides,
  };
}

describe('ApcLiteStrategy', () => {
  it('normalizes RawNode → APCLiteNode with the same hierarchy and schema-validates as source ax', () => {
    const root = normalizeRawNode(RAW_TREE);

    // Same hierarchy: ids + roles carry through verbatim.
    expect(root.id).toBe('n1');
    expect(root.role).toBe('region');
    expect(root.children?.map((c) => c.id)).toEqual(['n1.1', 'n1.2', 'n1.3', 'n1.4']);
    expect(root.children?.[3]?.children?.[0]?.children?.[0]?.children?.map((c) => c.text)).toEqual([
      'State',
      'In Progress',
    ]);

    // Heading level derived from type (h1 → 1); non-headings carry no textStyle.
    expect(root.children?.[0]).toMatchObject({
      role: 'heading',
      type: 'h1',
      text: 'ServiceNow Password Reset',
      textStyle: { level: 1 },
    });
    expect(root.children?.[1]?.textStyle).toBeUndefined();

    // Interaction + link fields map verbatim.
    expect(root.children?.[1]?.interaction).toEqual({ clickable: true, focusable: true });
    expect(root.children?.[1]?.link?.href).toBe('https://support.servicenow.com/kb/incident-management/123');

    // Output validates as an APCLiteDocument with source 'ax' + stats.
    const doc = APCLiteDocumentSchema.parse({
      url: input().url,
      title: input().title,
      extractedAt: Date.now(),
      source: 'ax',
      root,
      stats: { nodeCount: TREE_NODE_COUNT, approxTokens: 1, durationMs: 1, truncated: false },
    });
    expect(doc.source).toBe('ax');
    expect(doc.stats.truncated).toBe(false);
    expect(doc.stats.nodeCount).toBe(TREE_NODE_COUNT);
  });

  it('rejects a password-carrying form control — FormControlSchema.refine backstop (D-86)', async () => {
    // Direct backstop proof: the normalized tree fails APCLiteDocumentSchema.parse.
    const normalized = normalizeRawNode(LEAKY_PASSWORD_TREE);
    expect(() =>
      APCLiteDocumentSchema.parse({
        url: input().url,
        title: input().title,
        extractedAt: Date.now(),
        source: 'ax',
        root: normalized,
        stats: { nodeCount: 1, approxTokens: 1, durationMs: 1, truncated: false },
      }),
    ).toThrow(/password value must be omitted/);

    // run() catches the validation failure into the failed shape — never silent.
    const result = await apcLiteStrategy.run(input({ raw: LEAKY_PASSWORD_TREE }));
    expect(result.source).toBe('apc-lite');
    expect(result.root).toBeUndefined();
    expect(result.approxTokens).toBe(0);
    expect(result.truncated).toBe(true);
  });

  it('canHandle only mode:actionable — zero AX cost on the default read path (D-86)', () => {
    expect(apcLiteStrategy.canHandle({ url: 'https://x.example/', mode: 'actionable' })).toBe(true);
    expect(apcLiteStrategy.canHandle({ url: 'https://x.example/', mode: 'default' })).toBe(false);
  });

  it('run() returns the StrategyResult { source: apc-lite, root, meta, approxTokens, truncated:false } for a valid raw tree', async () => {
    const result = await apcLiteStrategy.run(input({ raw: RAW_TREE }));

    expect(result.source).toBe('apc-lite');
    expect(result.root?.id).toBe('n1');
    expect(result.root?.children?.[0]?.textStyle?.level).toBe(1);
    expect(result.meta?.nodeCount).toBe(String(TREE_NODE_COUNT));
    expect(result.approxTokens).toBeGreaterThan(0);
    expect(result.truncated).toBe(false);
  });

  it('run() with input.raw undefined yields the failed fallback shape — never a silent empty result (D-91)', async () => {
    const result = await apcLiteStrategy.run(input({ raw: undefined }));

    expect(result.source).toBe('apc-lite');
    expect(result.markdown).toBeUndefined();
    expect(result.root).toBeUndefined();
    expect(result.approxTokens).toBe(0);
    expect(result.truncated).toBe(true);
  });

  it('registers into PageContentService so the actionable path surfaces CONTENT_EXTRACT_FAILED, never a silent empty', async () => {
    // apcLiteStrategy registered at module load (import above). Actionable
    // request without a raw payload → failed shape → typed error surfaces.
    const result = await PageContentService.extract({
      tabId: 1,
      url: 'https://support.servicenow.com/kb/article/123',
      title: 'How to reset a user password in ServiceNow',
      mode: 'actionable',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('CONTENT_EXTRACT_FAILED');
    }
  });
});