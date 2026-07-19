import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultPermissionService, permissionService } from '../../../../src/core/ai/tools/PermissionService';
import type { PermissionService } from '../../../../src/core/ai/tools/PermissionService';
import { ConfirmationLevel } from '../../../../src/core/ai/tools/PermissionService';

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

  describe('ConfirmationLevel (Phase 7.4)', () => {
    it('ConfirmationLevel enum has values AutoExecute="auto", ConfirmInline="inline", RequirePermission="require"', () => {
      expect(ConfirmationLevel.AutoExecute).toBe('auto');
      expect(ConfirmationLevel.ConfirmInline).toBe('inline');
      expect(ConfirmationLevel.RequirePermission).toBe('require');
    });

    it('getConfirmationLevel("summarize_page") returns ConfirmationLevel.AutoExecute', () => {
      expect(permissionService.getConfirmationLevel('summarize_page')).toBe(ConfirmationLevel.AutoExecute);
    });

    it('getConfirmationLevel("web_search") returns ConfirmationLevel.ConfirmInline', () => {
      expect(permissionService.getConfirmationLevel('web_search')).toBe(ConfirmationLevel.ConfirmInline);
    });

    it('getConfirmationLevel("send_message") returns ConfirmationLevel.RequirePermission', () => {
      expect(permissionService.getConfirmationLevel('send_message')).toBe(ConfirmationLevel.RequirePermission);
    });

    it('getConfirmationLevel("unknown_tool") returns ConfirmationLevel.RequirePermission (default-deny)', () => {
      expect(permissionService.getConfirmationLevel('unknown_tool')).toBe(ConfirmationLevel.RequirePermission);
    });

    it('DefaultPermissionService.getConfirmationLevel delegates to ConfirmationPolicy', () => {
      // Verify the singleton delegates correctly
      const svc = new DefaultPermissionService();
      expect(svc.getConfirmationLevel('summarize_page')).toBe(ConfirmationLevel.AutoExecute);
      expect(svc.getConfirmationLevel('web_search')).toBe(ConfirmationLevel.ConfirmInline);
      expect(svc.getConfirmationLevel('send_message')).toBe(ConfirmationLevel.RequirePermission);
    });

    it('canExecute() still works unchanged (backward compat)', async () => {
      expect(await permissionService.canExecute('echo', {})).toBe(false);
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
