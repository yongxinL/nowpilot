// src/core/content/AxDomWalker.ts — content-side live-DOM + ARIA walker (D-4a-12/13/20).
// Dependency-free core (Appendix G / RESEARCH Pitfall 4): no React, no antd, no zustand,
// no schema-runtime or extraction-lib imports — the RawNode import is type-only, so the
// content bundle stays tiny and dependency-free. Extraction-only (R-5): this walker READS
// the live DOM, never mutates it, never mounts UI, never writes back to the host. Invoked
// by the content host ONLY when mode:'actionable' is requested (D-4a-12 — the walker
// itself does not gate; the mode gate lives in the host wiring, 04a-07).
//
// D-4a-13: geometry is NEVER read in v0.1 — no forced-layout reads (no consumer; if ever
// populated it must be read against the live DOM, never a detached DOMParser doc).
// D-4a-20: password values are OMITTED AT CAPTURE — a password control (type=password or
// autocomplete current/new-password) is emitted with isPassword:true and NO value key, so
// the emitted object satisfies FormControlSchema.refine by construction (never captured,
// never merely redacted later; the panel re-validates at the 04a-04 boundary).
import type { RawNode } from '@/core/extraction/apcLite.types';

/** Cap on captured text per node — keeps the emitted tree bounded on text-heavy pages. */
export const AX_WALKER_MAX_TEXT = 2000;

/** Tags whose subtree carries no extractable structure (mirrors D-4a-07 strip intent). */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

/** autocomplete values that mark an input as a credential field (D-4a-20). */
const PASSWORD_AUTOCOMPLETES = new Set(['current-password', 'new-password']);

export interface AxDomWalkOptions {
  /** Max characters of direct text captured per node (default AX_WALKER_MAX_TEXT). */
  maxText?: number;
}

/** Emit the RawNode forest under `root` (Document → its root element's children). */
export function walkAxDom(root: Document | HTMLElement, options: AxDomWalkOptions = {}): RawNode[] {
  const maxText = options.maxText ?? AX_WALKER_MAX_TEXT;
  const walkRoot = root instanceof Document ? root.documentElement : root;
  const context: WalkContext = {
    maxText,
    seq: 0,
    nextId: () => `np-ax-${++context.seq}`,
  };
  const out: RawNode[] = [];
  for (const el of Array.from(walkRoot.children)) {
    const node = walkElement(el as HTMLElement, context);
    if (node) out.push(node);
  }
  return out;
}

interface WalkContext {
  maxText: number;
  seq: number;
  nextId: () => string;
}

/** Recursively walk one element, emitting a RawNode only when it carries content. */
function walkElement(el: HTMLElement, ctx: WalkContext): RawNode | null {
  const tag = el.tagName;
  if (SKIP_TAGS.has(tag)) return null;

  const text = directText(el);
  const role = resolveRole(el);
  const interaction = resolveInteraction(el);
  const link = resolveLink(el);
  const image = resolveImage(el);
  const formControl = resolveFormControl(el);
  const children = walkChildren(el, ctx);

  const hasFlags = Object.keys(interaction).length > 0;
  const hasContent =
    text.length > 0 || Boolean(link || image || formControl) || hasFlags || children.length > 0;
  if (!hasContent) return null;

  const node: RawNode = { id: ctx.nextId(), role };
  if (role !== 'generic') node.type = tag.toLowerCase();
  if (text) node.text = clamp(text, ctx.maxText);
  if (hasFlags) node.interaction = interaction;
  if (link) node.link = link;
  if (image) node.image = image;
  if (formControl) node.form = { control: formControl };
  if (children.length > 0) node.children = children;
  return node;
}

function walkChildren(el: HTMLElement, ctx: WalkContext): RawNode[] {
  const out: RawNode[] = [];
  for (const child of Array.from(el.children)) {
    const node = walkElement(child as HTMLElement, ctx);
    if (node) out.push(node);
  }
  return out;
}

/** Semantic/ARIA role: explicit role attribute wins, else element-semantics mapping. */
function resolveRole(el: HTMLElement): string {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit;
  switch (el.tagName) {
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      return 'heading';
    case 'A':
      return 'link';
    case 'BUTTON':
      return 'button';
    case 'INPUT':
    case 'TEXTAREA':
    case 'SELECT':
      return 'input';
    case 'TABLE':
      return 'table';
    case 'THEAD':
    case 'TBODY':
    case 'TFOOT':
      return 'rowgroup';
    case 'TR':
      return 'row';
    case 'TH':
      return 'columnheader';
    case 'TD':
      return 'cell';
    case 'IMG':
      return 'image';
    case 'UL':
    case 'OL':
      return 'list';
    case 'LI':
      return 'listitem';
    case 'FORM':
      return 'form';
    case 'NAV':
      return 'navigation';
    case 'MAIN':
      return 'main';
    case 'HEADER':
      return 'banner';
    case 'FOOTER':
      return 'contentinfo';
    case 'P':
      return 'paragraph';
    default:
      return 'generic';
  }
}

/** Interaction flags — clickable/editable/focusable/disabled (D-4a-12). */
function resolveInteraction(el: HTMLElement): Record<string, boolean | undefined> {
  const flags: Record<string, boolean | undefined> = {};
  const tag = el.tagName;
  const role = el.getAttribute('role');

  const clickable =
    (tag === 'A' && el.hasAttribute('href')) || tag === 'BUTTON' || role === 'button';
  const editable =
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    el.getAttribute('contenteditable') === 'true' ||
    el.getAttribute('contenteditable') === '';
  const focusable =
    clickable ||
    editable ||
    tag === 'SELECT' ||
    el.hasAttribute('tabindex') ||
    (typeof el.tabIndex === 'number' && el.tabIndex >= 0);
  const disabled = isDisabled(el);

  if (clickable) flags.clickable = true;
  if (editable) flags.editable = true;
  if (focusable) flags.focusable = true;
  if (disabled) flags.disabled = true;
  return flags;
}

function isDisabled(el: HTMLElement): boolean {
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLButtonElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ) {
    if (el.disabled) return true;
  }
  return el.getAttribute('aria-disabled') === 'true';
}

function resolveLink(el: HTMLElement): { href: string; rel?: string } | undefined {
  if (el.tagName !== 'A') return undefined;
  const href = el.getAttribute('href');
  if (href === null) return undefined;
  const link: { href: string; rel?: string } = { href };
  const rel = el.getAttribute('rel');
  if (rel) link.rel = rel;
  return link;
}

function resolveImage(el: HTMLElement): { alt?: string; src?: string } | undefined {
  if (el.tagName !== 'IMG') return undefined;
  const image: { alt?: string; src?: string } = {};
  const alt = el.getAttribute('alt');
  const src = el.getAttribute('src');
  if (alt !== null) image.alt = alt;
  if (src !== null) image.src = src;
  return image.alt !== undefined || image.src !== undefined ? image : undefined;
}

/** Form-control capture shape — structurally identical to RawNode.form.control. */
export interface FormControlCapture {
  fieldName?: string;
  fieldType?: string;
  value?: string;
  isPassword?: boolean;
}

/** Form control capture — password controls get isPassword:true and NO value (D-4a-20). */
function resolveFormControl(el: HTMLElement): FormControlCapture | undefined {
  if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') {
    return undefined;
  }
  const control: FormControlCapture = {};
  const name = el.getAttribute('name') ?? el.id ?? '';
  if (name) control.fieldName = name;
  if (el.tagName === 'INPUT') {
    control.fieldType = (el as HTMLInputElement).type || 'text';
  } else {
    control.fieldType = el.tagName.toLowerCase();
  }
  if (isPasswordField(el)) {
    control.isPassword = true;
    // D-4a-20: the value key is NEVER emitted for password fields — omitted at capture.
  } else {
    const value = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
    if (typeof value === 'string' && value.length > 0) control.value = value;
  }
  return Object.keys(control).length > 0 ? control : undefined;
}

/** D-4a-20 password detection: type=password OR autocomplete current/new-password. */
function isPasswordField(el: HTMLElement): boolean {
  if (el.tagName !== 'INPUT') return false;
  if ((el as HTMLInputElement).type === 'password') return true;
  const autocomplete = (el.getAttribute('autocomplete') ?? '').toLowerCase();
  return PASSWORD_AUTOCOMPLETES.has(autocomplete);
}

/** Direct text of the element — text-node children only, trimmed (no descendant duplication). */
function directText(el: HTMLElement): string {
  let text = '';
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? '';
  }
  return text.trim();
}

function clamp(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}
