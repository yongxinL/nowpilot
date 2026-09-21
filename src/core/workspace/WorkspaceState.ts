import { z } from 'zod';

/**
 * RED stub for Task 1 (01-07). The canonical implementation lands in the
 * GREEN commit; this exists only so the suite collects and fails on its own
 * assertions rather than on a module-load error.
 */
export const WORKSPACE_STATE_SCHEMA_VERSION = 0;

export type ActiveSurface = 'sidepanel' | 'standalone';

export interface TabContext {
  tabId: number;
  title: string;
  url: string;
  pinned: boolean;
}

export interface WorkspaceState {
  schemaVersion: number;
  workspaceId: string;
  conversationId: string | null;
  activeProvider: string | null;
  selectedModel: string | null;
  pinnedTabs: TabContext[];
  currentPageContext: null;
  selectedNotes: string[];
  activeAddonContext: null;
  activeSkillRun: null;
  activeSurface: ActiveSurface;
  openedStandaloneTabId: number | null;
  version: number;
  updatedAt: number;
}

export type WorkspaceStateParseErrorCode =
  | 'not_an_object'
  | 'unknown_field'
  | 'unsupported_schema_version'
  | 'invalid_shape';

export type WorkspaceStateParseResult =
  | { ok: true; value: WorkspaceState }
  | { ok: false; code: WorkspaceStateParseErrorCode };

export const workspaceStateSchema = z.object({}).strict();

export function createInitialWorkspaceState(): WorkspaceState {
  return {} as WorkspaceState;
}

export function parseWorkspaceState(_value: unknown): WorkspaceStateParseResult {
  return { ok: false, code: 'not_an_object' };
}

export function migrateWorkspaceState(_persisted: unknown, _version: number): WorkspaceState {
  return {} as WorkspaceState;
}

/** Referenced so the RED stub's unused zod import does not drift. */
export type WorkspaceStateSchema = typeof workspaceStateSchema;
