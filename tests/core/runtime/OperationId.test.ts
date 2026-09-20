import { describe, it, expect } from 'vitest';
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
});
