// AxDomWalker — content-script-side structural DOM+ARIA walker (06-02).
//
// Produces `RawNode` trees (roles/text/hierarchy/interaction flags/links/
// tables) in the ISOLATED world, per spec Appendix C RawNode (4393-4402).
// Runs ONLY when the PageContextBridge (06-04) invokes it for a
// mode:'actionable' EXTRACT_PAGE_CONTENT request — this module is a pure
// function; the D-86 gating lives at the call site. Zero AX cost on the
// default read/summarize path.
//
// Content-bundle constraints (Pitfall 8 / §24): this module imports NOTHING —
// `RawNode` is declared locally as a plain serializable interface, structurally
// identical to the panel-side `src/core/extraction/apcLite.types.ts` interface.
// No zod (the panel-side APCLiteDocumentSchema validates the tree), no
// defuddle, no panel-side extraction modules. The only allowed content-side
// dependency would be a type-only import from RuntimeEnvelope / sibling
// content modules — none is needed by the pure walk.
//
// Privacy (D-86/D-90): password values are omitted AT CAPTURE — the walker
// never emits `form.control.value` when the control is a password. This is
// the enforcement point; the panel-side FormControlSchema.refine is the
// backstop.
//
// v0.1 depth (spec 3776-3786): `geometry?` stays UNSET — layout is never
// read here; a future measurement pass would read it content-side against
// live layout, never in the panel's detached doc.
//
// Bounded walk (T-P6-10): maxDepth 32 + 5,000-node cap truncate pathological
// pages instead of hanging; the caller (bridge, 06-04) flags truncation via
// the onTruncated callback.
export interface RawNode {
  id: string;
  role: string;
  type?: string;
  text?: string;
  geometry?: { x: number; y: number; width: number; height: number; inViewport: boolean };
  interaction?: Record<string, boolean | undefined>;
  link?: { href: string; rel?: string };
  image?: { alt?: string; src?: string };
  form?: { control?: { fieldName?: string; fieldType?: string; value?: string; isPassword?: boolean } };
  iframe?: { origin: string; crossOrigin: boolean };
  children?: RawNode[];
}

export interface WalkDomOptions {
  /** Depth bound for the recursive walk (default AX_WALK_MAX_DEPTH). */
  maxDepth?: number;
  /** Called once when the walk hits the depth bound or the node cap. */
  onTruncated?: () => void;
}

export const AX_WALK_MAX_DEPTH = 32;
export const AX_WALK_MAX_NODES = 5_000;

/** Elements skipped by the walk (mirrors the §26.6 pre-stripped serialize set). */
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'template', 'head']);

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const PASSWORD_HINT = /passw|pwd|secret/i;

/** True when the element is a password control: type=password, or a
 * text-ish control whose name/aria-label/placeholder/id hints at a secret. */
export function isPasswordControl(el: Element): boolean {
  const type = el.getAttribute('type');
  if (type !== null && type.toLowerCase() === 'password') return true;
  const hint = [el.getAttribute('name'), el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('id')]
    .filter((v): v is string => v !== null)
    .join(' ');
  return PASSWORD_HINT.test(hint);
}

function trimmedText(el: Element): string | undefined {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return text === '' ? undefined : text;
}

/** Semantic role (+ carry `type`) for the node — ARIA role wins when present. */
function semanticRole(el: Element): { role: string; type?: string } {
  const ariaRole = el.getAttribute('role');
  if (ariaRole) return { role: ariaRole };
  const tag = el.tagName.toLowerCase();
  if (HEADING_TAGS.has(tag)) return { role: 'heading', type: tag };
  switch (tag) {
    case 'a':
      return { role: 'link' };
    case 'button':
      return { role: 'button' };
    case 'input': {
      const type = el.getAttribute('type')?.toLowerCase();
      if (type === 'checkbox' || type === 'radio') return { role: type, type };
      if (type === 'button' || type === 'submit' || type === 'reset') return { role: 'button', type };
      return { role: 'textbox', type: type ?? 'text' };
    }
    case 'textarea':
      return { role: 'textbox', type: 'textarea' };
    case 'select':
      return { role: 'combobox', type: 'select' };
    case 'ul':
    case 'ol':
      return { role: 'list' };
    case 'li':
      return { role: 'listitem' };
    case 'table':
      return { role: 'table' };
    case 'thead':
    case 'tbody':
    case 'tfoot':
      return { role: 'rowgroup' };
    case 'tr':
      return { role: 'row' };
    case 'td':
    case 'th':
      return { role: 'cell' };
    default:
      return { role: 'region' };
  }
}

function interactionFlags(el: Element): Record<string, boolean | undefined> | undefined {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  const inputType = el.getAttribute('type')?.toLowerCase();
  const isButton =
    tag === 'button' ||
    role === 'button' ||
    (tag === 'input' && (inputType === 'button' || inputType === 'submit' || inputType === 'reset'));
  const clickable = isButton || (tag === 'a' && el.hasAttribute('href')) || el.hasAttribute('onclick');
  const editable =
    tag === 'input' ||
    tag === 'textarea' ||
    (el as HTMLElement).isContentEditable ||
    (el.hasAttribute('contenteditable') && el.getAttribute('contenteditable') !== 'false');
  const focusable = el.hasAttribute('tabindex') || clickable || editable;
  const disabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';

  const flags: Record<string, boolean | undefined> = {};
  if (clickable) flags.clickable = true;
  if (editable) flags.editable = true;
  if (focusable) flags.focusable = true;
  if (disabled) flags.disabled = true;
  const expanded = el.getAttribute('aria-expanded');
  if (expanded === 'true') flags.expanded = true;
  else if (expanded === 'false') flags.expanded = false;
  return Object.keys(flags).length > 0 ? flags : undefined;
}

/** Anchor info — `href` resolved against the live document (absolute). */
function linkInfo(el: Element): { href: string; rel?: string } | undefined {
  if (el.tagName.toLowerCase() !== 'a' || !el.hasAttribute('href')) return undefined;
  const href = (el as HTMLAnchorElement).href;
  const rel = el.getAttribute('rel');
  return rel ? { href, rel } : { href };
}

/** Image info — resolved src, but never a data: URI (payload hygiene). */
function imageInfo(el: Element): { alt?: string; src?: string } | undefined {
  if (el.tagName.toLowerCase() !== 'img') return undefined;
  const info: { alt?: string; src?: string } = {};
  const alt = el.getAttribute('alt');
  if (alt) info.alt = alt;
  const src = (el as HTMLImageElement).src;
  if (src && !src.startsWith('data:')) info.src = src;
  return Object.keys(info).length > 0 ? info : undefined;
}

/** Form control info — password values are NEVER emitted (D-86/D-90). */
function formControl(
  el: Element,
): { fieldName?: string; fieldType?: string; value?: string; isPassword?: boolean } | undefined {
  const tag = el.tagName.toLowerCase();
  if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return undefined;
  const isPassword = tag === 'input' && isPasswordControl(el);
  const control: { fieldName?: string; fieldType?: string; value?: string; isPassword?: boolean } = {
    // Deterministic for the panel-side normalizer: every control records
    // whether it is a password, so consumers never guess.
    isPassword,
  };
  const name = el.getAttribute('name');
  if (name) control.fieldName = name;
  control.fieldType = tag === 'input' ? (el.getAttribute('type')?.toLowerCase() ?? 'text') : tag;
  if (!isPassword) {
    const value = (el as HTMLInputElement).value;
    if (value !== '') control.value = value;
  }
  return control;
}

/** Iframe info — origin derived from src; cross-origin frames are recorded,
 * never descended into (Same-Origin Policy; minimal v0.1 walk). */
function iframeInfo(el: Element): { origin: string; crossOrigin: boolean } | undefined {
  if (el.tagName.toLowerCase() !== 'iframe') return undefined;
  const src = el.getAttribute('src');
  let origin = 'about:blank';
  if (src) {
    try {
      origin = new URL(src, document.baseURI).origin;
    } catch {
      origin = 'about:blank';
    }
  }
  const docOrigin = document.location?.origin ?? '';
  return { origin, crossOrigin: origin !== 'about:blank' && origin !== docOrigin };
}

/** Walk a live element subtree into a RawNode tree (spec 4393-4402 shape).
 * Ids are a deterministic DFS path index: root 'n1', children 'n1.1', 'n1.2'… */
export function walkDom(root: Element, options?: WalkDomOptions): RawNode {
  const maxDepth = options?.maxDepth ?? AX_WALK_MAX_DEPTH;
  let nodeCount = 0;
  let truncated = false;
  const markTruncated = (): void => {
    if (!truncated) {
      truncated = true;
      options?.onTruncated?.();
    }
  };

  const walk = (el: Element, path: number[], depth: number): RawNode | null => {
    if (depth > maxDepth || nodeCount >= AX_WALK_MAX_NODES) {
      markTruncated();
      return null;
    }
    nodeCount += 1;

    const { role, type } = semanticRole(el);
    const node: RawNode = { id: `n${path.join('.')}`, role };
    if (type) node.type = type;

    // Text: headings/links/buttons/cells/list-items always carry their text;
    // other elements only when they are text leaves (avoids container noise).
    const shouldCapture =
      role === 'heading' || role === 'link' || role === 'button' || role === 'cell' || role === 'listitem' ||
      el.children.length === 0;
    if (shouldCapture) {
      const text = trimmedText(el);
      if (text) node.text = text;
    }

    const interaction = interactionFlags(el);
    if (interaction) node.interaction = interaction;

    const link = linkInfo(el);
    if (link) node.link = link;

    const image = imageInfo(el);
    if (image) node.image = image;

    const control = formControl(el);
    if (control) node.form = { control };

    const iframe = iframeInfo(el);
    if (iframe) node.iframe = iframe;

    const children: RawNode[] = [];
    let index = 0;
    for (const child of el.children) {
      if (SKIP_TAGS.has(child.tagName.toLowerCase())) continue;
      index += 1;
      const childNode = walk(child, [...path, index], depth + 1);
      if (childNode) children.push(childNode);
    }
    if (children.length > 0) node.children = children;
    return node;
  };

  // The root walk always produces a node: depth 0 is within any sane bound and
  // the node cap only trips after AX_WALK_MAX_NODES descendants.
  return walk(root, [1], 0) ?? { id: 'n1', role: 'region' };
}