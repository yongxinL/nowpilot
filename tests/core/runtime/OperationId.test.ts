// tests/core/runtime/OperationId.test.ts — §0.3 fixture
// @vitest-environment node — pure logic test, no DOM needed (01-01 Rule 3 env note).
// createOperationId() returns a UUID v4-shaped string (crypto.randomUUID),
// and two calls differ (collision safety).
import { describe, it, expect } from 'vitest';
import { createOperationId } from '@/core/runtime/OperationId';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('createOperationId', () => {
  it('returns a UUID v4-shaped string', () => {
    expect(createOperationId()).toMatch(UUID_V4_RE);
  });

  it('returns different ids on consecutive calls', () => {
    expect(createOperationId()).not.toBe(createOperationId());
  });
});
