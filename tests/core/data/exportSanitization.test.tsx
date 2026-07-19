import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import { ImportExportSection } from '../../../src/components/options/ImportExportSection';

// ---------------------------------------------------------------------------
// Mock JSZip to capture export data instead of actually creating ZIP files.
// vi.mock is hoisted above imports (ESM), so the capture variable must
// come from vi.hoisted.
// ---------------------------------------------------------------------------
const capturedZipContent = vi.hoisted(() => ({ jsonContent: null as string | null }));

vi.mock('jszip', () => {
  function MockJSZip() {
    // noop — instance methods defined on prototype
  }
  MockJSZip.prototype.file = vi.fn((_name: string, content: string) => {
    capturedZipContent.jsonContent = content;
  });
  MockJSZip.prototype.generateAsync = vi.fn(() =>
    Promise.resolve(new Blob(['mock-zip-bytes'], { type: 'application/zip' })),
  );
  return { default: MockJSZip };
});

// ---------------------------------------------------------------------------
// Helper to render ImportExportSection under antd providers.
// ---------------------------------------------------------------------------
function setup(jsx: React.ReactElement) {
  return render(
    <ConfigProvider>
      <AntApp>{jsx}</AntApp>
    </ConfigProvider>,
  );
}

describe('exportSanitization — credential exclusion from export output (D-18)', () => {
  beforeEach(() => {
    capturedZipContent.jsonContent = null;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  // Helper: set chrome.storage.local to return credential-rich fixtures
  function stubStorageWithCredentials() {
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys?: string | string[] | Record<string, unknown> | null) => {
      // Provide credential data when specific keys are requested
      const keysArr = Array.isArray(keys) ? keys : (keys ? [keys as string] : []);

      const result: Record<string, unknown> = {};

      if (keysArr.some((k) => typeof k === 'string' && (k as string).includes('np_provider_configs'))) {
        result.np_provider_configs = {
          openai: { apiKey: 'sk-test-key-abc123' },
          anthropic: { apiKey: 'sk-ant-test-key-xyz789' },
        };
      }
      if (keysArr.some((k) => typeof k === 'string' && (k as string).includes('np_feature_flags'))) {
        result.np_feature_flags = { experimentalExport: true };
      }
      if (keysArr.some((k) => typeof k === 'string' && (k as string).includes('np_mcp_servers'))) {
        result.np_mcp_servers = [];
      }
      if (keysArr.some((k) => typeof k === 'string' && (k as string).includes('np_slash_commands'))) {
        result.np_slash_commands = [];
      }
      if (keysArr.some((k) => typeof k === 'string' && (k as string).includes('np_workspace'))) {
        // Include a session-like value to test JSESSIONID/g_ck redaction
        result.np_workspace = {
          workspaceId: 'test-ws-1',
          sessionInfo: 'JSESSIONID=abc123def; sysparm_ck=someSysparmCkValue; g_ck=testGckValue',
        };
      }
      if (keysArr.some((k) => typeof k === 'string' && (k as string).includes('np_prompt_templates'))) {
        result.np_prompt_templates = [];
      }
      if (keysArr.length === 0 || keysArr.includes('np_workspace' as any)) {
        // Also include for the `get(['np_workspace', 'np_prompt_templates'])` array call
        result.np_workspace = result.np_workspace ?? {
          workspaceId: 'test-ws-1',
          sessionInfo: 'JSESSIONID=abc123def; sysparm_ck=someSysparmCkValue; g_ck=testGckValue',
        };
        result.np_prompt_templates = result.np_prompt_templates ?? [];
      }

      return result;
    });
  }

  it('Test 1: export with all scopes — output contains no np_providers key values', async () => {
    stubStorageWithCredentials();

    const { container } = setup(<ImportExportSection />);

    // Find the Export button and click it
    const exportBtn = container.querySelector('button.ant-btn-primary');
    expect(exportBtn).toBeTruthy();
    fireEvent.click(exportBtn!);

    // Wait for export to complete (capturedZipContent populated)
    await waitFor(
      () => {
        expect(capturedZipContent.jsonContent).not.toBeNull();
      },
      { timeout: 5000 },
    );

    const parsed = JSON.parse(capturedZipContent.jsonContent!);
    const serialized = JSON.stringify(parsed);

    // Credential exclusion: no API key values should appear in export
    expect(serialized).not.toContain('sk-test-key-abc123');
    expect(serialized).not.toContain('sk-ant-test-key-xyz789');
    expect(serialized).not.toContain('sk-');
  });

  it('Test 2: export contains no JSESSIONID= string anywhere in output', async () => {
    stubStorageWithCredentials();

    const { container } = setup(<ImportExportSection />);

    const exportBtn = container.querySelector('button.ant-btn-primary');
    expect(exportBtn).toBeTruthy();
    fireEvent.click(exportBtn!);

    await waitFor(
      () => {
        expect(capturedZipContent.jsonContent).not.toBeNull();
      },
      { timeout: 5000 },
    );

    const serialized = capturedZipContent.jsonContent!;
    expect(serialized).not.toMatch(/JSESSIONID=/i);
  });

  it('Test 3: export contains no sysparm_ck= string anywhere in output', async () => {
    stubStorageWithCredentials();

    const { container } = setup(<ImportExportSection />);

    const exportBtn = container.querySelector('button.ant-btn-primary');
    expect(exportBtn).toBeTruthy();
    fireEvent.click(exportBtn!);

    await waitFor(
      () => {
        expect(capturedZipContent.jsonContent).not.toBeNull();
      },
      { timeout: 5000 },
    );

    const serialized = capturedZipContent.jsonContent!;
    expect(serialized).not.toMatch(/sysparm_ck[=:]/i);
  });

  it('Test 4: export contains no g_ck value in output', async () => {
    stubStorageWithCredentials();

    const { container } = setup(<ImportExportSection />);

    const exportBtn = container.querySelector('button.ant-btn-primary');
    expect(exportBtn).toBeTruthy();
    fireEvent.click(exportBtn!);

    await waitFor(
      () => {
        expect(capturedZipContent.jsonContent).not.toBeNull();
      },
      { timeout: 5000 },
    );

    const serialized = capturedZipContent.jsonContent!;
    expect(serialized).not.toMatch(/g_ck[=:]/i);
  });

  it('Test 5: export manifest includes operationId field', async () => {
    stubStorageWithCredentials();

    // Initially — mock WriteJournal so we can verify it was called if/when it is wired.
    // In RED phase handleExport does NOT wrap in WriteJournal, so operationId will NOT
    // be present. The test will fail.  In GREEN phase handleExport adds WriteJournal
    // wrapping and the manifest includes operationId -> test passes.

    const { container } = setup(<ImportExportSection />);

    const exportBtn = container.querySelector('button.ant-btn-primary');
    expect(exportBtn).toBeTruthy();
    fireEvent.click(exportBtn!);

    await waitFor(
      () => {
        expect(capturedZipContent.jsonContent).not.toBeNull();
      },
      { timeout: 5000 },
    );

    const parsed = JSON.parse(capturedZipContent.jsonContent!);
    expect(parsed).toHaveProperty('operationId');
    expect(typeof parsed.operationId).toBe('string');
    expect(parsed.operationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('Test 6: export is wrapped in WriteJournal export-data operation', async () => {
    stubStorageWithCredentials();

    const { container } = setup(<ImportExportSection />);

    const exportBtn = container.querySelector('button.ant-btn-primary');
    expect(exportBtn).toBeTruthy();
    fireEvent.click(exportBtn!);

    // Wait for export to complete (button should not be loading)
    await waitFor(
      () => {
        // Export button should not have loading attribute after completion
        expect(exportBtn!.querySelector('.ant-btn-loading-icon')).toBeFalsy();
      },
      { timeout: 5000 },
    );

    // Check that WriteJournal.begin was called with 'export-data'
    // NOTE: This assertion will fail in RED because handleExport doesn't use WriteJournal.
    // In GREEN, the integration is added and this test passes.
    const writeJournalModule = await import('../../../src/core/storage/WriteJournal');
    expect(writeJournalModule.writeJournal.begin).toHaveBeenCalledWith(
      'export-data',
      expect.objectContaining({ manifest: expect.any(String) }),
      expect.arrayContaining([
        expect.objectContaining({ name: expect.any(String) }),
      ]),
    );
  });
});
