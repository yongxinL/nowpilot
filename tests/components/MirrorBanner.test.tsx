import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { MirrorBanner } from '../../src/components/common/MirrorBanner';
import { t } from '../../src/core/i18n/strings';

/**
 * `MirrorBanner` suite (plan 01-07 for the shipped visual contract; plan 02-07
 * for the D-12 carry-forward: canonical copy and the growable bar).
 *
 * The banner is the single reporter of cross-surface writer state, so this
 * suite pins:
 *   1. the caption, the visible label and the accessible name all resolve from
 *      the canonical map — no inline user-visible literal survives;
 *   2. the shipped visual contract is intact (`role="status"`,
 *      `aria-live="polite"`, full width, `colorPrimaryBg`, hairline borders,
 *      12px) with `min-height: 32px` replacing the fixed height so the bar
 *      grows instead of clipping at 400 px;
 *   3. the action is a real keyboard-reachable control that calls back exactly
 *      once and never reloads the page;
 *   4. the banner renders no state-dependent text beyond the caption and the
 *      action — no dismiss control, no auto-hide, no success state.
 */

function renderWithAntd(ui: React.ReactElement) {
  return render(<ConfigProvider>{ui}</ConfigProvider>);
}

const banner = () => screen.getByTestId('mirror-banner');

describe('MirrorBanner (Plan 01-07 / 02-07 — D-05, D-12, REQ-F05)', () => {
  it('renders the canonical caption from the string map, not the retired literal', () => {
    renderWithAntd(<MirrorBanner onRefocus={vi.fn()} />);

    expect(screen.getByText(t('workspace.mirroringNotice'))).toBeTruthy();
    // The retired inline literal is gone from the render and from the source.
    expect(document.body.textContent ?? '').not.toContain('Switched to Standalone.');
    expect(t('workspace.mirroringNotice')).toBe(
      'Standalone view is now the primary surface for this workspace.',
    );
  });

  it('resolves the visible label and the accessible name from the map', () => {
    renderWithAntd(<MirrorBanner onRefocus={vi.fn()} />);

    // The visible label is the canonical `workspace.mirrorRefocus` value.
    expect(screen.getByText(t('workspace.mirrorRefocus'))).toBeTruthy();
    expect(t('workspace.mirrorRefocus')).toBe('Refocus here');

    // The accessible name is the canonical `workspace.mirrorRefocusA11y` value
    // — never the retired literal, which named a "chat mode" this banner does
    // not report.
    const action = screen.getByLabelText(t('workspace.mirrorRefocusA11y'));
    expect(action).toBeTruthy();
    expect(t('workspace.mirrorRefocusA11y')).toBe('Refocus here and return to primary mode');
    expect(action.getAttribute('aria-label')).not.toContain('chat mode');
  });

  it('keeps the status role, the polite live region and the shipped visual contract', () => {
    renderWithAntd(<MirrorBanner onRefocus={vi.fn()} />);

    const bar = banner();
    expect(bar.getAttribute('role')).toBe('status');
    expect(bar.getAttribute('aria-live')).toBe('polite');
    expect(bar.style.width).toBe('100%');
    expect(bar.style.background).toBeTruthy();
    expect(bar.style.borderTop).toMatch(/^1px solid /);
    expect(bar.style.borderBottom).toMatch(/^1px solid /);

    // 12px stays the floor for both the caption and the action.
    for (const text of [t('workspace.mirroringNotice'), t('workspace.mirrorRefocus')]) {
      const element = screen.getByText(text);
      expect(element.style.fontSize).toBe('12px');
    }
  });

  it('grows instead of clipping: min-height 32px and no fixed height', () => {
    renderWithAntd(<MirrorBanner onRefocus={vi.fn()} />);

    const bar = banner();
    expect(bar.style.minHeight).toBe('32px');
    // A fixed height would clamp the bar and clip the canonical caption at
    // 400 px — the one visual change Phase 2 makes (02-UI-SPEC § UI
    // Considerations).
    expect(bar.style.height).toBe('');
  });

  it('enforces the pinned overflow backstop: the action never wraps and the caption clamps to two lines', () => {
    renderWithAntd(<MirrorBanner onRefocus={vi.fn()} />);

    const action = screen.getByText(t('workspace.mirrorRefocus'));
    expect(action.style.flexShrink).toBe('0');
    expect(action.style.whiteSpace).toBe('nowrap');

    const caption = screen.getByText(t('workspace.mirroringNotice'));
    expect(caption.style.display).toBe('-webkit-box');
    expect(caption.style.minWidth).toBe('0');
    expect(caption.style.overflow).toBe('hidden');
    expect(caption.style.textOverflow).toBe('ellipsis');

    // jsdom's CSSStyleDeclaration drops `-webkit-line-clamp` (it is outside its
    // supported property list), so the two-line clamp is pinned at the source —
    // without it the caption could grow past two lines unnoticed.
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/common/MirrorBanner.tsx'),
      'utf8',
    );
    expect(source).toMatch(/WebkitLineClamp:\s*2/);
    expect(source).not.toMatch(/lineHeight:\s*'32px'/);
  });

  it('renders exactly the caption and the action — no state-dependent text', () => {
    renderWithAntd(<MirrorBanner onRefocus={vi.fn()} />);

    // No dismiss control, no auto-hide affordance, no success state, no
    // zero-data variant: a status bar carries one caption and one action.
    expect(banner().textContent).toBe(
      `${t('workspace.mirroringNotice')}${t('workspace.mirrorRefocus')}`,
    );
    expect(banner().querySelectorAll('button')).toHaveLength(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('makes the action a real keyboard-reachable control', () => {
    const onRefocus = vi.fn();
    renderWithAntd(<MirrorBanner onRefocus={onRefocus} />);

    const action = screen.getByLabelText(t('workspace.mirrorRefocusA11y'));
    // A control that only responds to a pointer is unreachable by keyboard.
    expect(action.getAttribute('role')).toBe('button');
    expect(action.getAttribute('tabindex')).toBe('0');

    action.focus();
    expect(document.activeElement).toBe(action);

    fireEvent.keyDown(action, { key: 'Enter' });
    fireEvent.keyDown(action, { key: ' ' });
    expect(onRefocus).toHaveBeenCalledTimes(2);
  });

  it('clicking the action calls the onRefocus callback exactly once', () => {
    const onRefocus = vi.fn();
    renderWithAntd(<MirrorBanner onRefocus={onRefocus} />);

    fireEvent.click(screen.getByText(t('workspace.mirrorRefocus')));

    expect(onRefocus).toHaveBeenCalledTimes(1);
  });

  it('does NOT trigger a page reload when the action is clicked', () => {
    const onRefocus = vi.fn();
    renderWithAntd(<MirrorBanner onRefocus={onRefocus} />);

    const action = screen.getByText(t('workspace.mirrorRefocus'));
    // jsdom's window.location.reload throws "Not implemented: navigation"
    // if invoked. A click that did NOT call onRefocus-and-reload via the
    // plan contract must not throw — only the callback runs.
    expect(() => fireEvent.click(action)).not.toThrow();
    expect(onRefocus).toHaveBeenCalledTimes(1);
  });

  it('carries no inline user-visible literal and no removed phase vocabulary', () => {
    const raw = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/common/MirrorBanner.tsx'),
      'utf8',
    );
    // Comments are stripped before scanning, so the component's own provenance
    // notes (which quote the retired literals) cannot trip the gate — the same
    // instrument correction plans 01-04/01-06/01-09 recorded.
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    // The two retired literals cannot come back as code.
    expect(source).not.toContain('Switched to Standalone.');
    expect(source).not.toContain('Refocus here and return to primary chat mode');
    // Every rendered string resolves through the map.
    expect(source).toContain("t('workspace.mirroringNotice')");
    expect(source).toContain("t('workspace.mirrorRefocus')");
    expect(source).toContain("t('workspace.mirrorRefocusA11y')");
    // The banner never claims a state it cannot know, and names no storage key.
    expect(source).not.toContain('window.location.reload');
    expect(source).not.toMatch(/np_workspace/);
  });
});
