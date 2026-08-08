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
//   (d) the lifted mod+k capture opens the Cmd+K palette (controlled picker).
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSidePanelApp } from '@/entrypoints/sidepanel/main';
import { getProviderRegistry } from '@/core/ai/ProviderRegistry';
import { STR } from '@/core/i18n/strings';
import { useAddonSettingsStore } from '@/core/registry/AddonSettingsStore';

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
});
