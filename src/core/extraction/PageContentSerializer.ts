import type { APCLiteNode } from './apcLite.types';

function escapeMarkdown(text: string): string {
  return text.replace(/([*_~`[\]()#+\-.!|{}\]>])/g, '\\$1');
}

export function flattenMarkdown(root: APCLiteNode): string {
  const lines: string[] = [];
  const stack: string[] = [];

  function walk(node: APCLiteNode, depth: number): void {
    if (node.text) {
      let line = '';

      const role = node.role.toLowerCase();
      if (role === 'heading') {
        const level = Math.min(node.textStyle?.level ?? 2, 6);
        line = '#'.repeat(level) + ' ' + node.text;
      } else if (node.type === 'LI' || role === 'listitem') {
        line = '  '.repeat(Math.max(0, depth - 1)) + '- ' + node.text;
      } else if (role === 'link' && node.link) {
        line = `[${node.text}](${node.link.href})`;
      } else if (role === 'code' && (node.type === 'PRE' || node.type === 'CODE')) {
        line = '```\n' + node.text + '\n```';
      } else if (role === 'blockquote') {
        line = '> ' + node.text;
      } else {
        line = node.text;
      }

      if (node.link && role !== 'link') {
        const linkText = escapeMarkdown(node.text);
        line = `[${linkText}](${node.link.href})`;
      }

      lines.push(line);
    }

    if (node.image?.alt) {
      lines.push(`![${node.image.alt}](${node.image.src || ''})`);
    }

    if (node.form?.control) {
      const { fieldName, fieldType, isPassword, value } = node.form.control;
      if (!isPassword && fieldName) {
        stack.push(`[${fieldType || 'input'} ${fieldName}: ${value || '(empty)'}]`);
        if (stack.length > 5) {
          while (stack.length > 0) {
            lines.push(stack.shift()!);
          }
        }
      }
    }

    for (const c of node.children ?? []) {
      walk(c, depth + 1);
    }
  }

  walk(root, 0);

  while (stack.length > 0) {
    lines.push(stack.shift()!);
  }

  return lines.join('\n');
}

export function withAncestorHeadings(root: APCLiteNode, nodes: APCLiteNode[]): APCLiteNode[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const ancestors = new Set<string>();

  function findAncestors(node: APCLiteNode, path: APCLiteNode[]): void {
    if (nodeIds.has(node.id)) {
      for (const a of path) {
        if (a.role === 'heading') ancestors.add(a.id);
      }
    }
    for (const c of node.children ?? []) {
      findAncestors(c, [...path, node]);
    }
  }

  findAncestors(root, []);

  const ancestorNodes = new Map<string, APCLiteNode>();
  function collect(node: APCLiteNode): void {
    if (ancestors.has(node.id)) ancestorNodes.set(node.id, node);
    for (const c of node.children ?? []) collect(c);
  }
  collect(root);

  const headingNodes = Array.from(ancestorNodes.values());
  return [...headingNodes, ...nodes];
}

export function budgetTrim(nodes: APCLiteNode[], maxTokens: number): APCLiteNode[] {
  let tokenEstimate = 0;
  const result: APCLiteNode[] = [];
  for (const n of nodes) {
    const nodeTokens = estimateNodeTokens(n);
    if (tokenEstimate + nodeTokens > maxTokens) break;
    tokenEstimate += nodeTokens;
    result.push(n);
  }
  return result;
}

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const cjk = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(trimmed);
  const divisor = cjk ? 3 : 4;
  return Math.ceil(trimmed.length / divisor);
}

function estimateNodeTokens(node: APCLiteNode): number {
  let tokens = estimateTokens(node.text ?? '');
  if (node.link) tokens += estimateTokens(node.link.href);
  if (node.image?.alt) tokens += estimateTokens(node.image.alt);
  return Math.max(tokens, 1);
}
