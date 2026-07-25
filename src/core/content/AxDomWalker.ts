import type { RawNode } from '../extraction/apcLite.types';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'META', 'LINK']);

const LANDMARK_ROLE: Record<string, string> = {
  MAIN: 'main',
  NAV: 'navigation',
  HEADER: 'banner',
  FOOTER: 'contentinfo',
  ARTICLE: 'article',
  SECTION: 'region',
  ASIDE: 'complementary',
  H1: 'heading',
  H2: 'heading',
  H3: 'heading',
  H4: 'heading',
  H5: 'heading',
  H6: 'heading',
  A: 'link',
  IMG: 'image',
  UL: 'list',
  OL: 'list',
  LI: 'listitem',
  TABLE: 'table',
  TR: 'row',
  TD: 'cell',
  TH: 'cell',
  FORM: 'form',
  INPUT: 'textbox',
  TEXTAREA: 'textbox',
  SELECT: 'listbox',
  BUTTON: 'button',
  LABEL: 'label',
  P: 'paragraph',
  PRE: 'code',
  CODE: 'code',
  BLOCKQUOTE: 'blockquote',
  FIGURE: 'figure',
  FIGCAPTION: 'caption',
  HR: 'separator',
  STRONG: 'strong',
  EM: 'emphasis',
};

let uid = 0;
const nextId = (): string => `n${(uid++).toString(36)}`;

function isRendered(el: Element): boolean {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  const he = el as HTMLElement;
  if (he.hidden && he.getAttribute('hidden') !== 'until-found') return false;
  return true;
}

function ariaRole(el: Element): string {
  return el.getAttribute('role') ?? LANDMARK_ROLE[el.tagName] ?? 'generic';
}

function accessibleName(el: Element): string | undefined {
  return el.getAttribute('aria-label')?.trim() || (el as HTMLImageElement).alt?.trim() || undefined;
}

function ownText(el: Element): string | undefined {
  let t = '';
  for (const n of el.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) t += n.textContent ?? '';
  }
  const cleaned = t.replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

function isFormControl(el: Element): boolean {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

function formInfo(el: Element):
  | {
      control: {
        fieldName?: string;
        fieldType?: string;
        value?: string;
        isPassword?: boolean;
      };
    }
  | undefined {
  const i = el as HTMLInputElement;
  const isPassword = i.type === 'password';
  return {
    control: {
      fieldName: i.name || i.id || undefined,
      fieldType: i.type || el.tagName.toLowerCase(),
      value: isPassword ? undefined : (i.value || undefined),
      isPassword,
    },
  };
}

function interactionInfo(el: Element): Record<string, boolean | undefined> {
  const he = el as HTMLElement;
  return {
    clickable: (['A', 'BUTTON'].includes(el.tagName) || el.getAttribute('role') === 'button' || !!he.onclick) || undefined,
    editable: (isFormControl(el) || he.isContentEditable) || undefined,
    focusable: he.tabIndex >= 0 ? true : undefined,
    disabled: (el as HTMLInputElement).disabled || undefined,
    expanded: el.getAttribute('aria-expanded') === 'true' || undefined,
  };
}

function isCrossOrigin(f: HTMLIFrameElement): boolean {
  try {
    void f.contentDocument;
    return f.contentDocument === null;
  } catch {
    return true;
  }
}

function safeOrigin(f: HTMLIFrameElement): string {
  try {
    return new URL(f.src, location.href).origin;
  } catch {
    return 'unknown';
  }
}

function keep(el: Element): boolean {
  return !SKIP_TAGS.has(el.tagName) && isRendered(el);
}

export function walk(root: ParentNode = document.body): RawNode {
  const el = root as Element;
  const node: RawNode = {
    id: nextId(),
    role: el instanceof Element ? ariaRole(el) : 'generic',
    type: el instanceof Element ? el.tagName.toLowerCase() : undefined,
    children: [],
  };

  if (el instanceof Element) {
    const own = ownText(el);
    if (own) node.text = own;
    const name = accessibleName(el);
    if (name && !node.text) node.text = name;

    const r = el.getBoundingClientRect();
    if (r.width || r.height) {
      node.geometry = {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        inViewport: r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0,
      };
    }

    if (el.tagName === 'A') {
      node.link = {
        href: (el as HTMLAnchorElement).href,
        rel: el.getAttribute('rel') ?? undefined,
      };
    }
    if (el.tagName === 'IMG') {
      node.image = {
        alt: (el as HTMLImageElement).alt,
        src: (el as HTMLImageElement).currentSrc,
      };
    }
    if (isFormControl(el)) {
      node.form = formInfo(el);
    }
    node.interaction = interactionInfo(el);

    const sr = (el as HTMLElement).shadowRoot;
    if (sr) {
      for (const c of sr.children) {
        if (keep(c)) node.children!.push(walk(c));
      }
    }

    if (el.tagName === 'IFRAME') {
      const f = el as HTMLIFrameElement;
      node.iframe = { origin: safeOrigin(f), crossOrigin: isCrossOrigin(f) };
      if (!node.iframe.crossOrigin && f.contentDocument?.body) {
        node.children!.push(walk(f.contentDocument.body));
      }
    }
  }

  for (const c of el.children ?? []) {
    if (keep(c)) node.children!.push(walk(c));
  }

  return node;
}

export function resetIdCounter(): void {
  uid = 0;
}
