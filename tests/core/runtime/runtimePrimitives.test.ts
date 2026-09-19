import { describe, expect, it } from 'vitest';
import { MESSAGE_TYPES, MessageTypeSchema } from '@/core/runtime/MessageType';
import { OperationIdSchema, createOperationId } from '@/core/runtime/OperationId';
import { RUNTIME_SURFACES, RuntimeSurfaceSchema } from '@/core/runtime/RuntimeSurface';

describe('runtime primitives', () => {
  it('declares exactly three runtime surfaces', () => {
    expect(RUNTIME_SURFACES).toEqual(['background', 'sidepanel', 'standalone']);
    expect(RuntimeSurfaceSchema.safeParse('content').success).toBe(false);
  });

  it('generates valid operation identifiers', () => {
    const id = createOperationId();
    expect(OperationIdSchema.safeParse(id).success).toBe(true);
    expect(OperationIdSchema.safeParse('not-a-uuid').success).toBe(false);
  });

  it('declares the eleven canonical message types in order', () => {
    expect(MESSAGE_TYPES).toEqual([
      'workspace.mutation',
      'workspace.handoff.prepare',
      'workspace.handoff.ack',
      'workspace.handoff.commit',
      'workspace.relinquish',
      'workspace.rehydrate.request',
      'workspace.rehydrate.response',
      'standalone.open',
      'standalone.focus',
      'standalone.closed',
      'runtime.error',
    ]);
    expect(MessageTypeSchema.safeParse('workspace.mutation').success).toBe(true);
    expect(MessageTypeSchema.safeParse('workspace.unknown').success).toBe(false);
  });
});
