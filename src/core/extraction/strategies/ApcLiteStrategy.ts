import { APCLiteDocumentSchema } from '../apcLite.types';
import type { APCLiteDocument, APCLiteNode } from '../apcLite.types';
import type { IExtractionStrategy } from './IExtractionStrategy';
import type { ExtractionMode, StrategyInput, StrategyResult } from '../types';

/**
 * APCLite structural extraction strategy (D-08).
 *
 * Runs for mode 'actionable': parses the serialized HTML in the extension-page
 * context (never in the content script — D-05) via a DOMParser sandbox, walks
 * the DOM collecting semantically relevant nodes (interactive elements,
 * landmarks, explicit ARIA roles) into an APCLiteNode tree with role, name,
 * id, geometry, interaction and ARIA/data attributes.
 *
 * The tree is the automation substrate for v2 (spec §26.7) — this strategy
 * ONLY builds and validates the tree; no automation logic exists in v0.1.
 * Every node passes through APCLiteDocumentSchema.safeParse() before it is
 * returned (T-04a-09); malformed output throws at the strategy boundary.
 *
 * DoS guard (T-04a-08): the DOM walk is depth-limited to MAX_DEPTH levels —
 * deeper nodes are dropped and `truncated: true` is set on the result.
 */
export class ApcLiteStrategy implements IExtractionStrategy {
  readonly id = 'apc-lite' as const;

  canHandle(input: { url: string; mode: ExtractionMode }): boolean {
    return input.mode === 'actionable';
  }

  async run(input: StrategyInput): Promise<StrategyResult> {
    if (!input.html) {
      throw new Error('ApcLiteStrategy: no HTML provided');
    }

    const doc = new DOMParser().parseFromString(input.html, 'text/html');
    const walker = new DomWalker(MAX_DEPTH);
    const children = walker.walk(doc.body);

    const rootNode: APCLiteNode = {
      role: 'document',
      name: input.title || 'document',
      id: 'document-root',
      children: children.length > 0 ? children : undefined,
    };

    const documentNode: APCLiteDocument = {
      type: 'document',
      url: input.url,
      capturedAt: Date.now(),
      children: [rootNode],
    };

    // T-04a-09: Zod strictObject validation is the trust gate — untrusted DOM
    // data becomes typed APCLiteNode data only after safeParse succeeds.
    const validation = APCLiteDocumentSchema.safeParse(documentNode);
    if (!validation.success) {
      throw new Error(
        `ApcLiteStrategy: APCLiteDocument validation failed: ${JSON.stringify(
          validation.error.issues,
        )}`,
      );
    }

    return {
      source: 'apc-lite',
      root: rootNode,
      meta: { title: input.title },
      approxTokens: (walker.nodeCount + 1) * AVG_TOKENS_PER_NODE,
      truncated: walker.depthLimitHit,
    };
  }
}

/** T-04a-08: recursion ceiling for the DOM walk (~100 levels). */
const MAX_DEPTH = 100;

/** Rough per-node token cost used for approxTokens estimation. */
const AVG_TOKENS_PER_NODE = 4;

/** Bounds applied to node text/name fields to keep the tree compact. */
const MAX_TEXT_LENGTH = 200;
const MAX_NAME_LENGTH = 100;

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'meta', 'link', 'title']);

const ROLE_BY_TAG: Record<string, string> = {
  button: 'button',
  a: 'link',
  select: 'listbox',
  textarea: 'textbox',
  option: 'option',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  img: 'img',
  nav: 'navigation',
  main: 'main',
  form: 'form',
  article: 'article',
  header: 'banner',
  footer: 'contentinfo',
  ul: 'list',
  ol: 'list',
  li: 'listitem',
  table: 'table',
};

const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'menuitem',
  'option',
  'textbox',
  'combobox',
  'listbox',
  'spinbutton',
  'slider',
  'searchbox',
  'menu',
]);

function isHidden(el: Element): boolean {
  return el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true';
}

function inputRole(el: Element): string {
  switch ((el.getAttribute('type') || 'text').toLowerCase()) {
    case 'checkbox':
      return 'checkbox';
    case 'radio':
      return 'radio';
    case 'button':
    case 'submit':
    case 'reset':
    case 'file':
      return 'button';
    default:
      return 'textbox';
  }
}

/** ARIA role for an element, or null when it has no semantic role. */
function computeRole(el: Element): string | null {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit.toLowerCase();
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') return inputRole(el);
  if (tag === 'a' && !el.hasAttribute('href')) return null;
  return ROLE_BY_TAG[tag] ?? null;
}

function isInteractive(el: Element, role: string | null): boolean {
  if (role && INTERACTIVE_ROLES.has(role)) return true;
  if (el.getAttribute('contenteditable') === 'true') return true;
  if (el.hasAttribute('tabindex')) return true;
  return false;
}

function geometryOf(
  el: Element,
): { x: number; y: number; width: number; height: number } | undefined {
  try {
    const rect = el.getBoundingClientRect();
    if (
      typeof rect.x !== 'number' ||
      typeof rect.y !== 'number' ||
      typeof rect.width !== 'number' ||
      typeof rect.height !== 'number'
    ) {
      return undefined;
    }
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  } catch {
    return undefined; // element not attached to a layout context — geometry omitted
  }
}

function interactionOf(el: Element, role: string | null): Record<string, unknown> | undefined {
  const interaction: Record<string, unknown> = {};
  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute('type') || '').toLowerCase();

  const clickable =
    tag === 'button' ||
    tag === 'a' ||
    tag === 'select' ||
    tag === 'summary' ||
    (tag === 'input' && ['button', 'submit', 'reset', 'checkbox', 'radio', 'file'].includes(type)) ||
    (role !== null && ['button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'option'].includes(role));
  if (clickable) interaction.clickable = true;

  const editable =
    tag === 'textarea' ||
    (tag === 'input' &&
      ['text', 'email', 'search', 'url', 'tel', 'number', 'password', 'date', 'time', 'datetime-local', 'month', 'week', 'color'].includes(type)) ||
    el.getAttribute('contenteditable') === 'true' ||
    (role !== null && ['textbox', 'combobox', 'spinbutton', 'searchbox'].includes(role));
  if (editable) interaction.editable = true;

  if (isInteractive(el, role) || el.hasAttribute('tabindex')) {
    interaction.focusable = true;
  }

  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
    interaction.disabled = true;
  }

  const ariaExpanded = el.getAttribute('aria-expanded');
  if (ariaExpanded === 'true') interaction.expanded = true;
  else if (ariaExpanded === 'false') interaction.expanded = false;

  const tabIndex = parseInt(el.getAttribute('tabindex') ?? '', 10);
  if (!Number.isNaN(tabIndex)) interaction.tabIndex = tabIndex;

  return Object.keys(interaction).length > 0 ? interaction : undefined;
}

function attributesOf(el: Element): Record<string, string> | undefined {
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('aria-') || name.startsWith('data-')) {
      attributes[name] = attr.value;
      continue;
    }
    switch (name) {
      case 'href':
      case 'rel':
      case 'target':
      case 'alt':
      case 'src':
      case 'type':
      case 'placeholder':
      case 'disabled':
      case 'checked':
      case 'selected':
        attributes[name] = attr.value;
        break;
      case 'value':
        // D-02 / spec §16: password values are NEVER captured at source.
        if (el.tagName.toLowerCase() === 'input' && (el.getAttribute('type') || '').toLowerCase() === 'password') {
          break;
        }
        attributes[name] = attr.value;
        break;
    }
  }
  return Object.keys(attributes).length > 0 ? attributes : undefined;
}

function textOf(el: Element, role: string | null, hasElementChildren: boolean): string | undefined {
  if (
    !hasElementChildren ||
    (role !== null && (role === 'heading' || INTERACTIVE_ROLES.has(role)))
  ) {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return undefined;
    return text.slice(0, MAX_TEXT_LENGTH);
  }
  return undefined;
}

function nameOf(el: Element, role: string | null): string | undefined {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.slice(0, MAX_NAME_LENGTH);
  if (el.tagName.toLowerCase() === 'img') {
    const alt = el.getAttribute('alt');
    if (alt) return alt.slice(0, MAX_NAME_LENGTH);
  }
  if (role !== null && (INTERACTIVE_ROLES.has(role) || role === 'heading')) {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) return text.slice(0, MAX_NAME_LENGTH);
  }
  return undefined;
}

/**
 * Depth-limited DOM walker producing APCLiteNode trees (T-04a-08).
 *
 * Non-semantic elements (no role, not interactive) are transparent: their
 * semantic descendants are hoisted into the parent's children list, so the
 * tree stays compact while preserving every interactive/landmark node.
 */
class DomWalker {
  private counter = 0;
  private hitDepthLimit = false;

  constructor(private readonly depthLimit: number) {}

  get nodeCount(): number {
    return this.counter;
  }

  get depthLimitHit(): boolean {
    return this.hitDepthLimit;
  }

  walk(el: Element): APCLiteNode[] {
    return this.collectChildren(el, 0);
  }

  private collectChildren(el: Element, depth: number): APCLiteNode[] {
    if (depth > this.depthLimit) {
      this.hitDepthLimit = true;
      return [];
    }
    const nodes: APCLiteNode[] = [];
    for (const child of Array.from(el.children)) {
      if (SKIP_TAGS.has(child.tagName.toLowerCase()) || isHidden(child)) continue;
      const node = this.buildNode(child, depth + 1);
      if (node) nodes.push(node);
      else nodes.push(...this.collectChildren(child, depth + 1));
    }
    return nodes;
  }

  private buildNode(el: Element, depth: number): APCLiteNode | null {
    const role = computeRole(el);
    const interactive = isInteractive(el, role);
    if (role === null && !interactive) return null;

    if (depth > this.depthLimit) {
      this.hitDepthLimit = true;
      return null;
    }

    const node: APCLiteNode = {
      // Interactive elements without an implicit/explicit role (e.g. a
      // contenteditable div) get the ARIA-correct generic role.
      role: role ?? 'generic',
      id: el.id || `apc-${this.counter++}`,
    };
    const name = nameOf(el, role);
    if (name) node.name = name;
    const attributes = attributesOf(el);
    if (attributes) node.attributes = attributes;
    const geometry = geometryOf(el);
    if (geometry) node.geometry = geometry;
    const interaction = interactionOf(el, role);
    if (interaction) node.interaction = interaction;

    const children = this.collectChildren(el, depth);
    if (children.length > 0) node.children = children;

    const hasElementChildren = Array.from(el.children).some(
      (child) => !SKIP_TAGS.has(child.tagName.toLowerCase()) && !isHidden(child),
    );
    const text = textOf(el, role, hasElementChildren);
    if (text) node.text = text;

    return node;
  }
}
