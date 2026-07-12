import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultPermissionService, permissionService } from '../../../../src/core/ai/tools/PermissionService';
import type { PermissionService } from '../../../../src/core/ai/tools/PermissionService';

describe('PermissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DefaultPermissionService', () => {
    it('canExecute returns false for unknown tools (default-deny)', async () => {
      const result = await permissionService.canExecute('echo', {});
      expect(result).toBe(false);
    });

    it('canExecute returns false for any tool name (default-deny)', async () => {
      const result = await permissionService.canExecute('some-dangerous-tool', {});
      expect(result).toBe(false);
    });

    it('canExecute accepts any tool input shape', async () => {
      const result = await permissionService.canExecute('echo', { text: 'hello', extra: 42 });
      expect(result).toBe(false);
    });
  });

  describe('Custom implementation extending DefaultPermissionService', () => {
    it('can override canExecute to return true for specific tools', async () => {
      class TestPermissionService extends DefaultPermissionService implements PermissionService {
        override async canExecute(toolName: string, _toolInput: Record<string, unknown>): Promise<boolean> {
          if (toolName === 'echo') return true;
          return super.canExecute(toolName, _toolInput);
        }
      }

      const svc = new TestPermissionService();
      expect(await svc.canExecute('echo', {})).toBe(true);
      expect(await svc.canExecute('dangerous', {})).toBe(false);
    });
  });
});
