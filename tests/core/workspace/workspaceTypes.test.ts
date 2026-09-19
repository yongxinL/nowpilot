import { describe, expect, it } from 'vitest';
import {
  ElectionIdempotencyRecordSchema,
  ElectionRecordSchema,
  ElectionRequestFingerprintSchema,
  HandoffRecordSchema,
  StandaloneTabRecordSchema,
  WORKSPACE_SCHEMA_VERSION,
  WorkspaceElectionClaimReasonSchema,
  WorkspaceElectionOperationSchema,
  WorkspaceMetadataSchema,
  WorkspaceMutationSchema,
  createEmptyWorkspaceMetadata,
  createInstanceId,
} from '@/core/workspace/workspaceTypes';

describe('workspace types', () => {
  it('creates empty metadata at version zero', () => {
    expect(createEmptyWorkspaceMetadata(1000)).toEqual({
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      committedVersion: 0,
      updatedAt: 1000,
    });
  });

  it('creates unique instance identifiers', () => {
    expect(createInstanceId()).not.toBe(createInstanceId());
  });

  it('rejects negative versions and unknown writer types', () => {
    expect(
      WorkspaceMetadataSchema.safeParse({
        schemaVersion: 1,
        committedVersion: -1,
        updatedAt: 0,
      }).success,
    ).toBe(false);
    expect(
      ElectionRecordSchema.safeParse({
        writerType: 'background',
        writerInstanceId: 'a',
        epoch: 0,
        committedVersion: 0,
        handoffPhase: 'idle',
        handoffTargetInstanceId: null,
        updatedAt: 0,
      }).success,
    ).toBe(false);
  });

  it('validates an election record with a nullable handoff target', () => {
    expect(
      ElectionRecordSchema.safeParse({
        writerType: 'sidepanel',
        writerInstanceId: 'instance-1',
        epoch: 0,
        committedVersion: 0,
        handoffPhase: 'idle',
        handoffTargetInstanceId: null,
        updatedAt: 10,
      }).success,
    ).toBe(true);
  });

  it('requires an acknowledgement timestamp to be present or null', () => {
    expect(
      HandoffRecordSchema.safeParse({
        phase: 'prepared',
        fromInstanceId: 'a',
        fromWriterType: 'sidepanel',
        toInstanceId: 'b',
        toWriterType: 'standalone',
        epoch: 0,
        baseVersion: 0,
        preparedAt: 1,
        acknowledgedAt: null,
      }).success,
    ).toBe(true);
    expect(
      HandoffRecordSchema.safeParse({
        phase: 'prepared',
        fromInstanceId: 'a',
        fromWriterType: 'sidepanel',
        toInstanceId: 'b',
        toWriterType: 'standalone',
        epoch: 0,
        baseVersion: 0,
        preparedAt: 1,
      }).success,
    ).toBe(false);
  });

  it('validates a standalone tab record', () => {
    expect(StandaloneTabRecordSchema.safeParse({ tabId: 7, openedAt: 1 }).success).toBe(true);
    expect(StandaloneTabRecordSchema.safeParse({ tabId: -1, openedAt: 1 }).success).toBe(false);
  });

  it('defaults the bounded recent-completed-requests ledger on an election record', () => {
    const parsed = ElectionRecordSchema.safeParse({
      writerType: 'sidepanel',
      writerInstanceId: 'instance-1',
      epoch: 0,
      committedVersion: 0,
      handoffPhase: 'idle',
      handoffTargetInstanceId: null,
      updatedAt: 10,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.recentCompletedRequests).toEqual([]);
  });

  it('closes the election operation and claim-reason vocabularies', () => {
    expect(WorkspaceElectionOperationSchema.safeParse('claim').success).toBe(true);
    expect(WorkspaceElectionOperationSchema.safeParse('relinquish').success).toBe(true);
    expect(WorkspaceElectionOperationSchema.safeParse('handoff-commit').success).toBe(true);
    expect(WorkspaceElectionOperationSchema.safeParse('seize').success).toBe(false);
    expect(WorkspaceElectionClaimReasonSchema.safeParse('initial').success).toBe(true);
    expect(WorkspaceElectionClaimReasonSchema.safeParse('stale-recovery').success).toBe(true);
    expect(WorkspaceElectionClaimReasonSchema.safeParse('fallback').success).toBe(true);
    expect(WorkspaceElectionClaimReasonSchema.safeParse('recovered').success).toBe(false);
  });

  it('validates an election request fingerprint and idempotency record without embedding a record', () => {
    const fingerprint = {
      requestId: '00000000-0000-4000-8000-000000000000',
      operation: 'claim',
      requesterInstanceId: 'instance-1',
      requesterWriterType: 'sidepanel',
      committedVersion: 0,
      reason: 'initial',
    };
    expect(ElectionRequestFingerprintSchema.safeParse(fingerprint).success).toBe(true);
    expect(
      ElectionRequestFingerprintSchema.safeParse({ ...fingerprint, expectedEpoch: -1 }).success,
    ).toBe(false);
    expect(
      ElectionIdempotencyRecordSchema.safeParse({
        request: fingerprint,
        accepted: false,
        code: 'WORKSPACE_ELECTION_REJECTED',
        epoch: 0,
        completedAt: 1,
      }).success,
    ).toBe(true);
    expect(
      ElectionIdempotencyRecordSchema.safeParse({
        request: fingerprint,
        accepted: true,
        epoch: 0,
        completedAt: 1,
      }).success,
    ).toBe(true);
  });

  it('accepts exactly one mutation kind with a schema-valid metadata payload', () => {
    const mutation = {
      mutationId: '00000000-0000-4000-8000-000000000000',
      writerInstanceId: 'writer',
      epoch: 0,
      baseVersion: 0,
      resultingVersion: 1,
      kind: 'workspace.metadata.set',
      payload: { schemaVersion: 1, committedVersion: 1, updatedAt: 5 },
    };
    expect(WorkspaceMutationSchema.safeParse(mutation).success).toBe(true);
    expect(
      WorkspaceMutationSchema.safeParse({ ...mutation, kind: 'workspace.notes.set' }).success,
    ).toBe(false);
  });
});
