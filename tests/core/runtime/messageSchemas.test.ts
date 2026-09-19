import { describe, expect, it } from 'vitest';
import {
  RuntimeErrorPayload,
  StandaloneOpenPayload,
  WorkspaceMutationPayload,
  WorkspaceRehydrateRequestPayload,
} from '@/core/runtime/messageSchemas';

const VALID_MUTATION = {
  mutationId: '00000000-0000-4000-8000-000000000000',
  writerInstanceId: 'writer',
  epoch: 0,
  baseVersion: 0,
  resultingVersion: 1,
  kind: 'workspace.metadata.set',
  payload: { schemaVersion: 1, committedVersion: 1, updatedAt: 5 },
};

describe('payload schemas', () => {
  it('validates a mutation payload', () => {
    expect(WorkspaceMutationPayload.safeParse(VALID_MUTATION).success).toBe(true);
    expect(WorkspaceMutationPayload.safeParse({ ...VALID_MUTATION, epoch: -1 }).success).toBe(
      false,
    );
  });

  it('validates standalone destinations against the route registry', () => {
    expect(StandaloneOpenPayload.safeParse({ destination: 'options' }).success).toBe(true);
    expect(StandaloneOpenPayload.safeParse({ destination: 'teamgqm' }).success).toBe(false);
  });

  it('validates a rehydrate request including the requesting instance', () => {
    expect(
      WorkspaceRehydrateRequestPayload.safeParse({
        sinceVersion: 2,
        instanceId: 'standalone-instance',
        writerType: 'standalone',
      }).success,
    ).toBe(true);
    expect(
      WorkspaceRehydrateRequestPayload.safeParse({
        sinceVersion: -1,
        instanceId: 'standalone-instance',
        writerType: 'standalone',
      }).success,
    ).toBe(false);
  });

  it('validates runtime error payloads against the error registry', () => {
    expect(RuntimeErrorPayload.safeParse({ code: 'WORKSPACE_VERSION_CONFLICT' }).success).toBe(
      true,
    );
    expect(RuntimeErrorPayload.safeParse({ code: 'NOT_A_CODE' }).success).toBe(false);
  });
});

import { MESSAGE_TYPES } from '@/core/runtime/MessageType';
import { RUNTIME_PAYLOAD_SCHEMAS } from '@/core/runtime/messageSchemas';

it('maps every message type to exactly one payload schema', () => {
  expect(Object.keys(RUNTIME_PAYLOAD_SCHEMAS).sort()).toEqual([...MESSAGE_TYPES].sort());
});
