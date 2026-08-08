// src/core/components/FocusTrap.tsx — traps focus within a modal/dialog
// container (Tab/Shift+Tab cycle over visible focusables) and restores focus
// to the trigger element on unmount. KEPT in Phase 1 (I2): CmdKPicker (01-08)
// and the OnboardingModal (01-08) are modal surfaces that need focus trapping +
// focus restore. Minimal mode, by contrast, is a §2.5 tiny-model concept owned
// by its later phase and is NOT built here.
import { useEffect, useRef, type ReactNode } from 'react';

export interface FocusTrapProps {
  children: ReactNode;
  /** Focus the first focusable on mount (default true). */
  autoFocus?: boolean;
  /** Called when Escape is pressed inside the trap (default noop). */
  onEscape?: () => void;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// jsdom has no layout engine — offsetParent is always null there, so the real
// visibility check would exclude every element. Detect jsdom and approximate
// visibility with the CSS properties jsdom DOES model (display/visibility).
const IS_JSDOM = typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom');

function isVisible(el: HTMLElement): boolean {
  if (!IS_JSDOM) return el.offsetParent !== null;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => isVisible(el) || el === document.activeElement,
  );
}

export function FocusTrap({ children, autoFocus = true, onEscape, className }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Capture the element that had focus when the trap mounted so we can
    // restore it on unmount.
    const previous = document.activeElement as HTMLElement | null;

    const focusables = getFocusable(container);
    if (autoFocus && focusables.length > 0) focusables[0].focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const current = getFocusable(container);
      if (current.length === 0) {
        event.preventDefault();
        return;
      }
      const first = current[0];
      const last = current[current.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [autoFocus]);

  return (
    <div ref={containerRef} tabIndex={-1} className={className}>
      {children}
    </div>
  );
}
