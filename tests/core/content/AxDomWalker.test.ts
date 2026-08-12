// tests/core/content/AxDomWalker.test.ts — AxDomWalker behavior pins (D-4a-12/13/20).
// 1. Password values are OMITTED AT CAPTURE (D-4a-20) — isPassword:true + no value key.
// 2. Interaction flags (clickable/editable/focusable/disabled) are emitted.
// 3. Geometry is NEVER populated in v0.1 (D-4a-13 — no getBoundingClientRect).
// 4. Links + table structure are captured (D-4a-12 roles/text/hierarchy/links/tables).
// Default jsdom-align env (document required) — same env as ContentScriptHost.test.ts.
import { describe, expect, it } from 'vitest';
import { walkAxDom } from '@/core/content/AxDomWalker';
import type { RawNode } from '@/core/extraction/apcLite.types';

/** Deep-search a RawNode tree for the first node matching `pred`. */
function findNode(nodes: RawNode[], pred: (n: RawNode) => boolean): RawNode | undefined {
  for (const n of nodes) {
    if (pred(n)) return n;
    if (n.children) {
      const hit = findNode(n.children, pred);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Flatten a RawNode tree (every node, pre-order). */
function flatten(nodes: RawNode[]): RawNode[] {
  const out: RawNode[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children) out.push(...flatten(n.children));
  }
  return out;
}

function setBody(html: string): void {
  document.body.innerHTML = html;
}

describe('AxDomWalker (D-4a-12/13/20)', () => {
  it('omits password values at capture — isPassword:true and NO value key (D-4a-20)', () => {
    setBody(`
      <form>
        <input type="password" name="pw" value="secret">
        <input type="text" name="visible" value="shown">
      </form>
    `);
    const nodes = walkAxDom(document);

    const password = findNode(nodes, (n) => n.form?.control?.isPassword === true);
    const text = findNode(nodes, (n) => n.form?.control?.fieldName === 'visible');

    expect(password).toBeDefined();
    const passwordControl = password!.form!.control!;
    expect(passwordControl.isPassword).toBe(true);
    // Capture-time invariant: the value key must not exist — never captured, not redacted.
    expect('value' in passwordControl).toBe(false);
    expect(passwordControl.value).toBeUndefined();

    expect(text).toBeDefined();
    const textControl = text!.form!.control!;
    expect(textControl.isPassword).toBeFalsy();
    expect(textControl.value).toBe('shown');
  });

  it('emits interaction flags — clickable links/buttons, editable inputs, disabled controls', () => {
    setBody(`
      <a href="https://example.com/help">Help</a>
      <button type="button">Go</button>
      <input type="text" value="editable">
      <button type="button" disabled>Disabled</button>
    `);
    const nodes = walkAxDom(document);

    const link = findNode(nodes, (n) => n.role === 'link');
    const button = findNode(nodes, (n) => n.role === 'button' && n.text === 'Go');
    const input = findNode(nodes, (n) => n.role === 'input');
    const disabled = findNode(nodes, (n) => n.role === 'button' && n.text === 'Disabled');

    expect(link?.interaction?.clickable).toBe(true);
    expect(button?.interaction?.clickable).toBe(true);
    expect(input?.interaction?.editable).toBe(true);
    expect(disabled?.interaction?.disabled).toBe(true);
    expect(disabled?.interaction?.clickable).toBe(true);
  });

  it('never populates geometry (D-4a-13 — no field, no getBoundingClientRect)', () => {
    setBody('<h1>Title</h1><p>Body text with some content.</p>');
    const nodes = walkAxDom(document);
    const all = flatten(nodes);
    expect(all.length).toBeGreaterThan(0);
    for (const n of all) {
      expect('geometry' in n).toBe(false);
      expect(n.geometry).toBeUndefined();
    }
  });

  it('captures links and table structure (D-4a-12)', () => {
    setBody(`
      <table>
        <tr><th>Name</th><th>Age</th></tr>
        <tr><td>Ada</td><td>36</td></tr>
      </table>
      <a href="https://example.com/docs" rel="nofollow">Docs</a>
    `);
    const nodes = walkAxDom(document);

    const link = findNode(nodes, (n) => n.role === 'link');
    expect(link?.link?.href).toBe('https://example.com/docs');
    expect(link?.link?.rel).toBe('nofollow');

    const table = findNode(nodes, (n) => n.role === 'table');
    expect(table).toBeDefined();
    const rows = table!.children?.filter((c) => c.role === 'row') ?? [];
    expect(rows.length).toBe(2);
    expect(rows[0]!.children?.some((c) => c.role === 'columnheader' && c.text === 'Name')).toBe(true);
    expect(rows[1]!.children?.some((c) => c.role === 'cell' && c.text === 'Ada')).toBe(true);
  });
});
