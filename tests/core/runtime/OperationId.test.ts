import { describe, it, expect, vi } from 'vitest';
import { generateOperationId } from '../../../src/core/runtime/OperationId';

describe('OperationId', () => {
  it('generates a non-empty string', () => {
    const id = generateOperationId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateOperationId()));
    expect(ids.size).toBe(100);
  });

  it('generates valid UUID format', () => {
    const id = generateOperationId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('falls back to a UUID-shaped unique id when crypto.randomUUID is unavailable (WR-01)', () => {
    vi.stubGlobal('crypto', { ...(globalThis.crypto ?? {}), randomUUID: undefined });
    try {
      const ids = new Set(
        Array.from({ length: 100 }, () => generateOperationId()),
      );
      expect(ids.size).toBe(100);
      for (const id of ids) {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
