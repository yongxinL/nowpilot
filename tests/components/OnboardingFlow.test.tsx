import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import * as BroadcastBus from '../../src/core/runtime/BroadcastBus';
import {
  OnboardingFlow,
  type OnboardingFlowProps,
} from '../../src/components/onboarding/OnboardingFlow';
import { PROVIDER_IDS } from '../../src/types';
import { createFixtureValidationPort } from '../../src/services/fixtures/providerValidationFixtures';
import type {
  ProviderValidationPort,
  ProviderValidationResult,
} from '../../src/services/ports/providerValidationPort';
import { clearLogs, getRecentLogs } from '../../src/core/log/debugLog';
import { useExtensionStore } from '../../src/store/useExtensionStore';
import { useWorkspaceStore } from '../../src/core/workspace/WorkspaceStore';
import { t } from '../../src/core/i18n/strings';

/**
 * Shared onboarding flow suite (plan `01-09`, Task 2 — D-05 / D-06 / D-08).
 *
 * The flow is one surface-independent module: these cases drive it exactly as
 * a surface would (typed port + navigation adapters), and never through a
 * Chrome API — one case renders it with `chrome` undefined.
 *
 * Key hygiene (T-1-42) is asserted with a synthetic sentinel: the value must be
 * absent from storage, serialised store state, published broadcasts, the log
 * buffer, the rendered document and every accessible name or tooltip.
 */

const SENTINEL = 'sk-secret-DO-NOT-LEAK-XYZ123';

function renderWithAntd(ui: React.ReactElement) {
  return render(<ConfigProvider>{ui}</ConfigProvider>);
}

function fixedPort(result: ProviderValidationResult): ProviderValidationPort {
  return { validate: vi.fn(async () => result) };
}

/** A port whose promise the test settles by hand (in-flight states). */
function pendingPort() {
  let settle: (result: ProviderValidationResult) => void = () => {};
  const validate = vi.fn(
    () =>
      new Promise<ProviderValidationResult>((resolve) => {
        settle = resolve;
      }),
  );
  return {
    port: { validate } as ProviderValidationPort,
    validate,
    settle: (result: ProviderValidationResult) => settle(result),
  };
}

function baseProps(overrides: Partial<OnboardingFlowProps> = {}): OnboardingFlowProps {
  return {
    open: true,
    surface: 'sidepanel',
    validationPort: fixedPort({ ok: true }),
    onComplete: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  };
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stepIndicator = () => screen.getByTestId('onboarding-step-indicator').textContent;
const credentialInput = () =>
  screen.getByTestId('onboarding-credential-input') as HTMLInputElement;

/** Open the provider `Select` and pick the option carrying `label`. */
async function selectProvider(label: string) {
  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByTitle(label));
}

/** Walk the flow to `step` the way a user would, filling each step's control. */
async function advanceTo(step: 2 | 3 | 4, credential: string = SENTINEL) {
  if (step >= 2) fireEvent.click(screen.getByTestId('onboarding-continue'));
  if (step >= 3) {
    await selectProvider(t('provider.name.openai'));
    fireEvent.click(screen.getByTestId('onboarding-continue'));
  }
  if (step >= 4) {
    fireEvent.change(credentialInput(), { target: { value: credential } });
    fireEvent.click(screen.getByTestId('onboarding-continue'));
  }
}

beforeEach(() => {
  clearLogs();
  (globalThis as any).__chromeStorageMap?.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('OnboardingFlow — the four steps', () => {
  it('renders step 1 of 4 with the pinned title and the step indicator', () => {
    renderWithAntd(<OnboardingFlow {...baseProps()} />);

    expect(screen.getByText(t('onboarding.step1Title'))).toBeTruthy();
    expect(stepIndicator()).toBe(t('onboarding.stepIndicator').replace('{n}', '1'));
    expect(screen.getByTestId('onboarding-persona-card').getAttribute('data-np-backing')).toBe(
      'fixture',
    );
  });

  it('advances through steps 2, 3 and 4 in order with the updated indicator', async () => {
    renderWithAntd(<OnboardingFlow {...baseProps()} />);

    await advanceTo(2);
    expect(screen.getByText(t('onboarding.step2Title'))).toBeTruthy();
    expect(stepIndicator()).toBe(t('onboarding.stepIndicator').replace('{n}', '2'));

    await selectProvider(t('provider.name.anthropic'));
    fireEvent.click(screen.getByTestId('onboarding-continue'));

    expect(screen.getByText(t('onboarding.step3Title'))).toBeTruthy();
    expect(stepIndicator()).toBe(t('onboarding.stepIndicator').replace('{n}', '3'));

    fireEvent.change(credentialInput(), { target: { value: SENTINEL } });
    fireEvent.click(screen.getByTestId('onboarding-continue'));

    expect(screen.getByText(t('onboarding.step4Title'))).toBeTruthy();
    expect(stepIndicator()).toBe(t('onboarding.stepIndicator').replace('{n}', '4'));
  });

  it('retreats to the previous step with the entered value preserved', async () => {
    renderWithAntd(<OnboardingFlow {...baseProps()} />);

    await advanceTo(3);
    fireEvent.change(credentialInput(), { target: { value: SENTINEL } });
    fireEvent.click(screen.getByTestId('onboarding-back'));

    expect(screen.getByText(t('onboarding.step2Title'))).toBeTruthy();
    fireEvent.click(screen.getByTestId('onboarding-continue'));

    expect(credentialInput().value).toBe(SENTINEL);
  });

  it('offers exactly the four canonical provider identifiers with the pinned placeholder', async () => {
    const onComplete = vi.fn();
    renderWithAntd(<OnboardingFlow {...baseProps({ onComplete })} />);

    await advanceTo(2);

    // The pinned placeholder is rendered — never a framework locale default.
    expect(screen.getByText(t('onboarding.providerPlaceholder'))).toBeTruthy();
    expect(screen.queryByText('Please select')).toBeNull();

    fireEvent.mouseDown(screen.getByRole('combobox'));
    const labels = PROVIDER_IDS.map((id) => t(`provider.name.${id}`));
    const options = await screen.findAllByTitle(
      new RegExp(`^(${labels.map(escapeRegExp).join('|')})$`),
    );
    expect(options.map((option) => option.getAttribute('title'))).toEqual(labels);

    // The option VALUES are the canonical identifiers: selecting the fourth and
    // completing the flow records `ollama`, and no prototype spelling is present.
    fireEvent.click(screen.getByTitle(labels[3]));
    fireEvent.click(screen.getByTestId('onboarding-continue'));
    fireEvent.change(credentialInput(), { target: { value: SENTINEL } });
    fireEvent.click(screen.getByTestId('onboarding-continue'));
    fireEvent.click(screen.getByTestId('onboarding-validate'));
    await screen.findByTestId('onboarding-success');
    fireEvent.click(screen.getByTestId('onboarding-finish'));

    expect(onComplete).toHaveBeenCalledWith({ persona: null, providerId: 'ollama' });
    expect(document.body.textContent ?? '').not.toContain('claude');
  });

  it('renders the validation step with the fixture-reason deferred marker', async () => {
    renderWithAntd(<OnboardingFlow {...baseProps()} />);

    await advanceTo(4);

    const marker = screen.getByTestId('onboarding-fixture-notice');
    expect(marker.getAttribute('data-np-backing')).toBe('fixture');
    expect(marker.textContent).toContain(t('deferred.reasonFixture'));
  });
});

describe('OnboardingFlow — key entry and reveal', () => {
  it('renders a masked input whose reveal toggle changes only the presentation', async () => {
    renderWithAntd(<OnboardingFlow {...baseProps()} />);
    await advanceTo(3);

    fireEvent.change(credentialInput(), { target: { value: SENTINEL } });
    expect(credentialInput().type).toBe('password');

    const reveal = screen.getByTestId('onboarding-credential-reveal');
    expect(reveal.getAttribute('aria-label')).toBe(t('onboarding.showKey'));

    fireEvent.click(reveal);

    // Presentation only: the input type flips, the value is untouched.
    expect(credentialInput().type).toBe('text');
    expect(credentialInput().value).toBe(SENTINEL);
    // ...and the accessible name follows the pinned hide key.
    expect(screen.getByTestId('onboarding-credential-reveal').getAttribute('aria-label')).toBe(
      t('onboarding.hideKey'),
    );
  });

  it('keeps the placeholder free of any example key shape', async () => {
    renderWithAntd(<OnboardingFlow {...baseProps()} />);
    await advanceTo(3);

    expect(credentialInput().getAttribute('placeholder')).toBe(t('onboarding.keyPlaceholder'));
    expect(credentialInput().getAttribute('placeholder')).not.toMatch(/sk-|api[-_ ]?key:/i);
  });
});

describe('OnboardingFlow — validation state machine', () => {
  it('enters the loading state with the pinned in-flight label and a disabled action', async () => {
    const { port } = pendingPort();
    renderWithAntd(<OnboardingFlow {...baseProps({ validationPort: port })} />);
    await advanceTo(4);

    fireEvent.click(screen.getByTestId('onboarding-validate'));

    const inFlight = await screen.findByTestId('onboarding-validate');
    expect(inFlight.textContent).toContain(t('onboarding.testing'));
    expect((inFlight as HTMLButtonElement).disabled).toBe(true);
    expect(inFlight.className).toContain('ant-btn-loading');
  });

  it('never advances on a timer: a pending validation stays in flight', async () => {
    const { port } = pendingPort();
    renderWithAntd(<OnboardingFlow {...baseProps({ validationPort: port })} />);
    await advanceTo(4);

    vi.useFakeTimers();
    fireEvent.click(screen.getByTestId('onboarding-validate'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(screen.getByText(t('onboarding.testing'))).toBeTruthy();
    expect(screen.queryByText(t('onboarding.connected'))).toBeNull();
  });

  it('renders the pinned success label and the finish action for the success fixture', async () => {
    renderWithAntd(<OnboardingFlow {...baseProps()} />);
    await advanceTo(4);

    fireEvent.click(screen.getByTestId('onboarding-validate'));

    expect(await screen.findByTestId('onboarding-success')).toBeTruthy();
    expect(screen.getByText(t('onboarding.connected'))).toBeTruthy();
    expect(screen.getByTestId('onboarding-finish')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-failure')).toBeNull();
  });

  it('renders the pinned failure copy plus Retry and Edit key for every canonical code', async () => {
    const cases = [
      ['invalid-credential', 'PROVIDER_AUTH'],
      ['provider-unavailable', 'PROVIDER_5XX'],
      ['network-unavailable', 'NETWORK'],
      ['unexpected-failure', 'PROVIDER_CHECK_FAILED'],
    ] as const;

    for (const [selector, code] of cases) {
      const { unmount } = renderWithAntd(
        <OnboardingFlow
          {...baseProps({ validationPort: createFixtureValidationPort(selector) })}
        />,
      );
      await advanceTo(4);
      fireEvent.click(screen.getByTestId('onboarding-validate'));

      const failure = await screen.findByTestId('onboarding-failure');
      expect(failure.textContent, code).toBe(
        t('onboarding.failed').replace('{error}', t(`provider.error.${code}`)),
      );
      expect(screen.getByTestId('onboarding-retry')).toBeTruthy();
      expect(screen.getByTestId('onboarding-edit-key')).toBeTruthy();
      // The key value is never echoed by the failure path.
      expect(failure.textContent).not.toContain(SENTINEL);

      unmount();
    }
  });

  it('returns to idle with the action restored when the fixture cancels', async () => {
    renderWithAntd(
      <OnboardingFlow
        {...baseProps({ validationPort: createFixtureValidationPort('cancelled') })}
      />,
    );
    await advanceTo(4);

    fireEvent.click(screen.getByTestId('onboarding-validate'));

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-validate').textContent).toContain(
        t('onboarding.validate'),
      );
    });
    // Neither an error nor a success claim.
    expect(screen.queryByTestId('onboarding-failure')).toBeNull();
    expect(screen.queryByTestId('onboarding-success')).toBeNull();
  });

  it('returns to the idle state with the primary action restored after Edit key', async () => {
    renderWithAntd(
      <OnboardingFlow
        {...baseProps({ validationPort: createFixtureValidationPort('invalid-credential') })}
      />,
    );
    await advanceTo(4);
    fireEvent.click(screen.getByTestId('onboarding-validate'));
    await screen.findByTestId('onboarding-failure');

    fireEvent.click(screen.getByTestId('onboarding-edit-key'));

    expect(screen.getByText(t('onboarding.step3Title'))).toBeTruthy();
    expect(credentialInput().value).toBe(SENTINEL);
  });
});

describe('OnboardingFlow — key hygiene (T-1-42)', () => {
  it('leaks the sentinel nowhere: storage, store state, broadcasts, logs, DOM, accessible names', async () => {
    const publishSpy = vi.spyOn(BroadcastBus, 'publish');
    renderWithAntd(
      <OnboardingFlow
        {...baseProps({ validationPort: createFixtureValidationPort('invalid-credential') })}
      />,
    );
    await advanceTo(4);
    fireEvent.click(screen.getByTestId('onboarding-validate'));
    await screen.findByTestId('onboarding-failure');

    // 1. chrome.storage (local and sync share the mock map) and localStorage.
    const storageMap = (globalThis as any).__chromeStorageMap as Map<string, unknown>;
    for (const [key, value] of storageMap) {
      expect(`${key}:${String(value)}`, `chrome.storage ${key}`).not.toContain(SENTINEL);
    }
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) as string;
      expect(String(localStorage.getItem(key)), `localStorage ${key}`).not.toContain(SENTINEL);
    }

    // 2. Serialised store state.
    expect(JSON.stringify(useExtensionStore.getState())).not.toContain(SENTINEL);
    expect(JSON.stringify(useWorkspaceStore.getState())).not.toContain(SENTINEL);

    // 3. Published broadcasts.
    expect(publishSpy).not.toHaveBeenCalled();

    // 4. The log buffer.
    expect(JSON.stringify(getRecentLogs(200))).not.toContain(SENTINEL);

    // 5. The rendered document.
    expect(document.body.textContent ?? '').not.toContain(SENTINEL);

    // 6. Every accessible name and tooltip.
    const attributes = ['aria-label', 'title', 'placeholder', 'alt', 'aria-description'];
    for (const element of Array.from(
      document.querySelectorAll('[aria-label], [title], [placeholder], [alt], [aria-description]'),
    )) {
      for (const attribute of attributes) {
        const value = element.getAttribute(attribute);
        if (value !== null) {
          expect(value, `${attribute} on <${element.tagName.toLowerCase()}>`).not.toContain(
            SENTINEL,
          );
        }
      }
    }
  });

  it('never calls fetch: the fixture port performs no network request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderWithAntd(<OnboardingFlow {...baseProps()} />);
    await advanceTo(4);

    fireEvent.click(screen.getByTestId('onboarding-validate'));
    await screen.findByTestId('onboarding-success');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not update state after unmount when a validation resolves late', async () => {
    const { port, settle } = pendingPort();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderWithAntd(
      <OnboardingFlow {...baseProps({ validationPort: port })} />,
    );
    await advanceTo(4);
    fireEvent.click(screen.getByTestId('onboarding-validate'));

    unmount();
    await act(async () => {
      settle({ ok: true });
      await Promise.resolve();
    });

    const unmountedUpdates = consoleError.mock.calls.filter((call) =>
      /unmounted|state update/i.test(String(call[0])),
    );
    expect(unmountedUpdates).toEqual([]);
    consoleError.mockRestore();
  });
});

describe('OnboardingFlow — surface independence', () => {
  it('renders with chrome undefined and calls no Chrome API', () => {
    const originalChrome = (globalThis as any).chrome;
    (globalThis as any).chrome = undefined;

    try {
      expect(() => renderWithAntd(<OnboardingFlow {...baseProps()} />)).not.toThrow();
      expect(stepIndicator()).toBe(t('onboarding.stepIndicator').replace('{n}', '1'));
    } finally {
      (globalThis as any).chrome = originalChrome;
    }
  });

  it('renders the switch-to-full-setup affordance only when the surface supplies it', () => {
    const onSwitchToFullSetup = vi.fn();
    const { unmount } = renderWithAntd(
      <OnboardingFlow {...baseProps({ surface: 'standalone' })} />,
    );
    expect(screen.queryByTestId('onboarding-switch-full-setup')).toBeNull();
    unmount();

    renderWithAntd(
      <OnboardingFlow {...baseProps({ surface: 'sidepanel', onSwitchToFullSetup })} />,
    );
    fireEvent.click(screen.getByTestId('onboarding-switch-full-setup'));
    expect(onSwitchToFullSetup).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingFlow — exits', () => {
  it('does not dismiss on Escape and keeps the mask unclosable', () => {
    renderWithAntd(<OnboardingFlow {...baseProps()} />);

    fireEvent.keyDown(document.body, { key: 'Escape', keyCode: 27 });
    const mask = document.querySelector('.ant-modal-wrap') as HTMLElement;
    if (mask) fireEvent.click(mask);

    expect(screen.getByText(t('onboarding.step1Title'))).toBeTruthy();
    expect(screen.getByTestId('onboarding-skip')).toBeTruthy();
  });

  it('exits only through the separate Skip and Finish callbacks', async () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    const { unmount } = renderWithAntd(
      <OnboardingFlow {...baseProps({ onComplete, onSkip })} />,
    );

    fireEvent.click(screen.getByTestId('onboarding-skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    unmount();

    renderWithAntd(<OnboardingFlow {...baseProps({ onComplete, onSkip })} />);
    await advanceTo(4);
    fireEvent.click(screen.getByTestId('onboarding-validate'));
    await screen.findByTestId('onboarding-success');
    fireEvent.click(screen.getByTestId('onboarding-finish'));

    expect(onComplete).toHaveBeenCalledWith({ persona: null, providerId: 'openai' });
    // The explicit Skip click is the only onSkip call: Finish never routes there.
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingFlow — focus management', () => {
  it('lands focus on the step’s first control on every step change', async () => {
    renderWithAntd(<OnboardingFlow {...baseProps()} />);

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('onboarding-continue'));
    });

    fireEvent.click(screen.getByTestId('onboarding-continue'));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('combobox'));
    });

    await selectProvider(t('provider.name.openai'));
    fireEvent.click(screen.getByTestId('onboarding-continue'));
    await waitFor(() => {
      expect(document.activeElement).toBe(credentialInput());
    });

    fireEvent.change(credentialInput(), { target: { value: SENTINEL } });
    fireEvent.click(screen.getByTestId('onboarding-continue'));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('onboarding-validate'));
    });
  });
});
