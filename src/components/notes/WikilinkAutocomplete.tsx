// src/components/notes/WikilinkAutocomplete.tsx — Phase 5 (05-07, Open Q5,
// UI-SPEC WikilinkAutocomplete contract): a custom anchored combobox over the
// body TextArea (antd AutoComplete's text-input coupling fights caret
// insertion — Open Q5 resolution). Trigger: the PAGE detects '[[ ' on the
// TextArea keydown and owns the caret; this component is a PURE listbox+anchor
// renderer — controlled state in, callbacks out, no DOM measurement beyond the
// anchor rect (the page passes the anchor rect / owns positioning context).
//
// The binding a11y contract (UI-SPEC L250): the anchor announces
// aria-haspopup="listbox" + aria-expanded + aria-controls +
// aria-activedescendant (the page spreads buildAnchorA11y onto the TextArea);
// the dropdown is role="listbox" with role="option" items; the active option
// is tracked via aria-activedescendant on the anchor + id on the option;
// insertion is announced politely through a visually-hidden aria-live region.
// Keyboard (the parent forwards keydown via the exposed handle): ↑/↓ move the
// active item (wrap), Enter/Tab insert '[[Title]]' at the caret + close, Esc
// closes. No matches → the dropdown closes SILENTLY (WIKI-ID-03 — no blocking
// state, no error). Dropdown max-height ~320 px + internal scroll (UI-SPEC ⚠
// unresolved assumption, confirmed at verify time). Pure combobox — no
// force-directed graph layout, no extension API (R-3); the MiniSearch instance
// is passed in as props (the page's mounted index — 05-05), never constructed
// inside.
import { forwardRef, useId, useImperativeHandle } from 'react';
import { theme } from 'antd';

/** UI-SPEC ⚠ unresolved: dropdown max-height + internal scroll (planner assumption). */
export const MAX_DROPDOWN_HEIGHT = 320;

export interface WikilinkAutocompleteMatch {
  id: string;
  title: string;
}

export interface WikilinkAutocompleteProps {
  /** Dropdown visibility — owned by the page (trigger state lives there). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Text after the last '[[' — the page updates it as the user types. */
  query: string;
  onQueryChange: (q: string) => void;
  /** MiniSearch title matches (searchNotes(titleIndex, query, { limit: 8 })). */
  matches: ReadonlyArray<WikilinkAutocompleteMatch>;
  /** Insert '[[{title}]]' at the caret (page-owned insertion). */
  onInsert: (title: string) => void;
  /** Active option index (page-owned — wraps over matches.length). */
  highlighted: number;
  onHighlightChange: (i: number) => void;
  /** Polite insertion announcement (visually-hidden aria-live region). */
  announcement?: string;
}

/** Imperative handle — the page forwards TextArea keydowns here. */
export interface WikilinkAutocompleteHandle {
  handleKeyDown: (event: { key: string; preventDefault?: () => void }) => void;
}

/**
 * The combobox ANCHOR a11y contract (UI-SPEC L250) — the page spreads the
 * returned attributes onto the body TextArea so the real input announces the
 * listbox relationship.
 */
export function buildAnchorA11y(
  open: boolean,
  listId: string,
  activeOptionId: string | undefined,
): { 'aria-haspopup': 'listbox'; 'aria-expanded': boolean; 'aria-controls'?: string; 'aria-activedescendant'?: string } {
  return {
    'aria-haspopup': 'listbox',
    'aria-expanded': open,
    ...(open ? { 'aria-controls': listId } : {}),
    ...(activeOptionId !== undefined ? { 'aria-activedescendant': activeOptionId } : {}),
  };
}

export const WikilinkAutocomplete = forwardRef<
  WikilinkAutocompleteHandle,
  WikilinkAutocompleteProps
>(function WikilinkAutocomplete(
  {
    open,
    onOpenChange,
    matches,
    onInsert,
    highlighted,
    onHighlightChange,
    announcement,
  }: WikilinkAutocompleteProps,
  ref,
) {
  const { token } = theme.useToken();
  const uid = useId();
  const listId = `np-wikilink-list-${uid}`;
  const optionId = (i: number): string => `np-wikilink-option-${uid}-${i}`;
  const activeOptionId =
    open && highlighted >= 0 && matches[highlighted] !== undefined
      ? optionId(highlighted)
      : undefined;
  const anchorA11y = buildAnchorA11y(open, listId, activeOptionId);

  // The parent forwards TextArea keydowns here (the page owns the caret).
  useImperativeHandle(
    ref,
    () => ({
      handleKeyDown: (event) => {
        // Closed / no matches → silent close contract: the dropdown must not
        // swallow the page's editing keys (WIKI-ID-03).
        if (!open || matches.length === 0) return;
        const { key } = event;
        if (key === 'ArrowDown') {
          event.preventDefault?.();
          onHighlightChange((highlighted + 1) % matches.length);
        } else if (key === 'ArrowUp') {
          event.preventDefault?.();
          onHighlightChange((highlighted - 1 + matches.length) % matches.length);
        } else if (key === 'Enter' || key === 'Tab') {
          const target = matches[highlighted];
          if (target !== undefined) {
            event.preventDefault?.();
            onInsert(target.title);
          }
        } else if (key === 'Escape') {
          event.preventDefault?.();
          onOpenChange(false);
        }
      },
    }),
    [open, matches, highlighted, onHighlightChange, onInsert, onOpenChange],
  );

  return (
    <div
      className="np-wikilink-autocomplete"
      data-np-wikilink-autocomplete="1"
      // Anchored popover: positioned below the TextArea (the page wraps the
      // editor body in a position:relative container).
      style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20 }}
    >
      {/* Logical anchor carrying the combobox a11y attributes (the page also
          spreads buildAnchorA11y onto the real TextArea). */}
      <span
        data-np-wikilink-anchor="1"
        aria-haspopup={anchorA11y['aria-haspopup']}
        aria-expanded={anchorA11y['aria-expanded']}
        aria-controls={anchorA11y['aria-controls']}
        aria-activedescendant={anchorA11y['aria-activedescendant']}
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
      />
      {open && matches.length > 0 && (
        <div
          id={listId}
          role="listbox"
          data-np-wikilink-list="1"
          style={{
            maxHeight: MAX_DROPDOWN_HEIGHT,
            overflowY: 'auto',
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 8,
            boxShadow: token.boxShadowSecondary,
            padding: 4,
          }}
        >
          {matches.map((match, index) => (
            <div
              key={match.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === highlighted}
              data-np-wikilink-option="1"
              onClick={() => onInsert(match.title)}
              onMouseEnter={() => onHighlightChange(index)}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                borderRadius: 6,
                fontSize: 14,
                color: token.colorText,
                background: index === highlighted ? token.colorPrimaryBg : 'transparent',
                fontWeight: index === highlighted ? 600 : 400,
              }}
            >
              {match.title}
            </div>
          ))}
        </div>
      )}
      {/* Polite insertion announcement (visually-hidden aria-live region). */}
      <span
        aria-live="polite"
        role="status"
        data-np-wikilink-live="1"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}
      >
        {announcement ?? ''}
      </span>
    </div>
  );
});
