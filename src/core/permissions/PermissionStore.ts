import { debugLog } from '../utils/debugLog';

const PERMISSIONS_KEY = 'np_mcp_permissions';

export class PermissionStore {
  async getPermission(toolName: string): Promise<'allow-always' | 'deny' | null> {
    try {
      const result = await chrome.storage.local.get(PERMISSIONS_KEY);
      const permissions = (result[PERMISSIONS_KEY] ?? {}) as Record<string, 'allow-always' | 'deny'>;
      return permissions[toolName] ?? null;
    } catch (err) {
      debugLog('error', '[PermissionStore] getPermission failed', { error: err });
      return null;
    }
  }

  async setPermission(toolName: string, decision: 'allow-always' | 'deny'): Promise<void> {
    try {
      const result = await chrome.storage.local.get(PERMISSIONS_KEY);
      const permissions = (result[PERMISSIONS_KEY] ?? {}) as Record<string, 'allow-always' | 'deny'>;
      permissions[toolName] = decision;
      await chrome.storage.local.set({ [PERMISSIONS_KEY]: permissions });
    } catch (err) {
      debugLog('error', '[PermissionStore] setPermission failed', { error: err });
    }
  }

  async clearPermission(toolName: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(PERMISSIONS_KEY);
      const permissions = (result[PERMISSIONS_KEY] ?? {}) as Record<string, 'allow-always' | 'deny'>;
      delete permissions[toolName];
      await chrome.storage.local.set({ [PERMISSIONS_KEY]: permissions });
    } catch (err) {
      debugLog('error', '[PermissionStore] clearPermission failed', { error: err });
    }
  }
}

export const permissionStore = new PermissionStore();
