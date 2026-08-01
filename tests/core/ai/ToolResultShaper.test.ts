import { describe, expect, it } from 'vitest';
import type { ContextItem, ToolExecutionResult } from '../../../src/core/ai/types';
import { toolResultShaper } from '../../../src/core/ai/ToolResultShaper';

/**
 * Fixture builder (plan: fixture builder pattern consistent with the
 * existing context test suites). Defaults to a valid, non-sensitive
 * string-output tool result; overrides let each test construct the exact
 * scenario it needs.
 */
function buildResult(overrides: Partial<ToolExecutionResult> = {}): ToolExecutionResult {
  return {
    toolName: 'get-page-content',
    output: 'plain tool output',
    durationMs: 120,
    toolCallId: 'call_01HZXK3',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 1 — ToolResultShaper.shape() (TOL-04, D-05): redaction, size limit,
// provenance, immutability
// ─────────────────────────────────────────────────────────────────────────────

describe('ToolResultShaper.shape() — basic shaping and provenance (TOL-04, D-05)', () => {
  it('simple string output → context item with tools.builtin.{toolName} sourceId and data authority', () => {
    const item = toolResultShaper.shape(buildResult());
    expect(item).not.toBeNull();
    expect(item!.kind).toBe('context');
    expect(item!.sourceId).toBe('tools.builtin.get-page-content');
    expect(item!.instructionAuthority).toBe('data');
    expect(item!.stable).toBe(false);
    expect(item!.relevance).toBe(1.0);
    expect(item!.freshness).toBe(1.0);
    expect(item!.text).toBe('plain tool output');
  });

  it('object output → JSON.stringify text carried in the context item', () => {
    const obj = { data: 'test', ok: true };
    const item = toolResultShaper.shape(buildResult({ output: obj }));
    expect(item).not.toBeNull();
    expect(item!.text).toBe(JSON.stringify(obj));
  });
});

describe('ToolResultShaper.shape() — secret redaction (T-04b-09)', () => {
  it('sk- API key is redacted with ***REDACTED*** markers — raw key never present', () => {
    const item = toolResultShaper.shape(buildResult({ output: 'key is sk-proj-abc123secretkey here' }));
    expect(item).not.toBeNull();
    expect(item!.text).toContain('***REDACTED***');
    expect(item!.text).not.toContain('sk-proj-abc123secretkey');
  });

  it('JWT is replaced with ***REDACTED_JWT*** — raw JWT never present', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig';
    const item = toolResultShaper.shape(buildResult({ output: `token=${jwt}` }));
    expect(item).not.toBeNull();
    expect(item!.text).toContain('***REDACTED_JWT***');
    expect(item!.text).not.toContain(jwt);
  });

  it('Bearer token is replaced with ***REDACTED*** — raw token never present', () => {
    const item = toolResultShaper.shape(buildResult({ output: 'Authorization: Bearer xyz-token-123' }));
    expect(item).not.toBeNull();
    expect(item!.text).toContain('***REDACTED***');
    expect(item!.text).not.toContain('xyz-token-123');
  });

  it('JSESSIONID session token is replaced with ***REDACTED*** — raw ID never present', () => {
    const item = toolResultShaper.shape(buildResult({ output: 'session JSESSIONID=ABC123 active' }));
    expect(item).not.toBeNull();
    expect(item!.text).toContain('JSESSIONID=***REDACTED***');
    expect(item!.text).not.toContain('ABC123');
  });
});

describe('ToolResultShaper.shape() — size limit (MAX_TOOL_RESULT_CHARS)', () => {
  it('output longer than 32,000 chars is truncated to 32,000 + "\\n[truncated]"', () => {
    const longOutput = 'a'.repeat(33_000);
    const item = toolResultShaper.shape(buildResult({ output: longOutput }));
    expect(item).not.toBeNull();
    // 32,000 truncated chars + '\n[truncated]' (13 chars) — total ≤ 33,000.
    expect(item!.text.length).toBe(32_000 + '\n[truncated]'.length);
    expect(item!.text.endsWith('\n[truncated]')).toBe(true);
    expect(item!.text.startsWith('a'.repeat(32_000))).toBe(true);
    expect(item!.text).not.toContain('a'.repeat(32_000) + 'a');
  });
});

describe('ToolResultShaper.shape() — immutability (D-05)', () => {
  it('does NOT mutate the original ToolExecutionResult for object output', () => {
    const originalOutput = { data: 'test', nested: { deep: [1, 2] } };
    const result = buildResult({ output: originalOutput });
    const clone = structuredClone(originalOutput);
    toolResultShaper.shape(result);
    expect(result.output).toEqual(clone);
  });

  it('does NOT mutate the original ToolExecutionResult for string output', () => {
    const result = buildResult({ output: 'original string output' });
    toolResultShaper.shape(result);
    expect(result.output).toBe('original string output');
  });
});

describe('ToolResultShaper.shape() — edge cases and trust assignment', () => {
  it('empty output → empty text and zero tokens', () => {
    const item = toolResultShaper.shape(buildResult({ output: '' }));
    expect(item).not.toBeNull();
    expect(item!.text).toBe('');
    expect(item!.tokens).toBe(0);
  });

  it('assigns trust 0.9 / sensitivity private / data authority via contextTrustPolicy.assess()', () => {
    const item = toolResultShaper.shape(buildResult());
    expect(item).not.toBeNull();
    expect(item!.trust).toBe(0.9);
    expect(item!.sensitivity).toBe('private');
    expect(item!.instructionAuthority).toBe('data');
  });

  it('returns a ContextItem that satisfies the ContextItemSchema contract', () => {
    const item = toolResultShaper.shape(buildResult());
    expect(item).not.toBeNull();
    const typed: ContextItem = item!;
    expect(typed.tokens).toBeGreaterThanOrEqual(0);
    expect(typed.trust).toBeGreaterThanOrEqual(0);
    expect(typed.trust).toBeLessThanOrEqual(1);
  });
});
