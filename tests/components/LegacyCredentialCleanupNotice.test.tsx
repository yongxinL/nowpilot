import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LegacyCredentialCleanupNotice } from '../../src/components/common/LegacyCredentialCleanupNotice';
import {
  ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STORAGE_KEY,
} from '../../src/core/onboarding/onboardingStateStore';
import { t } from '../../src/core/i18n/strings';

/**
 * The D-07 neutral notice suite (plan `01-10`, Task 3).
 *
 * Three properties are pinned:
 *   1. the notice renders the pinned neutral copy and the pinned `Dismiss`
 *      label, and nothing else — no count, no field name, no part of a value;
 *   2. `Dismiss` is the only exit (no close button, no Escape), and dismissing
 *      records the shown-state on the existing onboarding record with no second
 *      storage key;
 *   3. once the record says the notice was shown, the component renders nothing
 *      — the notice cannot be shown twice.
 */

const SOURCE_PATH = join(
  process.cwd(),
  'src',
  'components',
  'common',
  'LegacyCredentialCleanupNotice.tsx',
);

const storageMap = () => (globalThis as any).__chromeStorageMap as Map<string, unknown>;

const pinnedCopy = () => t('provider.credentialsCleared');
const pinnedDismiss = () => t('provider.credentialsClearedDismiss');

function renderNotice() {
  return render(
    <ConfigProvider>
      <LegacyCredentialCleanupNotice />
    </ConfigProvider>,
  );
}

/**
 * Let the component's read settle, proving the effect actually ran.
 *
 * `any` here is intentional: `chrome.storage.local.get` is overloaded, so
 * vitest's `MockInstance` cannot be named without repeating the whole overload
 * list (the retired provider-connection suite used the same `any` for its
 * `fetch` spy before plan `01-11` deleted it).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function settleRead(getSpy: any): Promise<void> {
  await waitFor(() => expect(getSpy).toHaveBeenCalled());
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function storedRecord(): Record<string, unknown> | undefined {
  return storageMap().get(ONBOARDING_STORAGE_KEY) as Record<string, unknown> | undefined;
}

beforeEach(() => {
  storageMap().clear();
  vi.restoreAllMocks();
});

describe('LegacyCredentialCleanupNotice — the pinned neutral notice', () => {
  it('presents the pinned copy and the pinned dismiss label, and nothing else', async () => {
    renderNotice();

    await waitFor(() => expect(screen.getByText(pinnedCopy())).toBeTruthy());
    const dismiss = screen.getByRole('button', { name: pinnedDismiss() });
    expect(dismiss).toBeTruthy();

    // The pinned values are the UI-SPEC's: a neutral sentence and `Dismiss`.
    expect(pinnedCopy()).toBe(
      'Provider credentials must be configured again after secure credential storage is available.',
    );
    expect(pinnedDismiss()).toBe('Dismiss');

    // Nothing else is disclosed: the rendered surface carries the neutral
    // sentence and the label — no count, no field name, no found/not-found.
    const text = document.body.textContent ?? '';
    expect(text).toContain(pinnedCopy());
    for (const token of ['apiKey', 'token', 'accessToken', 'openAiKey', 'geminiKey', 'found']) {
      expect(text, `the notice must not disclose ${token}`).not.toContain(token);
    }
  });

  it('offers Dismiss as the only exit — no close button and Escape does not dismiss', async () => {
    renderNotice();
    await waitFor(() => expect(screen.getByText(pinnedCopy())).toBeTruthy());

    expect(document.querySelector('.ant-modal-close')).toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText(pinnedCopy())).toBeTruthy();
    // The flag is untouched: the notice is still un-shown.
    expect(storedRecord()).toBeUndefined();
  });

  it('records the shown-state on the existing onboarding record when dismissed', async () => {
    const { unmount } = renderNotice();
    await waitFor(() => expect(screen.getByText(pinnedCopy())).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: pinnedDismiss() }));

    await waitFor(() => expect(storedRecord()?.legacyCleanupNoticeShown).toBe(true));
    // One key, one record: no second storage key and no second flag.
    expect(Array.from(storageMap().keys())).toEqual([ONBOARDING_STORAGE_KEY]);

    // Shown once: a fresh mount finds the flag and renders nothing.
    unmount();
    const getSpy = vi.spyOn(chrome.storage.local, 'get');
    renderNotice();
    await settleRead(getSpy);
    expect(screen.queryByText(pinnedCopy())).toBeNull();
  });

  it('renders nothing when the record already says the notice was shown', async () => {
    storageMap().set(ONBOARDING_STORAGE_KEY, {
      uiComplete: true,
      persona: null,
      providerId: 'openai',
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      validationBacking: 'fixture',
      legacyCleanupNoticeShown: true,
    });

    const getSpy = vi.spyOn(chrome.storage.local, 'get');
    renderNotice();
    await settleRead(getSpy);

    expect(screen.queryByText(pinnedCopy())).toBeNull();
    expect(document.querySelector('[data-testid="legacy-credential-cleanup-notice"]')).toBeNull();
  });

  it('reads no cleanup result and names no credential field in its source', () => {
    const source = readFileSync(SOURCE_PATH, 'utf8');
    // Strip comments first so the provenance note cannot trip the scan.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    // The notice's only inputs are the pinned copy and one boolean.
    expect(code).not.toContain('legacyCredentialCleanup');
    for (const token of [
      'apiKey',
      'accessToken',
      'openAiKey',
      'geminiKey',
      'removedFields',
      "'secret'",
      'createHash',
    ]) {
      expect(code, `the notice must not reference ${token}`).not.toContain(token);
    }
    expect(code).toContain("t('provider.credentialsCleared')");
    expect(code).toContain("t('provider.credentialsClearedDismiss')");
    // The shown-state is a field on the existing record, never a new key.
    expect(code).toContain('legacyCleanupNoticeShown');
    expect(code).not.toContain('np_onboarding');
  });
});
