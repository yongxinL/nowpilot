import { describe, it, expect, vi, beforeEach } from 'vitest';

// MemoryEngine source module will be created in wave 3 (plan 05-06).
// createMockX factory functions and imports added when source exists.
// Pattern: mock factory + constructor injection (see AgentOrchestrator.test.ts)

describe('MemoryEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.todo('placeholder — tests added in wave 2-4');
});

// ---------------------------------------------------------------------------
// Mock factory for MemoryExtractor (consumed by P06 MemoryEngine.extract)
// Pattern: AgentOrchestrator.test.ts createMockPlanner/createMockExecutor
// ---------------------------------------------------------------------------

/**
 * Creates a mock MemoryExtractor for MemoryEngine integration tests.
 *
 * Usage (P06):
 *   import { createMockExtractor } from './MemoryEngine.test';
 *   // ...or inline in the test file.
 *
 * All methods return default empty results that tests can override per-call:
 *   vi.mocked(extractor.extract).mockResolvedValueOnce({ facts: [...], summary: '...' });
 */
export function createMockExtractor() {
  return {
    extract: vi.fn().mockResolvedValue({ facts: [], summary: undefined }),
  };
}
