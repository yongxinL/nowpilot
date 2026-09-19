import { describe, expect, it } from 'vitest';
import {
  RuntimeErrorPayload,
  StandaloneOpenPayload,
  WorkspaceElectionRequestPayload,
  WorkspaceElectionResponsePayload,
  WorkspaceMutationPayload,
  WorkspaceRehydrateRequestPayload,
} from '@/core/runtime/messageSchemas';
import { createOperationId } from '@/core/runtime/OperationId';

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

  it('validates an election request payload including the stable requestId', () => {
    const request = {
      requestId: createOperationId(),
      operation: 'claim',
      requesterInstanceId: 'sidepanel-instance',
      requesterWriterType: 'sidepanel',
      committedVersion: 0,
      reason: 'initial',
    };
    expect(WorkspaceElectionRequestPayload.safeParse(request).success).toBe(true);
    expect(
      WorkspaceElectionRequestPayload.safeParse({ ...request, operation: 'seize' }).success,
    ).toBe(false);
    expect(
      WorkspaceElectionRequestPayload.safeParse({ ...request, committedVersion: -1 }).success,
    ).toBe(false);
    expect(WorkspaceElectionRequestPayload.safeParse({ ...request, reason: 'seize' }).success).toBe(
      false,
    );
  });

  it('validates an election response payload with accepted, record and code', () => {
    const requestId = createOperationId();
    expect(WorkspaceElectionResponsePayload.safeParse({ requestId, accepted: false }).success).toBe(
      true,
    );
    expect(
      WorkspaceElectionResponsePayload.safeParse({
        requestId,
        accepted: false,
        code: 'WORKSPACE_ELECTION_REJECTED',
      }).success,
    ).toBe(true);
    expect(
      WorkspaceElectionResponsePayload.safeParse({
        requestId,
        accepted: false,
        code: 'NOT_A_CODE',
      }).success,
    ).toBe(false);
    expect(
      WorkspaceElectionResponsePayload.safeParse({
        requestId,
        accepted: true,
        record: {
          writerType: 'sidepanel',
          writerInstanceId: 'sidepanel-instance',
          epoch: 0,
          committedVersion: 0,
          handoffPhase: 'idle',
          handoffTargetInstanceId: null,
          updatedAt: 1,
          recentCompletedRequests: [],
        },
      }).success,
    ).toBe(true);
  });
});

import { MESSAGE_TYPES } from '@/core/runtime/MessageType';
import { RUNTIME_PAYLOAD_SCHEMAS } from '@/core/runtime/messageSchemas';

it('maps every message type to exactly one payload schema', () => {
  expect(Object.keys(RUNTIME_PAYLOAD_SCHEMAS).sort()).toEqual([...MESSAGE_TYPES].sort());
});

it('registers exactly thirteen message types including the election pair', () => {
  expect([...MESSAGE_TYPES]).toHaveLength(13);
  expect(MESSAGE_TYPES).toContain('workspace.election.request');
  expect(MESSAGE_TYPES).toContain('workspace.election.response');
});
