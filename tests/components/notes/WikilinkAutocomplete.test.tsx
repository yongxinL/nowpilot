// tests/components/notes/WikilinkAutocomplete.test.tsx — Phase 5 (05-07,
// Open Q5): the custom anchored combobox contract (UI-SPEC L245-250). The
// component is a pure controlled listbox+anchor renderer — keyboard navigation
// is exercised through the exposed handle (the page forwards TextArea keydowns
// there); insertion/mouse/keyboard callbacks; silent close on empty matches;
// the binding a11y contract (aria-haspopup/expanded/activedescendant + listbox
// + option roles).
import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  WikilinkAutocomplete,
  buildAnchorA11y,
  type WikilinkAutocompleteHandle,
  type WikilinkAutocompleteProps,
} from '@/components/notes/WikilinkAutocomplete';

const MATCHES = [
  { id: 'a', title: 'Alpha' },
  { id: 'b', title: 'Beta' },
  { id: 'g', title: 'Gamma' },
];

function makeProps(overrides: Partial<WikilinkAutocompleteProps> = {}): WikilinkAutocompleteProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    query: 'A',
    onQueryChange: vi.fn(),
    matches: MATCHES,
    onInsert: vi.fn(),
    highlighted: 0,
    onHighlightChange: vi.fn(),
    ...overrides,
  };
}

describe('WikilinkAutocomplete — anchored combobox (Open Q5)', () => {
  it('renders role=listbox with role=option items and aria-activedescendant on the highlighted one', () => {
    const props = makeProps({ highlighted: 1 });
    const { container } = render(<WikilinkAutocomplete {...props} />);
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();
    const options = container.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(3);
    // Active option id is wired through the anchor's aria-activedescendant.
    const anchor = container.querySelector('[data-np-wikilink-anchor]');
    expect(anchor?.getAttribute('aria-activedescendant')).toBe(options[1].id);
    expect(options[1].getAttribute('aria-selected')).toBe('true');
  });

  it('keyboard: ArrowDown/ArrowUp move highlighted (wrap-around); Enter/Tab insert; Esc closes', () => {
    // The page owns `highlighted` state: each keydown reports the next index
    // via onHighlightChange, the parent re-renders with the new prop, and the
    // handle closure refreshes — the test drives that exact controlled cycle.
    const props = makeProps({ highlighted: 2 });
    const ref = createRef<WikilinkAutocompleteHandle>();
    const view = render(<WikilinkAutocomplete ref={ref} {...props} />);
    const key = (k: string): void => ref.current?.handleKeyDown({ key: k });
    const setHighlighted = (i: number): void => {
      props.highlighted = i;
      view.rerender(<WikilinkAutocomplete ref={ref} {...props} />);
    };

    // ArrowDown from index 2 wraps to 0; ArrowDown from 0 → 1; ArrowUp wraps 1 → 0.
    key('ArrowDown');
    expect(props.onHighlightChange).toHaveBeenLastCalledWith(0);
    setHighlighted(0);
    key('ArrowDown');
    expect(props.onHighlightChange).toHaveBeenLastCalledWith(1);
    setHighlighted(1);
    (props.onHighlightChange as ReturnType<typeof vi.fn>).mockClear();
    key('ArrowUp');
    expect(props.onHighlightChange).toHaveBeenLastCalledWith(0);

    // Enter inserts the highlighted title (set 2 → 'Gamma').
    setHighlighted(2);
    key('Enter');
    expect(props.onInsert).toHaveBeenCalledWith('Gamma');

    // Tab inserts too.
    (props.onInsert as ReturnType<typeof vi.fn>).mockClear();
    key('Tab');
    expect(props.onInsert).toHaveBeenCalledWith('Gamma');

    // Esc closes.
    key('Escape');
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Shift+Enter falls through to the TextArea default (WR-08): no insert, no preventDefault; plain Enter still inserts', () => {
    const props = makeProps({ highlighted: 0 });
    const ref = createRef<WikilinkAutocompleteHandle>();
    const preventDefault = vi.fn();
    render(<WikilinkAutocomplete ref={ref} {...props} />);

    // Shift+Enter while the dropdown is open → the newline shortcut survives:
    // onInsert NOT called and preventDefault NOT called (the TextArea default
    // inserts the newline — nothing intercepts it).
    ref.current?.handleKeyDown({ key: 'Enter', shiftKey: true, preventDefault });
    expect(props.onInsert).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();

    // Plain Enter keeps inserting (the existing keyboard contract).
    ref.current?.handleKeyDown({ key: 'Enter', shiftKey: false, preventDefault });
    expect(props.onInsert).toHaveBeenCalledWith('Alpha');
  });

  it('empty matches → renders no listbox (silent close contract, WIKI-ID-03)', () => {
    const props = makeProps({ matches: [] });
    const { container } = render(<WikilinkAutocomplete {...props} />);
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(container.querySelector('[role="option"]')).toBeNull();
  });

  it('click on an option calls onInsert with its title', () => {
    const props = makeProps();
    const { container } = render(<WikilinkAutocomplete {...props} />);
    const options = container.querySelectorAll('[role="option"]');
    fireEvent.click(options[2]);
    expect(props.onInsert).toHaveBeenCalledWith('Gamma');
  });

  it('the anchor carries aria-haspopup=listbox + aria-expanded when open', () => {
    const props = makeProps();
    const { container } = render(<WikilinkAutocomplete {...props} />);
    const anchor = container.querySelector('[data-np-wikilink-anchor]');
    expect(anchor?.getAttribute('aria-haspopup')).toBe('listbox');
    expect(anchor?.getAttribute('aria-expanded')).toBe('true');
    // buildAnchorA11y is the contract the page spreads onto the TextArea.
    const a11y = buildAnchorA11y(true, 'list-1', 'opt-0');
    expect(a11y['aria-haspopup']).toBe('listbox');
    expect(a11y['aria-expanded']).toBe(true);
    expect(a11y['aria-controls']).toBe('list-1');
    expect(a11y['aria-activedescendant']).toBe('opt-0');
  });
});
