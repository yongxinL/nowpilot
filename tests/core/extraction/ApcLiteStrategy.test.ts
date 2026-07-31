import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ApcLiteStrategy } from '../../../src/core/extraction/strategies/ApcLiteStrategy';
import { APCLiteDocumentSchema } from '../../../src/core/extraction/apcLite.types';
import { serializePage } from '../../../src/core/content/DomSerializer';
import { PageContentService } from '../../../src/core/extraction/PageContentService';

/**
 * ApcLiteStrategy tests: jsdom provides the DOMParser the strategy uses to
 * construct the DOM, then the walk builds the APCLiteNode tree which is
 * validated against the Zod schemas from apcLite.types.ts.
 */

const FIXTURE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Actionable Fixture</title>
</head>
<body>
  <nav aria-label="Primary navigation">
    <ul>
      <li><a href="https://example.com/home" aria-current="page">Home</a></li>
      <li><a href="https://example.com/about">About</a></li>
    </ul>
  </nav>
  <main>
    <h1>Fixture Page</h1>
    <form>
      <input type="text" id="search" placeholder="Search…" data-testid="search-input">
      <input type="password" id="pw" value="hunter2-secret">
      <input type="checkbox" id="opt-in" checked>
      <select id="sort">
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
      </select>
      <textarea id="notes" aria-label="Notes"></textarea>
      <button type="submit" id="apply" aria-expanded="false" data-action="apply-filters">Apply</button>
    </form>
  </main>
</body>
</html>`;

let sendMessageMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sendMessageMock = vi.fn();
  (globalThis as any).chrome = {
    tabs: { sendMessage: sendMessageMock, onUpdated: { addListener: vi.fn() } },
  };
});

const strategy = new ApcLiteStrategy();

describe('ApcLiteStrategy', () => {
  it('canHandle returns true only for actionable mode', () => {
    expect(strategy.canHandle({ url: 'https://example.com', mode: 'actionable' })).toBe(true);
    expect(strategy.canHandle({ url: 'https://example.com', mode: 'default' })).toBe(false);
  });

  it('walks buttons, links and inputs into APCLiteNodes with role, geometry and interaction info', async () => {
    const result = await strategy.run({
      url: 'https://example.com',
      title: 'Actionable Fixture',
      mode: 'actionable',
      html: FIXTURE_HTML,
    });

    expect(result.source).toBe('apc-lite');
    expect(result.truncated).toBe(false);
    expect(result.approxTokens).toBeGreaterThan(0);
    expect(result.meta?.title).toBe('Actionable Fixture');
    expect(result.root?.role).toBe('document');

    // Flatten the tree for lookup.
    const nodes: Record<string, any> = {};
    const visit = (node: any, parent?: any) => {
      nodes[node.id] = { ...node, parent };
      for (const child of node.children ?? []) visit(child, node);
    };
    visit(result.root);

    const apply = nodes['apply'];
    expect(apply).toBeDefined();
    expect(apply.role).toBe('button');
    expect(apply.name).toBe('Apply');
    expect(apply.interaction?.clickable).toBe(true);
    expect(apply.interaction?.focusable).toBe(true);
    expect(apply.interaction?.expanded).toBe(false);
    expect(apply.geometry).toMatchObject({ x: 0, y: 0, width: 0, height: 0 });

    const search = nodes['search'];
    expect(search).toBeDefined();
    expect(search.role).toBe('textbox');
    expect(search.interaction?.editable).toBe(true);
    expect(search.interaction?.focusable).toBe(true);
    expect(search.attributes?.['data-testid']).toBe('search-input');
    expect(search.attributes?.placeholder).toBe('Search…');

    const optIn = nodes['opt-in'];
    expect(optIn).toBeDefined();
    expect(optIn.role).toBe('checkbox');
    expect(optIn.interaction?.clickable).toBe(true);

    expect(
      (Object.values(nodes) as any[]).some(
        (n) => n.role === 'link' && n.attributes?.href === 'https://example.com/home',
      ),
    ).toBe(true);
  });

  it('builds recursive children for nested semantic elements', async () => {
    const result = await strategy.run({
      url: 'https://example.com',
      title: 't',
      mode: 'actionable',
      html: FIXTURE_HTML,
    });

    const root = result.root!;
    const nav = root.children?.find((c) => c.role === 'navigation');
    expect(nav).toBeDefined();
    expect(nav?.name).toBe('Primary navigation');
    const list = nav?.children?.find((c) => c.role === 'list');
    expect(list).toBeDefined();
    const items = list?.children ?? [];
    expect(items.length).toBe(2);
    expect(items.every((i) => i.role === 'listitem')).toBe(true);
    expect(items[0].children?.[0].role).toBe('link');
    expect(items[0].children?.[0].attributes?.href).toBe('https://example.com/home');
  });

  it('captures ARIA attributes on nodes and records aria-expanded state', async () => {
    const result = await strategy.run({
      url: 'https://example.com',
      title: 't',
      mode: 'actionable',
      html: FIXTURE_HTML,
    });

    const flatten = (node: any): any[] => [
      node,
      ...(node.children ?? []).flatMap((c: any) => flatten(c)),
    ];
    const nodes = flatten(result.root);

    const nav = nodes.find((n) => n.role === 'navigation');
    expect(nav?.attributes?.['aria-label']).toBe('Primary navigation');

    const notes = nodes.find((n) => n.id === 'notes');
    expect(notes?.attributes?.['aria-label']).toBe('Notes');

    const apply = nodes.find((n) => n.id === 'apply');
    expect(apply?.attributes?.['data-action']).toBe('apply-filters');
    expect(apply?.attributes?.['aria-expanded']).toBe('false');
    expect(apply?.interaction?.expanded).toBe(false);
  });

  it('never captures password input values (D-02)', async () => {
    const result = await strategy.run({
      url: 'https://example.com',
      title: 't',
      mode: 'actionable',
      html: FIXTURE_HTML,
    });

    const flatten = (node: any): any[] => [
      node,
      ...(node.children ?? []).flatMap((c: any) => flatten(c)),
    ];
    const pw = flatten(result.root).find((n) => n.id === 'pw');
    expect(pw).toBeDefined();
    expect(pw.attributes?.value).toBeUndefined();
    expect(JSON.stringify(pw)).not.toContain('hunter2-secret');
  });

  it('validates the built tree with APCLiteDocumentSchema (passes valid, rejects malformed)', async () => {
    const result = await strategy.run({
      url: 'https://example.com',
      title: 't',
      mode: 'actionable',
      html: FIXTURE_HTML,
    });

    const documentNode = {
      type: 'document' as const,
      url: 'https://example.com',
      capturedAt: Date.now(),
      children: [result.root],
    };
    expect(APCLiteDocumentSchema.safeParse(documentNode).success).toBe(true);

    // Malformed: extra field — strictObject rejects unknown keys.
    expect(
      APCLiteDocumentSchema.safeParse({
        type: 'document',
        url: 'https://example.com',
        capturedAt: 0,
        children: [{ ...result.root, role: 'document', bogusField: true }],
      }).success,
    ).toBe(false);

    // Malformed: missing required role.
    expect(
      APCLiteDocumentSchema.safeParse({
        type: 'document',
        url: 'https://example.com',
        capturedAt: 0,
        children: [{ id: result.root!.id, children: result.root!.children }],
      }).success,
    ).toBe(false);
  });

  it('returns a minimal tree for an empty document', async () => {
    const result = await strategy.run({
      url: 'https://example.com',
      title: 'Empty',
      mode: 'actionable',
      html: '<!DOCTYPE html><html><head><title>Empty</title></head><body></body></html>',
    });

    expect(result.source).toBe('apc-lite');
    expect(result.root?.role).toBe('document');
    expect(result.root?.name).toBe('Empty');
    expect(result.root?.children).toBeUndefined();
    expect(result.truncated).toBe(false);
  });

  it('bounds recursion depth on deeply nested DOM (T-04a-08) without crashing', async () => {
    const depth = 2000;
    const html = `<!DOCTYPE html><html><body>${'<div role="group">'.repeat(depth)}x${'</div>'.repeat(depth)}</body></html>`;

    const result = await strategy.run({
      url: 'https://example.com',
      title: 'Deep',
      mode: 'actionable',
      html,
    });

    expect(result.truncated).toBe(true); // depth limit hit

    // The tree must be a finite chain no deeper than MAX_DEPTH + root + 1.
    let chainLength = 0;
    let node: any = result.root;
    while (node?.children?.length) {
      chainLength += 1;
      node = node.children[0];
      expect(chainLength).toBeLessThanOrEqual(102);
    }
    expect(chainLength).toBeGreaterThan(0);
  });

  it('throws when no HTML is provided', async () => {
    await expect(
      strategy.run({ url: 'https://example.com', title: 't', mode: 'actionable' }),
    ).rejects.toThrow(/no HTML/i);
  });
});

describe('PageContentService mode=actionable', () => {
  it('extracts via ApcLiteStrategy only and returns PageContext with apcLiteTree', async () => {
    const dom = new JSDOM(FIXTURE_HTML, { url: 'https://example.com' });
    sendMessageMock.mockResolvedValue(serializePage(dom.window.document));
    const service = new PageContentService(); // full three-strategy registry

    const result = await service.extract(1, 'actionable', 'https://example.com');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok result');
    expect(result.pageContext.mode).toBe('actionable');
    if (result.pageContext.mode !== 'actionable') throw new Error('expected actionable mode');
    expect(result.pageContext.apcLiteTree.role).toBe('document');
    expect(result.pageContext.source).toBe('apc-lite');
    expect(result.pageContext.url).toBe('https://example.com/'); // jsdom normalizes the URL
    // The actionable PageContext must survive the serializer's Zod boundary.
    expect(result.pageContext.truncated).toBe(false);
    expect(result.pageContext.extractionLevel).toBe('full');
  });
});
