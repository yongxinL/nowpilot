import MiniSearch from 'minisearch';
import type { UserMemoryFact } from '../memory/memoryTypes';

export class MiniSearchIndex {
  private index: MiniSearch;

  constructor() {
    this.index = new MiniSearch({
      fields: ['content', 'tags', 'category'],
      storeFields: [
        'id',
        'content',
        'category',
        'confidence',
        'source',
        'useCount',
        'updatedAt',
        'status',
      ],
      searchOptions: {
        boost: { content: 2, tags: 1.5 },
        prefix: true,
        fuzzy: 0.2,
      },
      idField: 'id',
    });
  }

  search(
    query: string,
    limit = 20,
  ): Array<{ id: string; content: string; score: number } & Partial<UserMemoryFact>> {
    return this.index
      .search(query, {
        prefix: true,
        fuzzy: 0.2,
      })
      .slice(0, limit) as unknown as Array<{
      id: string;
      content: string;
      score: number;
    } & Partial<UserMemoryFact>>;
  }

  addFact(fact: UserMemoryFact): void {
    this.index.add(fact as Record<string, unknown>);
  }

  replaceFact(fact: UserMemoryFact): void {
    this.index.replace(fact as Record<string, unknown>);
  }

  removeFact(id: string): void {
    this.index.discard(id);
  }

  rebuild(facts: UserMemoryFact[]): void {
    this.index.removeAll();
    this.index.addAll(facts as Record<string, unknown>[]);
  }
}

export const miniSearchIndex = new MiniSearchIndex();
