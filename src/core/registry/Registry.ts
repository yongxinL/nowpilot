// src/core/registry/Registry.ts — the generic WSPC-04 registry base (§18
// canonical file; the shape every registry in the phase set extends). Idempotent
// register (re-registering the same id replaces atomically, logged silent:true),
// synchronous Map ops (concurrency-safe by construction — no async races; callers
// may register from any context), and a register() that never throws (Golden Rule
// 9): an invalid entry is logged with REGISTRY_INIT and skipped.
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

export class Registry<T extends { id: string }> {
  protected items = new Map<string, T>();

  /** Idempotent — re-registering an existing id replaces it atomically. */
  register(item: T): void {
    if (!item || typeof item.id !== 'string' || item.id.length === 0) {
      debugLog(ERROR_CODES.REGISTRY_INIT, 'skipping registry entry with invalid id', {
        module: 'Registry',
        extra: { id: item?.id },
      });
      return;
    }
    if (this.items.has(item.id)) {
      debugLog(ERROR_CODES.REGISTRY_INIT, `re-registering registry entry ${item.id}`, {
        silent: true,
        module: 'Registry',
      });
    }
    this.items.set(item.id, item);
  }

  unregister(id: string): void {
    this.items.delete(id);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  list(): T[] {
    return [...this.items.values()];
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  clear(): void {
    this.items.clear();
  }
}
