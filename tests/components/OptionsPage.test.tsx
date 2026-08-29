import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { OptionsPage } from '../../src/components/options/OptionsPage';
import { ProviderRegistry, __test__ as registryTest } from '../../src/core/ai/ProviderRegistry';
import { __test__ as adapterTest } from '../../src/core/theme/chromeStorageAdapter';
import { flushPendingWrites } from '../../src/core/theme/chromeStorageAdapter';
import { useUserPreferencesStore } from '../../src/core/ai/UserPreferences';
import { useExtensionStore } from '../../src/store/useExtensionStore';

/**
 * OptionsPage contract tests (plan 03-07, Task 3) — D-50 endpoint overrides
 * and D-54 tier assignment:
 *   - Saving a provider proxy writes np_endpoint_overrides (chrome.storage.local)
 *     — assertable via the mock storage map (tests/setup.ts); the runtime
 *     endpoint = np_endpoint_overrides[providerId] ?? §10.6 default (merged at
 *     ProviderRegistry hydrate, 03-05).
 *   - Tier-assignment fields write through to np_preferences (fastModel /
 *     balancedModel present in the mock storage map after Save) — D-54.
 *   - The pre-fill/discovery path persists NOTHING on its own (D-54a) — the
 *     store actions fire only from the Save handler (grep-assertable in src).
 *
 * Rendered with the real component inside an antd App provider; the
 * auto-discovery effect (D-52) runs against a mocked fetch so the tier
 * selectors populate deterministically.
 */

const storageMap = (globalThis as any).__chromeStorageMap as Map<string, string>;

/** Enabled openai provider on disk — the registry hydrates from this. */
const seedDisk = {
  providers: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      isConfigured: true,
      enabled: true,
      proxyUrl: '',
      models: [{ id: 'gpt-4o-mini', name: 'gpt-4o-mini', enabled: true }],
    },
  },
};

/** Canned model-discovery response (D-52): openai GET /models → data[].id. */
function mockModelDiscovery(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }] }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderOptions() {
  return render(
    React.createElement(
      AntdApp,
      null,
      React.createElement(OptionsPage),
    ),
  );
}

beforeEach(async () => {
  (globalThis as any).__resetIndexedDB();
  storageMap.clear();
  adapterTest.resetPendingState();
  registryTest.reset();
  useUserPreferencesStore.setState({
    fastModel: undefined,
    balancedModel: undefined,
    personaOverrides: undefined,
  });
  useExtensionStore.setState({});
  storageMap.set('np_providers', JSON.stringify(seedDisk));
  await ProviderRegistry.hydrate();
  await flushPendingWrites();

  // jsdom does not implement the pseudoElt overload of getComputedStyle, but
  // the antd Select dropdown's scrollbar measurement calls it — drop the
  // second argument (setup.ts's ResizeObserver stub must NOT be unstubbed).
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((elt: Element) => originalGetComputedStyle(elt)) as typeof window.getComputedStyle;
});

describe('OptionsPage — D-50 endpoint overrides + D-54 tier assignment (03-07)', () => {
  it('saving a provider proxy writes np_endpoint_overrides (openai) into chrome.storage.local', async () => {
    mockModelDiscovery();
    renderOptions();

    // Open the OpenAI provider modal — the grid cell containing the 'OpenAI'
    // label also carries its Set up / Edit button.
    const openaiCell = screen.getByText('OpenAI').closest('div')?.parentElement as HTMLElement;
    fireEvent.click(within(openaiCell).getByText('Set up'));
    // WR-06: the modal pre-fills the §10.6 canonical endpoint — the legacy
    // dev-proxy default (http://localhost:12380/v1) is never pre-filled.
    const proxyInput = await screen.findByPlaceholderText('https://api.openai.com/v1');
    fireEvent.change(proxyInput, { target: { value: 'https://my-proxy.example.com/v1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Provider' }));

    // D-50: the write lands in the mock storage map after the explicit flush.
    await waitFor(() => {
      const raw = storageMap.get('np_endpoint_overrides');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string) as Record<string, string>;
      expect(parsed.openai).toBe('https://my-proxy.example.com/v1');
    });
  });

  it('WR-06: saving with the untouched default proxy persists NO endpoint override', async () => {
    mockModelDiscovery();
    renderOptions();

    const openaiCell = screen.getByText('OpenAI').closest('div')?.parentElement as HTMLElement;
    // "Set up" (unconfigured) or the icon-only "edit" (previously saved) —
    // both open the modal.
    fireEvent.click(within(openaiCell).getByRole('button', { name: /Set up|edit/i }));
    // Leave the pre-filled default (https://api.openai.com/v1) untouched and save.
    fireEvent.click(screen.getByRole('button', { name: 'Save Provider' }));

    // No override written — the runtime keeps the §10.6 default.
    await waitFor(() => {
      const raw = storageMap.get('np_endpoint_overrides');
      if (raw) {
        const parsed = JSON.parse(raw as string) as Record<string, string>;
        expect(parsed.openai).toBeUndefined();
      } else {
        expect(raw).toBeUndefined();
      }
    });
  });

  it('toggling a provider to enabled in Options lets "Discover models" find it (regression)', async () => {
    // Seed disk with the provider DISABLED — the registry hydrates with
    // enabled:false. This mirrors the user-reported flow where the operator
    // configures a key, toggles the Switch, then clicks Discover.
    storageMap.set(
      'np_providers',
      JSON.stringify({
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            isConfigured: true,
            enabled: false,
            apiKey: 'sk-test',
            proxyUrl: '',
            models: [],
          },
        },
      }),
    );
    // The Zustand store was reset to DEFAULT_CONFIG in beforeEach — DEFAULT_CONFIG
    // has openai.isConfigured=false so the Switch would NOT render. Seed the
    // in-memory config to match the disk shape so the Switch shows up.
    useExtensionStore.setState((s) => ({
      ...s,
      config: {
        ...s.config,
        providers: {
          ...s.config.providers,
          openai: {
            id: 'openai',
            name: 'OpenAI',
            isConfigured: true,
            enabled: false,
            apiKey: 'sk-test',
            useCustomProxy: false,
            proxyUrl: '',
            models: [],
          },
        },
      },
    }));
    registryTest.reset();
    await ProviderRegistry.hydrate();
    // Confirm the bug's preconditions: the registry reports the provider as
    // NOT enabled before the toggle.
    expect(ProviderRegistry.getEnabled()).toEqual([]);

    const fetchMock = mockModelDiscovery();
    renderOptions();

    // Find the OpenAI Switch (antd Switch renders a <button role="switch">)
    // inside the OpenAI provider row. The Switch's onChange drives
    // handleToggleProviderEnabled, which must now also patch the registry.
    // The row container has BOTH the "OpenAI" label (left half) AND the
    // Switch (right half) as descendants — walk up from the label until the
    // container that also holds a role="switch" element.
    const openaiLabel = screen.getByText('OpenAI');
    let openaiRow: HTMLElement | null = openaiLabel as unknown as HTMLElement;
    while (openaiRow && openaiRow.querySelector('[role="switch"]') === null) {
      openaiRow = openaiRow.parentElement;
    }
    expect(openaiRow).not.toBeNull();
    const openaiSwitch = within(openaiRow as HTMLElement).getByRole('switch');
    fireEvent.click(openaiSwitch);

    // Post-toggle: the registry reflects enabled=true even though np_providers
    // was NOT re-written (the Switch handler writes np_store, not np_providers).
    expect(ProviderRegistry.getEnabled().map((p) => p.providerId)).toEqual(['openai']);

    // Click "Discover models" — the auto-discovery effect on mount already
    // ran (with no providers), so click again to exercise the explicit
    // refreshModels path.
    fireEvent.click(screen.getByRole('button', { name: /Discover models/i }));

    // Discovery reaches the network for the enabled provider and a success
    // toast surfaces — NOT the "No enabled providers" info toast.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.anything(),
      );
    });
  });

  it('tier discovery offers only ENABLED models — a disabled provider model never appears in the tier selectors', async () => {
    // Seed disk: openai enabled with three models, the third DISABLED.
    storageMap.set(
      'np_providers',
      JSON.stringify({
        providers: {
          openai: {
            id: 'openai',
            name: 'OpenAI',
            isConfigured: true,
            enabled: true,
            apiKey: 'sk-test',
            useCustomProxy: false,
            proxyUrl: '',
            models: [
              { id: 'gpt-4o-mini', name: 'gpt-4o-mini', enabled: true },
              { id: 'gpt-4o', name: 'gpt-4o', enabled: true },
              { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo', enabled: false },
            ],
          },
        },
      }),
    );
    useExtensionStore.setState((s) => ({
      ...s,
      config: {
        ...s.config,
        providers: {
          ...s.config.providers,
          openai: {
            ...s.config.providers.openai,
            id: 'openai',
            name: 'OpenAI',
            isConfigured: true,
            enabled: true,
            apiKey: 'sk-test',
            useCustomProxy: false,
            proxyUrl: '',
            models: [
              { id: 'gpt-4o-mini', name: 'gpt-4o-mini', enabled: true },
              { id: 'gpt-4o', name: 'gpt-4o', enabled: true },
              { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo', enabled: false },
            ],
          },
        },
      },
    }));
    // Discovery returns ALL three — the DISABLED one must still be filtered out.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }, { id: 'gpt-3.5-turbo' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    registryTest.reset();
    await ProviderRegistry.hydrate();

    renderOptions();

    // The D-52 pre-fill suggestion shows the first ENABLED model.
    await waitFor(() => expect(screen.getByText(/gpt-4o-mini/)).toBeTruthy());
    // The disabled model never surfaces as a tier suggestion.
    expect(screen.queryByText(/gpt-3.5-turbo/)).toBeNull();
  });

  it('saving tier assignments writes fastModel/balancedModel through to np_preferences', async () => {
    mockModelDiscovery();
    const { container } = renderOptions();

    // The auto-discovery effect (D-52) populates the tier selectors with the
    // mocked model list — nothing is selected or persisted by it (D-54a).
    await waitFor(() => expect(screen.getByText('Save tier assignment')).toBeTruthy());

    // Find the Fast-tier and Balanced-tier Selects by their placeholders.
    const fastSelect = screen.getByText('Assign a fast-tier model').closest('.ant-select') as HTMLElement;
    const balancedSelect = screen.getByText('Assign a balanced-tier model').closest('.ant-select') as HTMLElement;
    expect(fastSelect).toBeTruthy();
    expect(balancedSelect).toBeTruthy();

    // Open the Fast tier dropdown and pick gpt-4o-mini (antd v6 Select DOM:
    // the clickable surface is .ant-select-content).
    fireEvent.mouseDown(fastSelect.querySelector('.ant-select-content') as Element);
    const fastOption = await screen.findByTitle('gpt-4o-mini');
    fireEvent.click(fastOption);

    // Open the Balanced tier dropdown and pick gpt-4o. The first dropdown's
    // options linger in the antd portal after closing — click the LAST match
    // (the just-opened dropdown appends its options last).
    fireEvent.mouseDown(balancedSelect.querySelector('.ant-select-content') as Element);
    const balancedOptions = await screen.findAllByTitle('gpt-4o');
    fireEvent.click(balancedOptions[balancedOptions.length - 1]);

    fireEvent.click(screen.getByRole('button', { name: 'Save tier assignment' }));

    // D-54 write-through: np_preferences carries the assigned values.
    await waitFor(async () => {
      await flushPendingWrites();
      const raw = storageMap.get('np_preferences');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string) as { state?: { fastModel?: string; balancedModel?: string } };
      expect(parsed.state?.fastModel).toBe('gpt-4o-mini');
      expect(parsed.state?.balancedModel).toBe('gpt-4o');
    });
  });
});