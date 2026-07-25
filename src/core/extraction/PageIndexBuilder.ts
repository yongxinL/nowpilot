import MiniSearch from 'minisearch';
import type { APCLiteDocument, APCLiteNode } from './apcLite.types';

interface PageSearchDoc {
  id: string;
  role: string;
  text: string;
  path: string;
}

const cache = new Map<string, MiniSearch<PageSearchDoc>>();

function flattenTextNodes(n: APCLiteNode, path: string[] = []): PageSearchDoc[] {
  const here = n.role === 'heading' && n.text ? [...path, n.text] : path;
  const out: PageSearchDoc[] = [];
  if (n.text) {
    out.push({
      id: n.id,
      role: n.role,
      text: n.text,
      path: here.join(' \u203A '),
    });
  }
  for (const c of n.children ?? []) {
    out.push(...flattenTextNodes(c, here));
  }
  return out;
}

export const PageIndexBuilder = {
  getOrBuild(doc: APCLiteDocument): MiniSearch<PageSearchDoc> {
    const key = `${doc.url}@${doc.extractedAt}`;
    if (cache.has(key)) return cache.get(key)!;

    const mini = new MiniSearch<PageSearchDoc>({
      fields: ['text', 'role', 'path'],
      storeFields: ['id', 'role', 'text', 'path'],
      searchOptions: {
        boost: { text: 2, role: 0.5 },
        fuzzy: 0.1,
        prefix: true,
      },
    });

    mini.addAll(flattenTextNodes(doc.root));
    cache.set(key, mini);

    if (cache.size > 30) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }

    return mini;
  },

  drop(keyPart: number | string): void {
    for (const k of cache.keys()) {
      if (k.includes(String(keyPart))) cache.delete(k);
    }
  },

  clear(): void {
    cache.clear();
  },
};
