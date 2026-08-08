// tests/entrypoints/standalone.test.tsx — 01-09 mount smoke test for the
// standalone entry root (Appendix F.3). Imports the REAL entrypoint module and
// renders its exported createStandaloneApp() tree in jsdom; the module-scope
// createRoot mount is inert (no #root element in jsdom). Asserts:
//   (a) the tree mounts without throwing,
//   (b) exactly one provider renders (single `.ant-app` — XProvider extends
//       antd's provider, Appendix F/§5.5),
//   (c) the StandaloneShell header (STR.standalone.openTitle) renders,
//   (d) the lifted mod+k capture opens the Cmd+K palette (controlled picker),
//   (e) [01-10] the module-scope workspace lifecycle (WR-03) fires at import:
//       np_workspace hydrates, activeSurface becomes 'standalone', version bumps,
//   (f) [01-10] addon settings hydrate from np_addon_settings on a FRESH module
//       load (WR-02): a seeded storage value hydrates the fresh store via the
//       module-scope init().
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createStandaloneApp } from '@/entrypoints/standalone/main';
import { STR } from '@/core/i18n/strings';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';

describe('standalone entrypoint mount', () => {
  it('mounts the tree without throwing and renders the shell header', async () => {
    const { container } = render(createStandaloneApp());
    expect(await screen.findByText(STR.standalone.openTitle)).toBeTruthy();
    expect(container.querySelectorAll('.ant-app').length).toBe(1);
  });

  it('renders exactly one provider wrapper (single XProvider, Appendix F)', async () => {
    const { container } = render(createStandaloneApp());
    await screen.findByText(STR.standalone.openTitle);
    expect(container.querySelectorAll('.ant-app').length).toBe(1);
  });

  it('opens the Cmd+K palette via the lifted global mod+k capture (controlled picker)', async () => {
    render(createStandaloneApp());
    await screen.findByText(STR.standalone.openTitle);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(await screen.findByPlaceholderText(STR.cmdk.placeholder)).toBeTruthy();
  });

  it('workspace lifecycle fires at module scope (01-10 WR-03)', async () => {
    render(createStandaloneApp());
    await waitFor(() => expect(useWorkspaceStore.getState().isReady).toBe(true));
    await waitFor(() => {
      expect(useWorkspaceStore.getState().workspace.activeSurface).toBe('standalone');
      expect(useWorkspaceStore.getState().workspace.version).toBeGreaterThanOrEqual(1);
    });
  });

  it('addon settings hydrate from np_addon_settings on a fresh module load (01-10 WR-02)', async () => {
    // Seed storage as if 'Configure later' was clicked on a prior load.
    await chrome.storage.local.set({ np_addon_settings: { onboarding: { done: true } } });
    // Fresh module instances so the entrypoint module-scope init() reads the
    // seeded storage into the fresh store (the static top-of-file import ran
    // the wiring against EMPTY storage at file load).
    vi.resetModules();
    await import('@/entrypoints/standalone/main');
    const { useAddonSettingsStore: FreshAddon } = await import(
      '@/core/registry/AddonSettingsStore'
    );
    await waitFor(() => {
      const onboarding = FreshAddon.getState().settings.onboarding as
        | { done?: boolean }
        | undefined;
      expect(onboarding?.done).toBe(true);
    });
  });
});
