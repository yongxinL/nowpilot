import { describe, it, expect } from 'vitest';
import {
  createManifest,
  recordSection,
  recordDegradationStep,
  setMinimalMode,
  createSectionEntry,
  contextProvenanceManifestSchema,
} from '../../../src/core/context/ContextProvenanceManifest';

describe('createManifest', () => {
  it('returns manifest with empty sections and degradationSteps', () => {
    const manifest = createManifest({
      operationId: 'test-op',
      tier: 'small',
      inputBudget: 11468,
      outputBudget: 3276,
      safetyMargin: 1640,
    });
    expect(manifest.operationId).toBe('test-op');
    expect(manifest.tier).toBe('small');
    expect(manifest.sections).toHaveLength(0);
    expect(manifest.degradationSteps).toHaveLength(0);
    expect(manifest.minimalMode).toBe(false);
    expect(manifest.createdAt).toBeGreaterThan(0);
  });
});

describe('recordSection', () => {
  it('appends entry without mutating original manifest', () => {
    const manifest = createManifest({
      operationId: 'test-op',
      tier: 'small',
      inputBudget: 11468,
      outputBudget: 3276,
      safetyMargin: 1640,
    });
    const entry = createSectionEntry({
      kind: 'system_prompt',
      sourceId: 'sys',
      originalTokens: 100,
      outcome: 'kept',
    });
    const updated = recordSection(manifest, entry);
    expect(manifest.sections).toHaveLength(0);
    expect(updated.sections).toHaveLength(1);
    expect(updated.sections[0].kind).toBe('system_prompt');
  });
});

describe('createSectionEntry', () => {
  it('sets finalTokens to 0 when outcome is dropped', () => {
    const entry = createSectionEntry({
      kind: 'debug_data',
      sourceId: 'debug',
      originalTokens: 50,
      outcome: 'dropped',
      reason: 'degradation_step_1',
    });
    expect(entry.finalTokens).toBe(0);
    expect(entry.outcome).toBe('dropped');
    expect(entry.reason).toBe('degradation_step_1');
  });

  it('preserves finalTokens === originalTokens when outcome is kept', () => {
    const entry = createSectionEntry({
      kind: 'system_prompt',
      sourceId: 'sys',
      originalTokens: 100,
      outcome: 'kept',
    });
    expect(entry.finalTokens).toBe(100);
    expect(entry.outcome).toBe('kept');
  });

  it('includes compressionMethod when outcome is compressed', () => {
    const entry = createSectionEntry({
      kind: 'conversation_history',
      sourceId: 'hist',
      originalTokens: 500,
      finalTokens: 150,
      outcome: 'compressed',
      compressionMethod: 'summarise',
      reason: 'degradation_step_3',
    });
    expect(entry.compressionMethod).toBe('summarise');
    expect(entry.reason).toBe('degradation_step_3');
    expect(entry.finalTokens).toBe(150);
  });
});

describe('recordDegradationStep', () => {
  it('appends step without mutating original manifest', () => {
    const manifest = createManifest({
      operationId: 'test-op',
      tier: 'small',
      inputBudget: 11468,
      outputBudget: 3276,
      safetyMargin: 1640,
    });
    const updated = recordDegradationStep(manifest, 'degradation_step_1');
    expect(manifest.degradationSteps).toHaveLength(0);
    expect(updated.degradationSteps).toHaveLength(1);
    expect(updated.degradationSteps[0]).toBe('degradation_step_1');
  });
});

describe('setMinimalMode', () => {
  it('returns manifest with minimalMode true without mutating original', () => {
    const manifest = createManifest({
      operationId: 'test-op',
      tier: 'small',
      inputBudget: 11468,
      outputBudget: 3276,
      safetyMargin: 1640,
    });
    const updated = setMinimalMode(manifest);
    expect(manifest.minimalMode).toBe(false);
    expect(updated.minimalMode).toBe(true);
  });
});

describe('contextProvenanceManifestSchema', () => {
  it('validates a valid manifest', () => {
    const manifest = createManifest({
      operationId: 'test-op',
      tier: 'small',
      inputBudget: 11468,
      outputBudget: 3276,
      safetyMargin: 1640,
    });
    const result = contextProvenanceManifestSchema.parse(manifest);
    expect(result.operationId).toBe('test-op');
  });

  it('rejects malformed manifest', () => {
    expect(() =>
      contextProvenanceManifestSchema.parse({ operationId: '' }),
    ).toThrow();
  });
});
