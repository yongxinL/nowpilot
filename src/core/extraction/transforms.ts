import type { APCLiteNode, RawNode } from './apcLite.types';

const COLLAPSE_THRESHOLD_TEXT = 120;
const COLLAPSE_THRESHOLD_CHILDREN = 8;
const TEXT_EMPHASIS_ROLES = new Set(['strong', 'emphasis']);

export function normalize(raw: RawNode): APCLiteNode {
  function convert(r: RawNode): APCLiteNode {
    const node: APCLiteNode = {
      id: r.id,
      role: r.role,
      type: r.type,
      text: r.text,
      children: [],
    };

    if (r.geometry) {
      node.geometry = { ...r.geometry };
    }
    if (r.link) {
      node.link = { ...r.link };
    }
    if (r.image) {
      node.image = { ...r.image };
    }
    if (r.form) {
      node.form = {
        control: r.form.control ? { ...r.form.control } : undefined,
      };
    }
    if (r.iframe) {
      node.iframe = { ...r.iframe };
    }

    if (r.interaction) {
      const interaction: Record<string, boolean | undefined> = {};
      let hasInteraction = false;
      for (const [k, v] of Object.entries(r.interaction)) {
        if (v === true) {
          interaction[k] = v;
          hasInteraction = true;
        }
      }
      if (hasInteraction) node.interaction = interaction;
    }

    const headingMatch = /^H([1-6])$/.exec(r.type ?? '');
    if (headingMatch) {
      node.textStyle = { level: parseInt(headingMatch[1], 10) };
      node.role = 'heading';
    }

    if (TEXT_EMPHASIS_ROLES.has(r.type ?? '')) {
      node.textStyle = { emphasis: true, ...node.textStyle };
    }

    for (const c of r.children ?? []) {
      node.children!.push(convert(c));
    }

    return node;
  }

  const converted = convert(raw);
  return collapseSingleWrappers(converted);
}

function collapseSingleWrappers(node: APCLiteNode): APCLiteNode {
  if (!node.children || node.children.length !== 1) {
    node.children = node.children?.map(collapseSingleWrappers);
    return node;
  }

  const child = node.children[0];

  if (
    !node.text ||
    node.text.length < 10
  ) {
    if (
      child.text &&
      child.text.length > COLLAPSE_THRESHOLD_TEXT
    ) {
      const merged: APCLiteNode = {
        ...child,
        id: node.id,
        text: node.text ? `${node.text}. ${child.text}` : child.text,
        children: child.children,
      };
      return collapseSingleWrappers(merged);
    }
  }

  if (
    node.children.length === 1 &&
    !node.text &&
    !node.link &&
    !node.image &&
    !node.form &&
    !node.iframe &&
    !node.interaction &&
    !child.text &&
    (child.children?.length ?? 0) > COLLAPSE_THRESHOLD_CHILDREN
  ) {
    return collapseSingleWrappers(child);
  }

  node.children = node.children.map(collapseSingleWrappers);
  return node;
}

export function prune(
  root: APCLiteNode,
  opts: { includeOutOfViewport: boolean; maxNodes?: number },
): APCLiteNode {
  function doPrune(node: APCLiteNode, depth: number): APCLiteNode | null {
    if (node.children) {
      node.children = node.children
        .map((c) => doPrune(c, depth + 1))
        .filter((c): c is APCLiteNode => c !== null);
    }

    if (node.geometry && !node.geometry.inViewport && !opts.includeOutOfViewport) {
      if (!node.children || node.children.length === 0) return null;
      if (node.text && node.text.length < 20 && node.children.length > 0) {
        return null;
      }
    }

    if (!node.text && !node.link && !node.image && !node.form && !node.iframe) {
      if (!node.children || node.children.length === 0) {
        if (node.interaction && Object.values(node.interaction).some((v) => v)) {
          return node;
        }
        return null;
      }
    }

    return node;
  }

  const result = doPrune(root, 0);
  return result ?? root;
}

const REDACT_PATTERNS = [
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
  /\b\d{13,19}\b/g,
  /\b[34]\d{15}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
];

export function redact(root: APCLiteNode): APCLiteNode {
  function doRedact(node: APCLiteNode): APCLiteNode {
    if (node.text) {
      let t = node.text;
      for (const p of REDACT_PATTERNS) {
        t = t.replace(p, '[redacted]');
      }
      if (t !== node.text) {
        return { ...node, text: t };
      }
    }

    if (node.form?.control?.isPassword) {
      const { value, ...rest } = node.form.control;
      return {
        ...node,
        form: { control: rest },
      };
    }

    if (node.children) {
      let changed = false;
      const newChildren = node.children.map((c) => {
        const r = doRedact(c);
        if (r !== c) changed = true;
        return r;
      });
      if (changed) {
        return { ...node, children: newChildren };
      }
    }

    return node;
  }

  return doRedact(root);
}
