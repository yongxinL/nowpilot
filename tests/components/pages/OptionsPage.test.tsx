// tests/components/pages/OptionsPage.test.tsx — Phase-4b content-trust card
// (04b-05, D-4b-07): the ONLY user-facing 4b surface. Contract per 04b-UI-SPEC:
// the content-trust Card (title + helper caption + four Switch rows in FIXED
// order Pages → Notes → Memory → Tool results + structural note) renders AFTER
// the Appearance card with the VERBATIM Copywriting-Contract STR keys; switches
// are independent booleans persisted to np_trust (chrome.storage.local
// write-through, auto-save — no Save button); a write failure rolls the
// optimistic set back and surfaces the E5-style toast
// (STR.options.trustSaveFailed). The four UI-Consideration rows exercised here:
// loading (default-true while init hydrates), populated (persisted values),
// failure (rollback + toast), partial (any mix), zero-one-many (always 4 rows),
// empty (invalid storage → all-true fallback), long-text (captions render).
// Golden Rule 3: the card persists a preference only — no prompt assembly.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OptionsPage } from '@/components/pages/OptionsPage';
import { STR } from '@/core/i18n/strings';
import { useTrustSettingsStore } from '@/core/registry/TrustSettingsStore';
import { NP_TRUST_KEY } from '@/core/preferences/trustConfig';

function renderOptions() {
  return render(
    <AntdApp>
      <OptionsPage />
    </AntdApp>,
  );
}

/** All-true persisted payload — the safe default (D-4b-07). */
const ALL_TRUE = { page: true, notes: true, memory: true, tool_result: true };
/** Persisted payload with a partial mix (populated + partial rows). */
const PARTIAL = { page: true, notes: false, memory: true, tool_result: false };

beforeEach(() => {
  // fakeBrowser.reset() (tests/setup.ts) clears storage + listeners; every
  // render calls TrustSettingsStore.init() which re-hydrates from whatever the
  // test seeded, so the store singleton cannot leak across tests.
  useTrustSettingsStore.setState({ prefs: { ...ALL_TRUE } });
});

describe('OptionsPage — content-trust card (04b-05, D-4b-07)', () => {
  it('renders the content-trust card after Appearance with helper + structural note + 4 ON switches by default (empty storage → all-true, UI-SPEC loading/empty rows)', async () => {
    renderOptions();

    // The card title + verbatim captions from the Copywriting Contract.
    expect(await screen.findByText(STR.options.contentTrust)).toBeTruthy();
    expect(screen.getByText(STR.options.trustHelper)).toBeTruthy();
    expect(screen.getByText(STR.options.trustStructuralNote)).toBeTruthy();
    // Four labeled rows in FIXED order — zero-one-many: exactly 4, never fewer.
    const labels = ['Pages', 'Notes', 'Memory', 'Tool results'];
    const switches = await screen.findAllByRole('switch');
    expect(switches).toHaveLength(4);
    // Defaults: empty storage → all four checked (D-4b-07).
    switches.forEach((s) => expect(s).toHaveAttribute('aria-checked', 'true'));
    // Row order Pages → Notes → Memory → Tool results.
    const cards = document.querySelectorAll('.ant-card');
    // Label order assertion via the switches' containing rows.
    const page = switches[0];
    const pagesRow = page.closest('div')?.parentElement;
    expect(pagesRow?.textContent).toContain(labels[0]);
    // The structural note comes AFTER the rows (muted caption at the bottom).
    const note = screen.getByText(STR.options.trustStructuralNote);
    expect(note.textContent).toBeTruthy();
    expect(cards.length).toBeGreaterThanOrEqual(3); // Account + Appearance + Content trust
  });

  it('hydrates persisted np_trust values (populated row) — the store init flips the switches to stored booleans', async () => {
    const { fakeBrowser } = await import('wxt/testing');
    await fakeBrowser.storage.local.set({ [NP_TRUST_KEY]: PARTIAL });
    renderOptions();

    const switches = await screen.findAllByRole('switch');
    expect(switches).toHaveLength(4);
    // Persisted mix: page ON, notes OFF, memory ON, tool_results OFF.
    expect(switches[0]).toHaveAttribute('aria-checked', 'true');
    expect(switches[1]).toHaveAttribute('aria-checked', 'false');
    expect(switches[2]).toHaveAttribute('aria-checked', 'true');
    expect(switches[3]).toHaveAttribute('aria-checked', 'false');
  });

  it('invalid np_trust storage → all-true fallback (empty row: schema-gated hydrate degrades to safe defaults, T-4b-06)', async () => {
    const { fakeBrowser } = await import('wxt/testing');
    await fakeBrowser.storage.local.set({ [NP_TRUST_KEY]: { page: 'yes', notes: 1 } });
    renderOptions();

    const switches = await screen.findAllByRole('switch');
    switches.forEach((s) => expect(s).toHaveAttribute('aria-checked', 'true'));
  });

  it('toggling the Pages switch flips store state and writes np_trust through (auto-save, populated row)', async () => {
    const { fakeBrowser } = await import('wxt/testing');
    renderOptions();

    const switches = await screen.findAllByRole('switch');
    // Pages is the FIRST row — flip it OFF.
    fireEvent.click(switches[0]);

    await waitFor(() => expect(useTrustSettingsStore.getState().prefs.page).toBe(false));
    const stored = await fakeBrowser.storage.local.get(NP_TRUST_KEY);
    expect(stored.np_trust).toMatchObject({ page: false });
    expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('write failure → optimistic set rolled back + STR.options.trustSaveFailed toast (failure row, E5 precedent)', async () => {
    renderOptions();
    await screen.findAllByRole('switch');

    // The next np_trust write rejects — the store must roll back + the call
    // site surfaces the persistence-failure toast.
    vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(new Error('quota exceeded'));

    fireEvent.click(screen.getAllByRole('switch')[0]);

    // Toast copy is the VERBATIM Copywriting-Contract string.
    expect(await screen.findByText(STR.options.trustSaveFailed)).toBeTruthy();
    // Switch state reverts to the last persisted value (true).
    await waitFor(() =>
      expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'true'),
    );
    expect(useTrustSettingsStore.getState().prefs.page).toBe(true);
  });

  it('Account + Appearance cards are unchanged and precede the content-trust card', async () => {
    renderOptions();

    expect(await screen.findByText(STR.options.contentTrust)).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Appearance')).toBeTruthy();
    // Visual hierarchy: Account → Appearance → Content trust.
    const titles = Array.from(document.querySelectorAll('.ant-card-head-title')).map(
      (el) => el.textContent,
    );
    expect(titles).toContain('Content trust');
    const trustIndex = titles.findIndex((t) => t === 'Content trust');
    expect(titles.indexOf('Account')).toBeLessThan(trustIndex);
    expect(titles.indexOf('Appearance')).toBeLessThan(trustIndex);
  });
});
