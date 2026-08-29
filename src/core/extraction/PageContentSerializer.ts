// PageContentSerializer — pure functions, no side effects.
//
// serializeToPageContext: StrategyResult → canonical PageContext (spec
// 4346-4357). The raw payload HTML is NOT carried — it stays in the cache
// layer (06-03); the serializer emits the page-content contract only.
// apcTreeToMarkdown: APCLiteNode tree → deterministic structural markdown for
// the actionable path (consumed from 06-02 onward; the tree is not HTML, so
// no turndown).
import type { PageContext } from '../content/PageContext';
import type { APCLiteNode } from './apcLite.types';
import type { StrategyResult } from './strategies/IExtractionStrategy';

export interface SerializeToPageContextInput {
  url: string;
  origin: string;
  hostname: string;
  title: string;
  extractedAt: number;
  strategyResult: StrategyResult;
  mode: 'default' | 'actionable';
}

/** StrategyResult → PageContext (spec 4346-4357). meta carries only string
 * values (the PageContext contract); html is deliberately not carried. */
export function serializeToPageContext(input: SerializeToPageContextInput): PageContext {
  const { url, origin, hostname, title, extractedAt, strategyResult } = input;
  const meta: Record<string, string> = {};
  if (strategyResult.meta) {
    for (const [key, value] of Object.entries(strategyResult.meta)) {
      if (typeof value === 'string') meta[key] = value;
    }
  }
  return {
    url,
    origin,
    hostname,
    title,
    markdown: strategyResult.markdown,
    meta,
    extractedAt,
  };
}

/** Deterministic structural markdown renderer for the APCLiteNode tree:
 * headings from textStyle.level (h1-h6), paragraph text lines, links as
 * [text](href), form controls as labelled field lines, tables as pipe rows. */
export function apcTreeToMarkdown(root: APCLiteNode): string {
  const lines: string[] = [];
  renderNode(root, lines);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function renderNode(node: APCLiteNode, lines: string[]): void {
  const role = node.role;
  const level = node.textStyle?.level;

  if (role === 'heading' || (level !== undefined && level >= 1 && level <= 6)) {
    const headingLevel = Math.min(Math.max(level ?? 1, 1), 6);
    const text = node.text ?? '';
    lines.push(`${'#'.repeat(headingLevel)} ${text}`);
  } else if (role === 'link' || node.link) {
    const text = node.text ?? node.link?.href ?? '';
    lines.push(`[${text}](${node.link?.href ?? ''})`);
  } else if (role === 'form' || node.form?.control) {
    const control = node.form?.control;
    const name = node.form?.name ?? control?.fieldName ?? 'field';
    const type = control?.fieldType ? ` [${control.fieldType}]` : '';
    const value = control?.isPassword ? '(omitted)' : (control?.value ?? '');
    lines.push(`- ${name}${type}: ${value}`);
  } else if (role === 'table') {
    // Table container — rows render below; nothing emitted here.
  } else if (role === 'row') {
    const cells = (node.children ?? [])
      .filter((child) => child.role === 'cell' || child.role === 'columnheader' || child.role === 'header')
      .map((child) => child.text ?? '');
    lines.push(`| ${cells.join(' | ')} |`);
  } else if (node.text) {
    lines.push(node.text);
  }

  for (const child of node.children ?? []) {
    renderNode(child, lines);
  }
}