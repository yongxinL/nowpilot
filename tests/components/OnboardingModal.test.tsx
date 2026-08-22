import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider, App as AntdApp } from 'antd';

// Mock the aiProvider module so we can control `testProviderConnection` from
// the test (D-03 / REQ-F19: Step 4 calls the real, error-surfacing
// testProviderConnection — we test this contract by injecting a controlled
// mock that returns the same shape).
vi.mock('../../src/services/aiProvider', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/services/aiProvider')>();
  return {
    ...mod,
    testProviderConnection: vi.fn(),
  };
});

// Import AFTER the mock so the mocked function reference is captured.
import { OnboardingModal } from '../../src/components/OnboardingModal';
import { testProviderConnection } from '../../src/services/aiProvider';

const mockedTest = testProviderConnection as ReturnType<typeof vi.fn>;

function renderWithAntd(ui: React.ReactElement) {
  // Wrapping with both ConfigProvider AND AntdApp matches the established
  // pattern in tests/core/theme/ThemeSync.test.tsx — AntdApp is required so
  // the component's `AntdApp.useApp()` message hook resolves to a real
  // function in the success path.
  return render(
    <ConfigProvider>
      <AntdApp>{ui}</AntdApp>
    </ConfigProvider>,
  );
}

describe('OnboardingModal (Plan 01-08 — D-01/D-02/D-03, REQ-F19)', () => {
  let onComplete: ReturnType<typeof vi.fn>;
  let onSkip: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onComplete = vi.fn();
    onSkip = vi.fn();
    mockedTest.mockReset();
  });

  // ---- Test 1: Step 1 renders correctly, no auto-advance timer ----
  it('Test 1: Step 1 renders "Meet NowPilot" + persona placeholder; no timer-driven auto-advance', async () => {
    vi.useFakeTimers();
    try {
      renderWithAntd(<OnboardingModal open onComplete={onComplete} onSkip={onSkip} />);

      // Heading + body copy must be present (verbatim per UI-SPEC).
      expect(screen.getByText('Meet NowPilot')).toBeTruthy();
      expect(screen.getByText(/Step 1 of 4/i)).toBeTruthy();

      // Advance fake timers well past any 10s window the old wizard used —
      // the new component must NOT have a step-driven timer.
      await vi.advanceTimersByTimeAsync(15_000);

      // Still on Step 1, neither callback fired.
      expect(screen.getByText('Meet NowPilot')).toBeTruthy();
      expect(screen.queryByText('Pick a provider')).toBeNull();
      expect(onComplete).not.toHaveBeenCalled();
      expect(onSkip).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  // ---- Test 2: Continue advances through Steps 2 + 3 explicitly ----
  it('Test 2: clicking Continue on Step 1 reaches Step 2; Continue on Step 2 reaches Step 3', () => {
    renderWithAntd(<OnboardingModal open onComplete={onComplete} onSkip={onSkip} />);

    // Step 1 -> Step 2: pick-provider view appears.
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(screen.getByText('Pick a provider')).toBeTruthy();

    // Step 2 -> Step 3: continue is allowed without selecting a provider
    // (provider has a sensible default), and key-entry view appears.
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(screen.getByText('Enter your API key')).toBeTruthy();

    // Neither callback fired yet — completion only happens via the
    // successful Step-4 connection test or explicit Skip.
    expect(onComplete).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });

  // ---- Test 3: Step 3 Continue is disabled with empty apiKey ----
  it('Test 3: Step 3 Continue is disabled while apiKey is empty; enabled after typing', () => {
    renderWithAntd(<OnboardingModal open onComplete={onComplete} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole('button', { name: /Continue/i })); // 1 -> 2
    fireEvent.click(screen.getByRole('button', { name: /Continue/i })); // 2 -> 3

    // The key-entry Continue button must exist but be disabled while empty.
    const allContinues = screen.getAllByRole('button', { name: /Continue/i });
    // Two Continue buttons can exist (e.g. the Step-3 Continue). At least
    // one of them must be disabled.
    const anyDisabled = allContinues.some((btn) => btn.hasAttribute('disabled'));
    expect(anyDisabled).toBe(true);

    // Type a key and re-query — Continue must become enabled.
    const keyInput = screen.getByPlaceholderText(/api key/i) as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'sk-test-123' } });

    const allContinues2 = screen.getAllByRole('button', { name: /Continue/i });
    const stillAnyDisabled = allContinues2.some((btn) => btn.hasAttribute('disabled'));
    expect(stillAnyDisabled).toBe(false);
  });

  // ---- Test 4: Step 4 failure path — error surfaces, modal stays open, Edit key returns to Step 3 ----
  it('Test 4: Step 4 "Connect Provider" with mocked {ok:false} surfaces error, modal stays open, "Edit key" returns to Step 3 with key preserved', async () => {
    // Use mockResolvedValue (persistent) so the second call after
    // Edit key -> Step 4 -> Connect Provider still returns the same
    // shape; mockResolvedValueOnce would be consumed on the first call
    // and leave the retry path returning undefined.
    mockedTest.mockResolvedValue({
      ok: false,
      error: 'HTTP 401: Incorrect API key provided',
    });

    renderWithAntd(<OnboardingModal open onComplete={onComplete} onSkip={onSkip} />);

    // Walk forward to Step 4.
    fireEvent.click(screen.getByRole('button', { name: /Continue/i })); // 1 -> 2
    fireEvent.click(screen.getByRole('button', { name: /Continue/i })); // 2 -> 3
    const keyInput = screen.getByPlaceholderText(/api key/i) as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'sk-test-123' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i })); // 3 -> 4

    // Step 4 title visible; click "Connect Provider".
    expect(screen.getByText('Validate connection')).toBeTruthy();
    const connectBtn = screen.getByRole('button', { name: /Connect Provider/i });
    fireEvent.click(connectBtn);

    // Wait for the async testProviderConnection to resolve + the error to
    // render. The error string must come from the mock — proving the modal
    // surfaces the real testProviderConnection result (not a fallback).
    await waitFor(() => {
      expect(
        screen.getByTestId('onboarding-error-text').textContent,
      ).toMatch(/Connection failed: HTTP 401: Incorrect API key provided/i);
    });

    // Modal must NOT have called onComplete on failure.
    expect(onComplete).not.toHaveBeenCalled();

    // "Edit key" ghost button must exist and return to Step 3 with the
    // previously-entered key still populated.
    const editKey = screen.getByRole('button', { name: /Edit key/i });
    fireEvent.click(editKey);

    expect(screen.getByText('Enter your API key')).toBeTruthy();
    const keyInputAfter = screen.getByPlaceholderText(/api key/i) as HTMLInputElement;
    expect(keyInputAfter.value).toBe('sk-test-123');

    // T-01-22: the raw apiKey must NOT have leaked to console / debugLog.
    // (The error string contains the provider message, not the key — that's
    // a guarantee of testProviderConnection itself, but this test confirms
    // the modal doesn't accidentally echo or log it either.)
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Walk forward again to retrigger the failure path.
    fireEvent.click(screen.getByRole('button', { name: /Continue/i })); // 3 -> 4
    fireEvent.click(screen.getByRole('button', { name: /Connect Provider/i }));
    await waitFor(() => {
      expect(
        screen.getByTestId('onboarding-error-text').textContent,
      ).toMatch(/Connection failed: HTTP 401: Incorrect API key provided/i);
    });
    for (const call of [...consoleSpy.mock.calls, ...consoleErrorSpy.mock.calls]) {
      for (const arg of call) {
        const s = typeof arg === 'string' ? arg : JSON.stringify(arg);
        expect(s).not.toContain('sk-test-123');
      }
    }
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // ---- Test 5: Step 4 success path — Connected, onComplete called ----
  it('Test 5: Step 4 "Connect Provider" with mocked {ok:true, models} shows "Connected" and enables the onComplete CTA', async () => {
    mockedTest.mockResolvedValueOnce({
      ok: true,
      models: [{ id: 'gpt-4o', name: 'gpt-4o', enabled: true }],
    });

    renderWithAntd(<OnboardingModal open onComplete={onComplete} onSkip={onSkip} />);

    // Walk forward to Step 4.
    fireEvent.click(screen.getByRole('button', { name: /Continue/i })); // 1 -> 2
    fireEvent.click(screen.getByRole('button', { name: /Continue/i })); // 2 -> 3
    const keyInput = screen.getByPlaceholderText(/api key/i) as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'sk-good-key' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i })); // 3 -> 4

    fireEvent.click(screen.getByRole('button', { name: /Connect Provider/i }));

    await waitFor(() => {
      expect(screen.getByText(/^Connected$/i)).toBeTruthy();
    });

    // A primary CTA must appear that calls onComplete when clicked.
    const finishBtn = screen.getByRole('button', { name: /(Finish|Get started|Continue|Done)/i });
    fireEvent.click(finishBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  // ---- Test 6: Skip for now calls onSkip, NOT onComplete ----
  it('Test 6: "Skip for now" calls onSkip, NOT onComplete', () => {
    renderWithAntd(<OnboardingModal open onComplete={onComplete} onSkip={onSkip} />);

    const skipBtn = screen.getByRole('button', { name: /Skip for now/i });
    fireEvent.click(skipBtn);

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  // ---- Test 7: Step 4 "Testing connection…" is shown while pending (loading state) ----
  it('Test 7: Step 4 shows "Testing connection…" while testProviderConnection is in flight; button is disabled', async () => {
    // Never-resolving promise — we only care about the in-flight UI state.
    let resolveFn!: (v: { ok: true; models: { id: string; name: string; enabled: boolean }[] }) => void;
    mockedTest.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );

    renderWithAntd(<OnboardingModal open onComplete={onComplete} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole('button', { name: /Continue/i })); // 1 -> 2
    fireEvent.click(screen.getByRole('button', { name: /Continue/i })); // 2 -> 3
    const keyInput = screen.getByPlaceholderText(/api key/i) as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: 'sk-test' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i })); // 3 -> 4

    const connectBtn = screen.getByRole('button', { name: /Connect Provider/i });
    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(screen.getByText(/Testing connection/i)).toBeTruthy();
    });

    // Once the test is in flight, the original Connect button has been
    // replaced by a "Testing connection…" button that must be disabled
    // (no double-submit). Look up the current in-flight button instead
    // of asserting on the stale `connectBtn` reference (it has been
    // unmounted by the conditional render).
    const inFlightBtn = screen.getByRole('button', { name: /Testing connection/i });
    expect(inFlightBtn.hasAttribute('disabled')).toBe(true);

    // Resolve to keep the test from leaking a pending promise.
    resolveFn({ ok: true, models: [{ id: 'm', name: 'm', enabled: true }] });
    await waitFor(() => {
      expect(screen.getByText(/^Connected$/i)).toBeTruthy();
    });
  });

  // ---- Test 8: open={false} does not render modal content ----
  it('Test 8: open={false} renders no modal content', () => {
    renderWithAntd(<OnboardingModal open={false} onComplete={onComplete} onSkip={onSkip} />);

    expect(screen.queryByText('Meet NowPilot')).toBeNull();
    expect(screen.queryByText(/Step 1 of 4/i)).toBeNull();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
