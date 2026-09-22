import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StandaloneWritePage } from '@/components/standalone/StandaloneWritePage';
import { StandaloneShell } from '@/components/standalone/StandaloneShell';
import { useHandoffComposerDraftStore } from '@/core/workspace/handoff/composerDraft';
import { format, t } from '@/core/i18n/strings';

/**
 * Write route suite (plan `01-12`, Task 2) — the D-16 `fixture-preview`
 * disposition for the preserved Write presentation (owning roadmap phase 17).
 *
 * The decisive assertions are the negative ones: the page must not simulate a
 * successful provider operation, must not invent a model or provider name, and
 * must not write fixture content anywhere persistent.
 */

const SOURCE = join(process.cwd(), 'src', 'components', 'standalone', 'StandaloneWritePage.tsx');

function renderWithAntd(ui: React.ReactElement) {
  return render(
    <ConfigProvider>
      <App>{ui}</App>
    </ConfigProvider>,
  );
}

describe('StandaloneWritePage — fixture-preview (D-16)', () => {
  it('marks the page root fixture and never claims deferred', () => {
    renderWithAntd(<StandaloneWritePage />);

    const root = screen.getByTestId('np-page-write');
    expect(root.getAttribute('data-np-backing')).toBe('fixture');
    expect(root.getAttribute('data-np-backing')).not.toBe('deferred');
  });

  it('names the owning roadmap phase through the phase-body copy', () => {
    renderWithAntd(<StandaloneWritePage />);

    expect(
      screen.getAllByText(new RegExp(format('deferred.phaseBody', { phase: 17 }))).length,
    ).toBeGreaterThan(0);
  });

  it('renders no skeleton and no fabricated generation state', () => {
    const { container } = renderWithAntd(<StandaloneWritePage />);

    expect(container.querySelector('.ant-skeleton')).toBeNull();
    expect(screen.queryByText('Generating...')).toBeNull();
    expect(screen.queryByText(/Generated and saved to history/)).toBeNull();
  });

  it('disables and marks every generation control instead of simulating one', () => {
    renderWithAntd(<StandaloneWritePage />);

    const submit = screen.getByText('Submit').closest('button') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.getAttribute('data-np-backing')).toBe('deferred');

    // The two output-toolbar controls are icon-only, so they are located by
    // their pinned test ids rather than by visible copy.
    for (const testId of ['np-write-regenerate', 'np-write-rerun']) {
      const control = screen.getByTestId(testId) as HTMLButtonElement;
      expect(control.disabled).toBe(true);
      expect(control.getAttribute('data-np-backing')).toBe('deferred');
    }
  });

  it('renders the read-only workflow display and never a model identifier', () => {
    const { container } = renderWithAntd(<StandaloneWritePage />);

    expect(screen.getByTestId('np-write-workflow-display').textContent).toContain('Auto');
    expect(container.textContent).not.toMatch(/gpt-|claude-|gemini-|llama|gemma/i);
  });

  it('shows the no-provider caption instead of an invented provider name', () => {
    renderWithAntd(<StandaloneWritePage />);

    expect(screen.getByText(t('chat.noProvider'))).toBeTruthy();
  });

  it('keeps fixture state out of every persistent path', () => {
    const source = readFileSync(SOURCE, 'utf8');

    expect(source).not.toContain('useExtensionStore');
    expect(source).not.toMatch(/setTimeout\s*\(/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toContain('saveTextAsNote');
  });

  it('keeps its deterministic output fixture for the populated state', () => {
    const { container } = renderWithAntd(<StandaloneWritePage />);

    expect((container.textContent ?? '').length).toBeGreaterThan(400);
  });
});

describe('StandaloneWritePage — handoff composer draft (WR-07 / D-13 / WR-09)', () => {
  const composerPlaceholder = 'Enter the topic you want to write about...';
  const HANDOFF_DRAFT = 'A draft typed in the Side Panel';

  /**
   * There is deliberately **no** `afterEach` slot reset in this suite (WR-09).
   * The slot is consume-once, so a draft left behind by one case can only be
   * observed as a failure of the next one — which is the invariant being
   * pinned, not test hygiene to work around.
   */

  it('renders the draft the workspace handoff carried into the composer', async () => {
    // The handoff resolves after the surface is mounted, so the draft arrives
    // as a store write — exactly the production sequence.
    renderWithAntd(<StandaloneWritePage />);

    await act(async () => {
      useHandoffComposerDraftStore.getState().setDraft(HANDOFF_DRAFT);
    });

    const composer = screen.getByPlaceholderText(composerPlaceholder);
    expect((composer as HTMLTextAreaElement).value).toBe(HANDOFF_DRAFT);
    // Consumed, not merely copied: the slot is empty once the composer has it.
    expect(useHandoffComposerDraftStore.getState().draft).toBe('');
  });

  it('seeds the composer when the draft is already in the slot at mount', async () => {
    useHandoffComposerDraftStore.getState().setDraft(HANDOFF_DRAFT);
    renderWithAntd(<StandaloneWritePage />);

    const composer = await screen.findByPlaceholderText(composerPlaceholder);
    expect((composer as HTMLTextAreaElement).value).toBe(HANDOFF_DRAFT);
    expect(useHandoffComposerDraftStore.getState().draft).toBe('');
  });

  it('leaves the composer content untouched when the handoff carried no draft', async () => {
    renderWithAntd(<StandaloneWritePage />);

    const composer = await screen.findByPlaceholderText(composerPlaceholder);
    expect((composer as HTMLTextAreaElement).value).not.toBe('');
    expect((composer as HTMLTextAreaElement).value).not.toBe(HANDOFF_DRAFT);
  });

  it('does not resurrect a consumed draft across a real Sider route round trip', async () => {
    // The production sequence: the Side Panel composer's draft rides the
    // handoff while the Standalone tab shows the Chat route, the user opens
    // Write (the draft appears), edits it, leaves the route and comes back.
    // The shell unmounts and remounts the page on every Sider switch, so a slot
    // that outlived its delivery would restore the handoff draft over the
    // user's own content. No `afterEach` reset is involved.
    renderWithAntd(<StandaloneShell onOpenOptions={vi.fn()} />);

    await act(async () => {
      useHandoffComposerDraftStore.getState().setDraft(HANDOFF_DRAFT);
    });

    fireEvent.click(screen.getByTestId('np-sider-item-Write'));
    const seeded = (await screen.findByPlaceholderText(composerPlaceholder)) as HTMLTextAreaElement;
    expect(seeded.value).toBe(HANDOFF_DRAFT);

    fireEvent.change(seeded, { target: { value: 'My own edit' } });
    expect(seeded.value).toBe('My own edit');

    fireEvent.click(screen.getByTestId('np-sider-item-Chat'));
    fireEvent.click(screen.getByTestId('np-sider-item-Write'));

    const revisited = (await screen.findByPlaceholderText(
      composerPlaceholder,
    )) as HTMLTextAreaElement;
    expect(revisited.value).not.toBe(HANDOFF_DRAFT);
    expect(revisited.value).toBe('This is wrong page');
  });
});
