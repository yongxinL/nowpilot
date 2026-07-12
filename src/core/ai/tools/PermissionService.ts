import { debugLog } from '../../utils/debugLog';

export interface PermissionService {
  canExecute(toolName: string, toolInput: Record<string, unknown>): Promise<boolean>;
}

export class DefaultPermissionService implements PermissionService {
  async canExecute(toolName: string, _toolInput: Record<string, unknown>): Promise<boolean> {
    // Default-deny per D-13: all tools require explicit permission.
    // Phase 3: always returns false. Phase 7: replaced by UI dialog implementation.
    debugLog('info', `[PermissionService] Permission denied for tool: ${toolName}`);
    return false;
  }
}

export const permissionService = new DefaultPermissionService();
