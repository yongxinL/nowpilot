// tests/entrypoints/sidepanel.test.tsx — 01-09 mount smoke test for the side
// panel entry root (Appendix F.3). Imports the REAL entrypoint module and
// renders its exported createSidePanelApp() tree in jsdom; the module-scope
// createRoot mount is inert (no #root element in jsdom). Asserts:
//   (a) the tree mounts without throwing,
//   (b) exactly one provider renders — the XProvider extends antd's
//       ConfigProvider (Appendix F/§5.5) and AntdApp renders one `.ant-app`
//       (a second provider or a double AntdApp would render twice),
//   (c) the D-07 onboarding gate decides the initial screen (onboarding pending
//       → Onboarding; provider present → the enabled shell header),
//   (d) the lifted mod+k capture opens the Cmd+K palette (controlled picker),
//   (e) [01-10] the module-scope workspace lifecycle (WR-03) fires at import:
//       np_workspace hydrates, activeSurface becomes 'sidepanel', version bumps,
//   (f) [01-10] onboarding.done round-trips through np_addon_settings on a
//       FRESH module load (WR-02, D-06 persistence): a seeded storage value
//       hydrates the fresh store via the module-scope init() and the router
//       renders the shell, not the OnboardingModal.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSidePanelApp } from '@/entrypoints/sidepanel/main';
import { getProviderRegistry } from '@/core/ai/ProviderRegistry';
import { STR } from '@/core/i18n/strings';
import { useAddonSettingsStore } from '@/core/registry/AddonSettingsStore';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';

beforeEach(() => {
  getProviderRegistry().clear();
  useAddonSettingsStore.setState({ settings: {} });
});

describe('sidepanel entrypoint mount', () => {
  it('mounts the tree without throwing (onboarding gate pending → Onboarding)', async () => {
    const { container } = render(createSidePanelApp());
    // ThemeStore.init (fired at module scope + effect guard) resolves against
    // fakeBrowser storage; the readiness gate renders null until then.
    expect(await screen.findByText(STR.onboarding.heading)).toBeTruthy();
    expect(container.querySelectorAll('.ant-app').length).toBe(1);
  });

  it('renders the enabled shell header once a provider is registered (D-07)', async () => {
    getProviderRegistry().registerActiveProvider('openai');
    render(createSidePanelApp());
    expect(await screen.findByText('NowPilot')).toBeTruthy();
    expect(screen.queryByText(STR.onboarding.heading)).toBeNull();
  });

  it('renders exactly one provider wrapper (single XProvider, Appendix F)', async () => {
    getProviderRegistry().registerActiveProvider('anthropic');
    const { container } = render(createSidePanelApp());
    await screen.findByText('NowPilot');
    // AntdApp renders one `.ant-app`; a nested/double provider tree would
    // produce a second antd App div (the XProvider itself renders no DOM).
    expect(container.querySelectorAll('.ant-app').length).toBe(1);
  });

  it('opens the Cmd+K palette via the lifted global mod+k capture (controlled picker)', async () => {
    getProviderRegistry().registerActiveProvider('gemini');
    render(createSidePanelApp());
    await screen.findByText('NowPilot');
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(await screen.findByPlaceholderText(STR.cmdk.placeholder)).toBeTruthy();
  });

  it('workspace lifecycle fires at module scope (01-10 WR-03)', async () => {
    render(createSidePanelApp());
    // The static import already executed the module-scope wiring against
    // (empty) storage; waitFor absorbs the async init().then(start) chain.
    await waitFor(() => expect(useWorkspaceStore.getState().isReady).toBe(true));
    await waitFor(() => {
      expect(useWorkspaceStore.getState().workspace.activeSurface).toBe('sidepanel');
      expect(useWorkspaceStore.getState().workspace.version).toBeGreaterThanOrEqual(1);
    });
  });

  it('onboarding round-trips through np_addon_settings on a fresh module load (01-10 WR-02)', async () => {
    // Seed storage as if the user clicked 'Configure later' on a prior load.
    await chrome.storage.local.set({ np_addon_settings: { onboarding: { done: true } } });
    // The static top-of-file import already ran the module-scope wiring against
    // EMPTY storage; resetModules + dynamic import re-evaluates the modules so
    // the fresh init() chain reads the seeded storage.
    vi.resetModules();
    const { createSidePanelApp: FreshApp } = await import('@/entrypoints/sidepanel/main');
    const { useAddonSettingsStore: FreshAddon } = await import(
      '@/core/registry/AddonSettingsStore'
    );
    await waitFor(() => {
      const onboarding = FreshAddon.getState().settings.onboarding as
        | { done?: boolean }
        | undefined;
      expect(onboarding?.done).toBe(true);
    });
    // D-06 gate: onboarding.done → the router renders the shell, not the modal.
    render(FreshApp());
    expect(await screen.findByText('NowPilot')).toBeTruthy();
    expect(screen.queryByText(STR.onboarding.heading)).toBeNull();
  });
});
