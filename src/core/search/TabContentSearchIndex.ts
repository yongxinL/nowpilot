/**
 * TabContentSearchIndex — ephemeral MiniSearch index over open-tab content.
 *
 * Built fresh per `search-tabs` call (mirrors MiniSearchIndex.ts's shape,
 * fields ['title','markdown']) rather than persisted — the set of open tabs
 * and their content changes too often between calls to justify caching an
 * index across calls.
 */
import MiniSearch from 'minisearch';

export interface TabSearchDoc {
  /** Tab ID as a string (MiniSearch id field requirement) */
  id: string;
  title: string;
  markdown: string;
}

export class TabContentSearchIndex {
  private index: MiniSearch<TabSearchDoc>;

  constructor(docs: TabSearchDoc[]) {
    this.index = new MiniSearch<TabSearchDoc>({
      fields: ['title', 'markdown'],
      storeFields: ['id', 'title'],
      searchOptions: {
        boost: { title: 2 },
        prefix: true,
        fuzzy: 0.2,
      },
      idField: 'id',
    });
    this.index.addAll(docs);
  }

  search(query: string, limit = 20): Array<{ id: string; title: string; score: number }> {
    return this.index
      .search(query, { prefix: true, fuzzy: 0.2 })
      .slice(0, limit) as unknown as Array<{ id: string; title: string; score: number }>;
  }
}
