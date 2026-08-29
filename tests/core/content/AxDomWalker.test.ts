// AxDomWalker tests — content-script-side RawNode walker proof (06-02).
//
// Covers the five §18 behavior groups: structural walk (roles/text/interaction/
// links/tables), password omission at capture (D-86/D-90), non-password value
// capture, geometry never populated (v0.1 §26.6), and the Pitfall 8 import
// boundary (no zod / no panel-side extraction imports).
//
// The walker runs on the LIVE jsdom document — jsdom provides the Element
// surface (tagName, getAttribute, children, textContent, .href resolution
// against document.baseURI) the ISOLATED-world walker depends on.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { walkDom, isPasswordControl } from '@/core/content/AxDomWalker';
import type { RawNode } from '@/core/content/AxDomWalker';

/** Depth-first collect of every node in the tree (for tree-wide invariants). */
function collect(node: RawNode): RawNode[] {
  return [node, ...(node.children ?? []).flatMap(collect)];
}

/** Deep find by predicate over the whole tree. */
function findNode(node: RawNode, predicate: (n: RawNode) => boolean): RawNode | undefined {
  if (predicate(node)) return node;
  for (const child of node.children ?? []) {
    const hit = findNode(child, predicate);
    if (hit) return hit;
  }
  return undefined;
}

describe('AxDomWalker', () => {
  it('walks a structural fixture into a RawNode tree with roles/text/interaction/links/tables', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <h1>ServiceNow Password Reset</h1>
      <p>Step-by-step guide for resetting user passwords.</p>
      <a href="/kb/incident-management/123">Incident Management</a>
      <button type="button">Refresh</button>
      <table>
        <tbody>
          <tr><td>State</td><td>In Progress</td></tr>
        </tbody>
      </table>
    `;

    const tree = walkDom(container);

    // Root: synthesized stable path id + default region role.
    expect(tree.id).toBe('n1');
    expect(tree.role).toBe('region');

    const heading = findNode(tree, (n) => n.role === 'heading');
    expect(heading?.text).toBe('ServiceNow Password Reset');
    // Heading level is carried in `type` (h1..h6) for the panel-side normalizer.
    expect(heading?.type).toBe('h1');

    const link = findNode(tree, (n) => n.role === 'link');
    expect(link?.text).toBe('Incident Management');
    // The live document resolves the relative href against its base URI.
    expect(link?.link?.href).toMatch(/\/kb\/incident-management\/123$/);
    expect(link?.interaction?.clickable).toBe(true);
    expect(link?.interaction?.focusable).toBe(true);

    const button = findNode(tree, (n) => n.role === 'button');
    expect(button?.interaction?.clickable).toBe(true);

    const table = findNode(tree, (n) => n.role === 'table');
    expect(table).toBeDefined();
    const rows = collect(table!).filter((n) => n.role === 'row');
    const cells = collect(table!).filter((n) => n.role === 'cell');
    expect(rows).toHaveLength(1);
    expect(cells).toHaveLength(2);
    expect(cells.map((c) => c.text)).toEqual(['State', 'In Progress']);

    // Children ids follow the deterministic DFS index (n1.1, n1.2, …).
    const childIds = (tree.children ?? []).map((c) => c.id);
    expect(childIds[0]).toBe('n1.1');
    expect(childIds[1]).toBe('n1.2');
  });

  it('omits the value of a password control at capture (isPassword ⇒ no value key)', () => {
    const container = document.createElement('div');
    container.innerHTML = `<input type="password" name="password" value="hunter2">`;

    const tree = walkDom(container);
    const input = findNode(tree, (n) => n.form?.control !== undefined)!;

    expect(input.form?.control?.fieldName).toBe('password');
    expect(input.form?.control?.fieldType).toBe('password');
    expect(input.form?.control?.isPassword).toBe(true);
    // D-86/D-90 invariant: the value key must NOT be emitted at all.
    expect('value' in (input.form?.control ?? {})).toBe(false);
  });

  it('captures the value of a non-password text control', () => {
    const container = document.createElement('div');
    container.innerHTML = `<input type="text" name="short_description" value="Email delivery failed">`;

    const tree = walkDom(container);
    const input = findNode(tree, (n) => n.form?.control !== undefined)!;

    expect(input.form?.control?.fieldName).toBe('short_description');
    expect(input.form?.control?.fieldType).toBe('text');
    expect(input.form?.control?.isPassword).toBe(false);
    expect(input.form?.control?.value).toBe('Email delivery failed');
  });

  it('never populates geometry on any RawNode (v0.1, §26.6)', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <h2>Environment</h2>
      <p>Instance: dev123456.service-now.com</p>
      <a href="/nav_to.do">Navigator</a>
      <table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>
    `;

    const tree = walkDom(container);
    for (const node of collect(tree)) {
      expect('geometry' in node).toBe(false);
    }
  });

  it('keeps the bounded-walk guard: depth cap truncates and flags via onTruncated', () => {
    const container = document.createElement('div');
    container.innerHTML = `<div><div><p>deep</p></div></div>`;

    let truncated = false;
    const tree = walkDom(container, { maxDepth: 1, onTruncated: () => { truncated = true; } });

    expect(truncated).toBe(true);
    // Depth-1 walk: root → div child, but the grandchild p subtree is dropped.
    const inner = findNode(tree, (n) => n.role === 'region' && n.id === 'n1.1');
    expect(inner?.children ?? []).toHaveLength(0);
  });

  it('flags password controls via the exported heuristic', () => {
    const byType = document.createElement('input');
    byType.setAttribute('type', 'password');
    expect(isPasswordControl(byType)).toBe(true);

    const byName = document.createElement('input');
    byName.setAttribute('type', 'text');
    byName.setAttribute('name', 'user_password');
    expect(isPasswordControl(byName)).toBe(true);

    const plain = document.createElement('input');
    plain.setAttribute('type', 'text');
    plain.setAttribute('name', 'short_description');
    expect(isPasswordControl(plain)).toBe(false);
  });

  it('imports nothing but type-only envelope/sibling modules — no zod, no panel-side extraction (Pitfall 8)', () => {
    const source = readFileSync(new URL('../../../src/core/content/AxDomWalker.ts', import.meta.url), 'utf8');

    expect(source).not.toMatch(/from\s+['"]zod['"]/);
    expect(source).not.toMatch(/from\s+['"]@\/core\/extraction/);
    expect(source).not.toMatch(/from\s+['"]\.\.\/extraction/);
    expect(source).not.toMatch(/from\s+['"]\.\.\/\.\.\/extraction/);
    expect(source).not.toMatch(/from\s+['"]defuddle/);
  });
});