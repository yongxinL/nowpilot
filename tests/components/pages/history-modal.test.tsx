import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import { ChatHistoryModal } from '@/components/history/ChatHistoryModal';
import { format } from '@/core/i18n/strings';
import type { ChatSession } from '@/types';

/**
 * Chat-history overlay suite (plan `01-12`, Task 2) — the D-16
 * `fixture-preview` disposition for the preserved history modal (owning
 * roadmap phase 15).
 *
 * Sessions arrive from the caller as deterministic local fixtures; the suite
 * pins the region marker, the owning phase and the disabled later-phase export.
 */

const SESSIONS: ChatSession[] = [
  {
    id: 'fixture-session-1',
    title: 'Incident triage notes',
    preview: 'Checked the assignment group rules and the escalation path.',
    createdAt: 0,
    updatedAt: 0,
    isStarred: true,
    group: 'Today',
    messages: [{ id: 'm1', role: 'user', content: 'fixture message', timestamp: 0 }] as never,
  },
];

function renderModal() {
  const props = {
    onClose: vi.fn(),
    onSelectSession: vi.fn(),
    onToggleStar: vi.fn(),
    onDeleteSession: vi.fn(),
    onUpdateTitle: vi.fn(),
    onClearAll: vi.fn(),
    onStartExport: vi.fn(),
  };

  const result = render(
    <ConfigProvider>
      <App>
        <ChatHistoryModal
          open
          sessions={SESSIONS}
          activeSessionId="fixture-session-1"
          onClose={props.onClose}
          onSelectSession={props.onSelectSession}
          onToggleStar={props.onToggleStar}
          onDeleteSession={props.onDeleteSession}
          onUpdateTitle={props.onUpdateTitle}
          onClearAll={props.onClearAll}
          onStartExport={props.onStartExport}
        />
      </App>
    </ConfigProvider>,
  );

  return { ...result, props };
}

describe('ChatHistoryModal — fixture-preview (D-16)', () => {
  it('marks the overlay region fixture and never claims deferred at its root', () => {
    renderModal();

    const marked = screen.getByTestId('np-history-modal');
    expect(marked.getAttribute('data-np-backing')).toBe('fixture');
    expect(marked.getAttribute('data-np-backing')).not.toBe('deferred');
  });

  it('names the owning roadmap phase through the phase-body copy', () => {
    renderModal();

    expect(
      screen.getAllByText(new RegExp(format('deferred.phaseBody', { phase: 15 }))).length,
    ).toBeGreaterThan(0);
  });

  it('renders no skeleton for the fixture-backed overlay', () => {
    const { container } = renderModal();

    expect(container.querySelector('.ant-skeleton')).toBeNull();
  });

  it('disables the Export row and never invokes the later-phase export', () => {
    const { props } = renderModal();

    fireEvent.click(screen.getByTitle('More options'));

    const exportRow = screen.getByText('Export').closest('li') as HTMLElement | null;
    expect(exportRow).not.toBeNull();
    expect(exportRow?.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(screen.getByText('Export'));
    expect(props.onStartExport).not.toHaveBeenCalled();
  });

  it('keeps the populated and long-text states from the caller fixtures', () => {
    const { container } = renderModal();

    // A fixture session renders its list row (title + a caller-supplied
    // preview kept on the session record), so the overlay is populated rather
    // than a perpetual empty shell.
    expect(screen.getByText('Incident triage notes')).toBeTruthy();
    expect((container.textContent ?? '').length).toBeGreaterThan(100);
    expect(SESSIONS[0].preview.length).toBeGreaterThan(0);
  });

  it('renders no fabricated health signal', () => {
    const { container } = renderModal();

    expect(container.textContent).not.toMatch(/Connected|Healthy|valid key/i);
  });
});
