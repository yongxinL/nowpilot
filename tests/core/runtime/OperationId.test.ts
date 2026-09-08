import { describe, expect, it } from 'vitest';
import { createOperationId } from '@/core/runtime/OperationId';

describe('OperationId', () => {
  it('generates unique operation ids', () => {
    const a = createOperationId();
    const b = createOperationId();
    expect(a).not.toBe(b);
  });

  it('produces a uuid-shaped string', () => {
    const id = createOperationId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
