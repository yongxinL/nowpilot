import { describe, expect, it } from 'vitest';
import { checkGeneratedManifest, type GeneratedManifest } from './manifestChecks';

const VALID: GeneratedManifest = {
  manifest_version: 3,
  permissions: ['storage', 'sidePanel'],
  side_panel: { default_path: 'sidepanel.html' },
  action: { default_title: 'NowPilot' },
  icons: { '16': 'icon/16.png', '32': 'icon/32.png', '48': 'icon/48.png', '128': 'icon/128.png' },
};

describe('checkGeneratedManifest', () => {
  it('passes a manifest matching the Phase 01 contract', () => {
    expect(checkGeneratedManifest(VALID, { standaloneHtmlExists: true })).toEqual({
      ok: true,
      failures: [],
    });
  });

  it('fails when a forbidden permission is present', () => {
    const result = checkGeneratedManifest(
      { ...VALID, permissions: ['storage', 'sidePanel', 'tabs'] },
      { standaloneHtmlExists: true },
    );
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('tabs');
  });

  it('fails when side_panel default path is wrong', () => {
    const result = checkGeneratedManifest(
      { ...VALID, side_panel: { default_path: 'other.html' } },
      { standaloneHtmlExists: true },
    );
    expect(result.ok).toBe(false);
  });

  it('fails when content_scripts are declared', () => {
    const result = checkGeneratedManifest(
      { ...VALID, content_scripts: [{ matches: ['<all_urls>'] }] },
      { standaloneHtmlExists: true },
    );
    expect(result.ok).toBe(false);
  });

  it('fails when host permissions are declared', () => {
    expect(
      checkGeneratedManifest(
        { ...VALID, host_permissions: ['https://example.com/*'] },
        { standaloneHtmlExists: true },
      ).ok,
    ).toBe(false);
  });

  it('fails when standalone.html is missing', () => {
    expect(checkGeneratedManifest(VALID, { standaloneHtmlExists: false }).ok).toBe(false);
  });
});
