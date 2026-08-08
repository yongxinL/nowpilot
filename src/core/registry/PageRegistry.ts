// src/core/registry/PageRegistry.ts — content-side page-context tracker (W-7
// reconciliation: a phase-owned content-side registry NOT in the §18 create list
// — PageContext has no stable string id, so this is a tab-keyed Map, not a
// Registry<T extends { id: string }> extension). Fed by content scripts via
// PageContextBridge (01-07 Task 3): upsert/get/remove/list/clear are synchronous
// Map ops — idempotent and concurrent-safe by construction. Imports PageContext
// from its canonical 01-02 home (R-1 — never relocate).
import type { PageContext } from '@/core/content/PageContext';

export class PageRegistry {
  private pages = new Map<number, PageContext>();

  /** Idempotent — upserting the same tab replaces atomically. */
  upsert(tabId: number, page: PageContext): void {
    this.pages.set(tabId, page);
  }

  get(tabId: number): PageContext | undefined {
    return this.pages.get(tabId);
  }

  remove(tabId: number): void {
    this.pages.delete(tabId);
  }

  list(): Array<{ tabId: number; page: PageContext }> {
    return [...this.pages.entries()].map(([tabId, page]) => ({ tabId, page }));
  }

  clear(): void {
    this.pages.clear();
  }
}
