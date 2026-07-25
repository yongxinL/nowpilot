import type { APCLiteDocument } from './apcLite.types';

export class PageContentCache {
  private cache = new Map<number, APCLiteDocument>();
  private readonly MAX_ENTRIES = 20;

  get(tabId: number): APCLiteDocument | undefined {
    const doc = this.cache.get(tabId);
    if (doc && Date.now() - doc.extractedAt > 60_000) {
      this.cache.delete(tabId);
      return undefined;
    }
    return doc;
  }

  set(tabId: number, doc: APCLiteDocument): void {
    if (this.cache.size >= this.MAX_ENTRIES) {
      const oldest = this.cache.entries().next().value;
      if (oldest) this.cache.delete(oldest[0]);
    }
    this.cache.set(tabId, doc);
  }

  delete(tabId: number): void {
    this.cache.delete(tabId);
  }

  clear(): void {
    this.cache.clear();
  }
}
