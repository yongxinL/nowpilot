import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContextProvenanceManifest, PromptSection } from '../../../src/core/ai/types';

// ContextCompressor imports generateText from 'ai'; these tests exercise the
// degradation pipeline only through local steps (compression provider never
// invoked), so the module is mocked like the other context suites.
vi.mock('ai', () => {
  return {
    generateText: vi.fn(),
    streamText: vi.fn(),
    Output: {
      object: vi.fn(),
    },
    isStepCount: vi.fn(() => vi.fn()),
  };
});

function buildSection(overrides: Partial<PromptSection>): PromptSection {
  return {
    kind: 'system',
    text: '',
    tokens: 0,
    stable: true,
    sourceId: 'core.instructions.system',
    ...overrides,
  };
}

function systemSection(tokens: number): PromptSection {
  return buildSection({
    kind: 'system',
    text: 'system',
    tokens,
    stable: true,
    sourceId: 'core.instructions.system',
  });
}

function userInputSection(tokens: number): PromptSection {
  return buildSection({
    kind: 'user_input',
    text: 'hello',
    tokens,
    stable: false,
    sourceId: 'interaction.user.current-turn',
  });
}

/**
 * A ContextReceiptEntry-shaped object for validateReceiptTotals() fixtures.
 */
function receiptEntry(
  overrides: Partial<ContextProvenanceManifest['sections'][number]>,
): ContextProvenanceManifest['sections'][number] {
  return {
    kind: 'system',
    sourceId: 'core.instructions.system',
    tokens: 0,
    truncated: false,
    originalTokens: 0,
    finalTokens: 0,
    included: true,
    cacheEligible: false,
    ...overrides,
  };
}

describe('ContextProvenanceManifest receipts (04b-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recordSectionWithReceipt() creates an entry with all receipt fields populated', async () => {
    const { createProvenanceManifest, recordSectionWithReceipt } = await import(
      '../../../src/core/context/ContextProvenanceManifest'
    );
    const manifest = createProvenanceManifest('ws-test-1', 'sidepanel');
    const section = buildSection({ kind: 'system', text: 'sys', tokens: 10, stable: true });

    recordSectionWithReceipt(manifest, section, 15, true);

    expect(manifest.sections).toHaveLength(1);
    expect(manifest.sections[0]).toMatchObject({
      kind: 'system',
      sourceId: 'core.instructions.system',
      originalTokens: 15,
      finalTokens: 10,
      included: true,
      cacheEligible: true,
      truncated: false,
    });
    expect(manifest.totalTokens).toBe(10);
  });

  it('markOmitted() records an excluded source with finalTokens 0 and no totalTokens contribution', async () => {
    const { createProvenanceManifest, markOmitted } = await import(
      '../../../src/core/context/ContextProvenanceManifest'
    );
    const manifest = createProvenanceManifest('ws-test-1', 'sidepanel');

    markOmitted(manifest, 'context.page.current', 'context', 'budget', 1500);

    expect(manifest.sections).toHaveLength(1);
    expect(manifest.sections[0]).toMatchObject({
      kind: 'context',
      sourceId: 'context.page.current',
      originalTokens: 1500,
      finalTokens: 0,
      included: false,
      omissionReason: 'budget',
      cacheEligible: false,
    });
    expect(manifest.totalTokens).toBe(0);
  });

  it('validateReceiptTotals() returns true when the included receipt total equals the packed total', async () => {
    const { validateReceiptTotals } = await import(
      '../../../src/core/context/ContextProvenanceManifest'
    );
    const receipt = [
      receiptEntry({ originalTokens: 50, finalTokens: 40, included: true }),
      // omitted source: finalTokens 0 — excluded from the total
      receiptEntry({ originalTokens: 10, finalTokens: 0, included: false }),
    ];
    const packed = [buildSection({ tokens: 40 })];

    expect(validateReceiptTotals(receipt, packed)).toBe(true);
  });

  it('validateReceiptTotals() returns false when receipt totals and packed totals diverge', async () => {
    const { validateReceiptTotals } = await import(
      '../../../src/core/context/ContextProvenanceManifest'
    );
    const receipt = [receiptEntry({ originalTokens: 500, finalTokens: 500, included: true })];
    const packed = [buildSection({ tokens: 450 })];

    expect(validateReceiptTotals(receipt, packed)).toBe(false);
  });

  it('markTruncated() flags the entry without disturbing its receipt fields', async () => {
    const { createProvenanceManifest, recordSectionWithReceipt, markTruncated } = await import(
      '../../../src/core/context/ContextProvenanceManifest'
    );
    const manifest = createProvenanceManifest('ws-test-1', 'sidepanel');
    const section = buildSection({ kind: 'context', text: 'page', tokens: 40, stable: false, sourceId: 'context.page.current' });

    recordSectionWithReceipt(manifest, section, 60, false);
    markTruncated(manifest, section.sourceId);

    expect(manifest.sections[0].truncated).toBe(true);
    expect(manifest.sections[0]).toMatchObject({
      originalTokens: 60,
      finalTokens: 40,
      included: true,
      cacheEligible: false,
    });
  });

  it('compress() omissionReasons maps the trimmed tool schema sourceId to budget', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const toolSchemas = Array.from({ length: 6 }, (_, i) => ({
      name: `tool-${i}`,
      description: 'd'.repeat(150),
      dangerous: i === 5,
    }));
    const sections = [
      systemSection(10),
      buildSection({
        kind: 'tool_schemas',
        text: JSON.stringify(toolSchemas),
        tokens: 350,
        stable: true,
        sourceId: 'tools.builtin.selected',
      }),
      userInputSection(5),
    ];

    // medium tier → cap 5 safe tools: the dangerous 6th schema is dropped
    const result = await contextCompressor.compress(sections, 340, 'medium');

    expect(result.stepsApplied).toContain('trim-tools');
    expect(result.omissionReasons.get('tools.builtin.selected')).toBe('budget');
  });

  it('compress() omissionReasons is empty when the budget is satisfied without degradation', async () => {
    const { contextCompressor } = await import('../../../src/core/context/ContextCompressor');
    const result = await contextCompressor.compress(
      [systemSection(10), userInputSection(5)],
      100,
      'medium',
    );

    expect(result.stepsApplied).toHaveLength(0);
    expect(result.omissionReasons.size).toBe(0);
  });
});
