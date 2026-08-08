// tests/components/FocusTrap.test.tsx — focus trapping + focus restore for the
// modal surfaces (CmdKPicker / OnboardingModal, 01-08). Verified via
// testing-library in jsdom (flagged assumption WSPC-05); real keyboard e2e is
// deferred to browser tests.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FocusTrap } from '@/core/components/FocusTrap';

function Harness({ show }: { show: boolean }) {
  return (
    <>
      <button type="button">trigger</button>
      {show && (
        <FocusTrap>
          <button type="button">first</button>
          <input aria-label="middle" />
          <button type="button">last</button>
        </FocusTrap>
      )}
    </>
  );
}

describe('FocusTrap', () => {
  it('focuses the first focusable on mount by default', () => {
    render(
      <FocusTrap>
        <button type="button">first</button>
        <button type="button">last</button>
      </FocusTrap>,
    );
    expect(document.activeElement).toBe(screen.getByText('first'));
  });

  it('does not steal focus when autoFocus is false', () => {
    render(
      <>
        <button type="button">keep</button>
        <FocusTrap autoFocus={false}>
          <button type="button">inside</button>
        </FocusTrap>
      </>,
    );
    const keep = screen.getByText('keep');
    keep.focus();
    expect(document.activeElement).toBe(keep);
  });

  it('cycles Tab from the last focusable back to the first', () => {
    render(
      <FocusTrap>
        <button type="button">first</button>
        <button type="button">last</button>
      </FocusTrap>,
    );
    const last = screen.getByText('last');
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('first'));
  });

  it('cycles Shift+Tab from the first focusable back to the last', () => {
    render(
      <FocusTrap>
        <button type="button">first</button>
        <button type="button">last</button>
      </FocusTrap>,
    );
    const first = screen.getByText('first');
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText('last'));
  });

  it('calls onEscape when Escape is pressed inside the trap', () => {
    const onEscape = vi.fn();
    render(
      <FocusTrap onEscape={onEscape}>
        <button type="button">inside</button>
      </FocusTrap>,
    );
    fireEvent.keyDown(screen.getByText('inside'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the previously-focused element on unmount', () => {
    const { rerender } = render(<Harness show={false} />);
    const trigger = screen.getByText('trigger');
    trigger.focus();
    rerender(<Harness show />);
    // autoFocus moved focus into the trap
    expect(document.activeElement).toBe(screen.getByText('first'));
    rerender(<Harness show={false} />);
    // unmount restored focus to the trigger captured at mount
    expect(document.activeElement).toBe(trigger);
  });
});
