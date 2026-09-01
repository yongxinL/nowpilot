import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * WorkingMemory — O.10: template init, redaction, 300-token cap, truncation,
 * single-writer gate.
 */

// Mutable isPrimaryWriter mock.
const isPrimaryWriterMock = vi.fn(() => true);
vi.mock('../../../src/core/workspace/WorkspaceStore', () => ({
  isPrimaryWriter: () => isPrimaryWriterMock(),
}));

import {
  initWorkingMemory,
  updateWorkingMemory,
  MAX_WORKING_MEMORY_TOKENS,
  __test__,
} from '../../../src/core/memory/WorkingMemory';
import { WORKING_MEMORY_TEMPLATE } from '../../../src/types/harness';

describe('WorkingMemory — O.10 (D-104)', () => {
  beforeEach(() => {
    isPrimaryWriterMock.mockReturnValue(true);
  });

  it('INIT: produces the §3.6 template with tokens = estimate', () => {
    const wm = initWorkingMemory('res-1');
    expect(wm.resourceId).toBe('res-1');
    expect(wm.markdown).toBe(WORKING_MEMORY_TEMPLATE);
    expect(wm.tokens).toBe(__test__.estimateTokens(WORKING_MEMORY_TEMPLATE));
    expect(wm.tokens).toBeGreaterThan(0);
  });

  it('UPDATE: replaces the **Name** value and re-estimates tokens', () => {
    const wm = initWorkingMemory('res-2');
    const updated = updateWorkingMemory(wm, { Name: 'Alice' });
    expect(updated.markdown).toContain('- **Name**: Alice');
    expect(updated.tokens).toBe(__test__.estimateTokens(updated.markdown));
    expect(updated.updatedAt).toBeGreaterThanOrEqual(wm.updatedAt);
  });

  it('REDACTION: a long value is truncated by redactSensitiveValue (§4.4 never store raw content)', () => {
    const wm = initWorkingMemory('res-3');
    // A value >80 chars triggers redactSensitiveValue's truncation for strings.
    const longValue = 'x'.repeat(200);
    const updated = updateWorkingMemory(wm, { Name: longValue });
    // The truncated value in markdown must be ≤80 chars (+ '…').
    const nameLine = updated.markdown.split('\n').find((l) => l.includes('**Name**'));
    expect(nameLine).toBeDefined();
    // After '- **Name**: ' prefix, the value is truncated.
    const valuePart = nameLine!.split('- **Name**: ')[1];
    expect(valuePart.length).toBeLessThanOrEqual(81); // 80 chars + '…'
  });

  it('TOKEN CAP: a huge patch truncates to ≤ 300 tokens', () => {
    const wm = initWorkingMemory('res-4');
    // Create a very long value that would exceed 300 tokens.
    const hugeValue = 'x'.repeat(5000);
    const updated = updateWorkingMemory(wm, { 'Long-term Goals': hugeValue });
    expect(updated.tokens).toBeLessThanOrEqual(MAX_WORKING_MEMORY_TOKENS);
  });

  it('SINGLE-WRITER: update returns cur unchanged when isPrimaryWriter false', () => {
    const wm = initWorkingMemory('res-5');
    isPrimaryWriterMock.mockReturnValue(false);

    const updated = updateWorkingMemory(wm, { Name: 'Bob' });
    // Unchanged (non-primary gate).
    expect(updated.markdown).toBe(wm.markdown);
    expect(updated.tokens).toBe(wm.tokens);

    isPrimaryWriterMock.mockReturnValue(true);
  });

  it('MULTI-FIELD: updates multiple fields in one call', () => {
    const wm = initWorkingMemory('res-6');
    const updated = updateWorkingMemory(wm, {
      Name: 'Carol',
      'Role / Team': 'Platform Engineering',
    });
    expect(updated.markdown).toContain('- **Name**: Carol');
    expect(updated.markdown).toContain('- **Role / Team**: Platform Engineering');
  });
});
