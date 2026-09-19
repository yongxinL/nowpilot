import { createErrorRecord, debugLog } from '../error/debugLog';
import type { ValidatedStorage } from '../storage/chromeStorage';
import {
  WorkspaceMetadataSchema,
  WorkspaceVersionRecordSchema,
  type WorkspaceMetadata,
} from './workspaceTypes';

export type WorkspaceMetadataReadResult =
  { status: 'missing' } | { status: 'valid'; metadata: WorkspaceMetadata } | { status: 'invalid' };

export interface WorkspaceStore {
  readMetadata(): Promise<WorkspaceMetadataReadResult>;
  writeMetadata(metadata: WorkspaceMetadata): Promise<void>;
  readVersion(): Promise<number>;
  writeVersion(committedVersion: number, updatedAt: number): Promise<void>;
}

export function createWorkspaceStore(storage: ValidatedStorage): WorkspaceStore {
  return {
    async readMetadata() {
      const result = await storage.read('np_workspace_meta', WorkspaceMetadataSchema);
      if (result.status === 'valid') return { status: 'valid', metadata: result.value };
      if (result.status === 'invalid') {
        debugLog(createErrorRecord('WORKSPACE_INVALID_METADATA', { key: 'np_workspace_meta' }));
        return { status: 'invalid' };
      }
      return { status: 'missing' };
    },
    async writeMetadata(metadata) {
      await storage.write('np_workspace_meta', WorkspaceMetadataSchema, metadata);
      await storage.write('np_workspace_version', WorkspaceVersionRecordSchema, {
        committedVersion: metadata.committedVersion,
        updatedAt: metadata.updatedAt,
      });
    },
    async readVersion() {
      const result = await storage.read('np_workspace_version', WorkspaceVersionRecordSchema);
      if (result.status === 'valid') return result.value.committedVersion;
      if (result.status === 'invalid') {
        debugLog(createErrorRecord('WORKSPACE_INVALID_METADATA', { key: 'np_workspace_version' }));
      }
      return 0;
    },
    async writeVersion(committedVersion, updatedAt) {
      await storage.write('np_workspace_version', WorkspaceVersionRecordSchema, {
        committedVersion,
        updatedAt,
      });
    },
  };
}
