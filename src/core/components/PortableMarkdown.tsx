// src/core/components/PortableMarkdown.tsx — the ONLY markdown renderer in this
// phase (banned third-party markdown renderer packages are never imported —
// the phase verify greps the src tree for them).
// Wraps @ant-design/x-markdown's XMarkdown renderer. Threat T-1-07 (XSS):
// sanitization is UNCONDITIONAL — the trust flag is a styling-only hint, never
// a bypass. Raw HTML in markdown is escaped to plain text (escapeRawHtml — the
// x-markdown equivalent of a skipHtml render mode) AND the content is passed
// through DOMPurify.sanitize first (defense in depth). AI/tool output is always
// trust:'retrieved' (R-7: never render AI/tool output raw).
//
// Phase 5 (05-07, Open Q4 / D-05-14/16): OPTIONAL wikilink resolution via the
// `wikilinks` prop — default undefined → zero behavior change for existing
// consumers (byte-identical render path). When provided, each `[[Title]]` span
// is pre-processed into a SAFE placeholder token BEFORE sanitization; after
// XMarkdown renders the tokenized (still sanitized, still escapeRawHtml)
// content, a safe DOM walk maps the marker tokens to React-friendly elements:
//   resolved   → <a data-np-wikilink="1" href="#note-{id}" data-title="...">Title</a>
//   unresolved → <span data-np-wikilink-unresolved="1" data-title="..." data-create-note="1">[[Title]] <Create note></span>
// The walk only ever builds elements programmatically (createElement +
// setAttribute + textContent) — NEVER dangerouslySetInnerHTML, NEVER raw HTML
// passthrough (T-05-24). DOMPurify.sanitize + escapeRawHtml stay unconditional
// (R-10/T-1-07): the marker elements are produced from the sanitized output.
import DOMPurify from 'dompurify';
import { theme } from 'antd';
import { XMarkdown } from '@ant-design/x-markdown';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { WIKILINK_PATTERN } from '@/core/notes/LinkParser';
import { STR } from '@/core/i18n/strings';

export interface PortableMarkdownProps {
  content: string;
  /** Styling hint only — sanitization is unconditional regardless of trust. */
  trust?: 'retrieved' | 'untrusted';
  className?: string;
  style?: CSSProperties;
  /**
   * Phase 5 (D-05-14/16): optional wikilink resolution — default undefined →
   * zero behavior change for existing consumers. resolve() maps a [[Title]]
   * target to its note id (or null when unresolved); onOpen fires when a
   * resolved link is clicked; onCreate fires when the 'Create note' affordance
   * on an unresolved link is clicked.
   */
  wikilinks?: {
    resolve: (title: string) => { id?: string } | null;
    onOpen?: (noteId: string) => void;
    onCreate?: (title: string) => void;
  };
}

/** Phase 5 (D-05-14/16): wikilink click handler contract (onOpen/onCreate). */
export interface WikilinkClickHandler {
  onOpen?: (noteId: string) => void;
  onCreate?: (title: string) => void;
}

// --- Wikilink tokenization (Open Q4) ---------------------------------------
// Private-use-area delimiters — invisible in rendered markdown, never
// markdown-significant, never HTML-significant, so the token survives
// DOMPurify + XMarkdown as a single plain-text run.
const TOKEN_START = '\uE000';
const TOKEN_END = '\uE001';

interface WikilinkEntry {
  title: string;
  /** Resolved note id — undefined entry means unresolved (WIKI-ID-03). */
  id?: string;
}

/** Marker attribute on every element the DOM walk inserts (cleanup hook). */
const MARKER_EL = 'data-np-wikilink-el';

/** Build the placeholder token for a wikilink at position `index`. */
function tokenFor(index: number): string {
  return TOKEN_START + String(index) + TOKEN_END;
}

/**
 * Pre-process: replace each [[Title]] with a safe placeholder token, recording
 * the resolution per token. Returns the tokenized content + the token map.
 * Runs BEFORE sanitization (the tokens are inert plain text).
 */
function tokenizeWikilinks(
  content: string,
  resolve: (title: string) => { id?: string } | null,
): { tokenized: string; entries: Map<string, WikilinkEntry> } {
  const entries = new Map<string, WikilinkEntry>();
  let index = 0;
  const tokenized = content.replace(WIKILINK_PATTERN, (_raw, title: string) => {
    const t = title.trim();
    const token = tokenFor(index);
    index += 1;
    const resolved = resolve(t);
    entries.set(token, { title: t, ...(resolved?.id ? { id: resolved.id } : {}) });
    return token;
  });
  return { tokenized, entries };
}

/** Build the substituted element for one token (programmatic DOM only). */
function buildWikilinkElement(
  entry: WikilinkEntry,
  onOpen: ((noteId: string) => void) | undefined,
  onCreate: ((title: string) => void) | undefined,
  token: { colorPrimary: string; colorTextTertiary: string },
): Element {
  if (entry.id !== undefined) {
    // Resolved — a real link to the target note (WIKI-ID-03, colorPrimary).
    const a = document.createElement('a');
    a.setAttribute('data-np-wikilink', '1');
    a.setAttribute('data-np-wikilink-resolved', '1');
    a.setAttribute('href', `#note-${entry.id}`);
    a.setAttribute('data-title', entry.title);
    a.setAttribute(MARKER_EL, '1');
    a.textContent = entry.title;
    a.style.color = token.colorPrimary;
    a.style.cursor = 'pointer';
    a.style.textDecoration = 'underline';
    a.addEventListener('click', (event) => {
      event.preventDefault();
      if (onOpen) onOpen(entry.id!);
    });
    return a;
  }
  // Unresolved — muted + dashed underline + 'Create note' affordance
  // (WIKI-ID-03, UI-SPEC Color): never a dead link, never a blocking state.
  const span = document.createElement('span');
  span.setAttribute('data-np-wikilink-unresolved', '1');
  span.setAttribute('data-title', entry.title);
  span.setAttribute('data-create-note', '1');
  span.setAttribute(MARKER_EL, '1');
  span.style.color = token.colorTextTertiary;
  span.style.borderBottom = `1px dashed ${token.colorTextTertiary}`;
  span.appendChild(document.createTextNode(`[[${entry.title}]]`));
  const create = document.createElement('span');
  create.setAttribute('data-np-wikilink-create-note', '1');
  create.setAttribute(MARKER_EL, '1');
  create.textContent = STR.notes.createNote;
  create.style.color = token.colorPrimary;
  create.style.cursor = 'pointer';
  create.style.marginLeft = '6px';
  create.style.fontSize = '12px';
  create.addEventListener('click', (event) => {
    event.stopPropagation();
    if (onCreate) onCreate(entry.title);
  });
  span.appendChild(create);
  return span;
}

/**
 * Safe DOM walk: replace every token text node in the rendered output with the
 * marker element built programmatically. Only the ALREADY-rendered (sanitized)
 * XMarkdown subtree is touched — never raw HTML, never innerHTML.
 */
function substituteTokens(
  root: HTMLElement,
  entries: Map<string, WikilinkEntry>,
  onOpen: ((noteId: string) => void) | undefined,
  onCreate: ((title: string) => void) | undefined,
  tokenColors: { colorPrimary: string; colorTextTertiary: string },
): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) textNodes.push(node as Text);

  for (const textNode of textNodes) {
    const value = textNode.nodeValue ?? '';
    const parent = textNode.parentNode;
    if (!parent) continue;
    const fragments: Node[] = [];
    let cursor = 0;
    let substituted = false;
    for (const [marker, entry] of entries) {
      const idx = value.indexOf(marker, cursor);
      if (idx === -1) continue;
      if (idx > cursor) fragments.push(document.createTextNode(value.slice(cursor, idx)));
      fragments.push(buildWikilinkElement(entry, onOpen, onCreate, tokenColors));
      cursor = idx + marker.length;
      substituted = true;
    }
    if (!substituted) continue;
    if (cursor < value.length) fragments.push(document.createTextNode(value.slice(cursor)));
    textNode.replaceWith(...fragments);
  }
}

export function PortableMarkdown({
  content,
  trust = 'untrusted',
  className,
  style,
  wikilinks,
}: PortableMarkdownProps) {
  if (!content || content.trim().length === 0) return null;
  // Open Q4: without the wikilinks prop the render path is byte-identical to
  // the pre-Phase-5 component (no tokenization, no DOM walk).
  const { tokenized, entries } = useMemo(
    () => (wikilinks ? tokenizeWikilinks(content, wikilinks.resolve) : { tokenized: content, entries: new Map<string, WikilinkEntry>() }),
    [content, wikilinks],
  );
  const sanitized = DOMPurify.sanitize(tokenized);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { token } = theme.useToken();

  useLayoutEffect(() => {
    if (!wikilinks || !rootRef.current) return;
    const root = rootRef.current;
    // Fresh substitution per render: clear any elements the previous pass
    // inserted (React's re-render orphans them — never React-owned nodes).
    root.querySelectorAll(`[${MARKER_EL}]`).forEach((el) => el.remove());
    substituteTokens(root, entries, wikilinks.onOpen, wikilinks.onCreate, {
      colorPrimary: token.colorPrimary,
      colorTextTertiary: token.colorTextTertiary,
    });
    return () => {
      root.querySelectorAll(`[${MARKER_EL}]`).forEach((el) => el.remove());
    };
  }, [tokenized, entries, wikilinks, token.colorPrimary, token.colorTextTertiary]);

  return (
    <div ref={rootRef} className={className} style={style} data-trust={trust}>
      <XMarkdown content={sanitized} escapeRawHtml />
    </div>
  );
}
