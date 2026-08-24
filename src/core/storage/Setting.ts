/**
 * Setting<T> — declare-now serialized-write utility (02-04 Plan, Task 2;
 * planner discretion per 02-CONTEXT.md lines 68-72).
 *
 * The spec §13 "never write two Setting<T> keys concurrently" rule is
 * encoded at the type level by composing the underlying storage call
 * onto a module-level promise chain. Callers always `await` the
 * returned `Promise<void>` — overlapping calls are serialized in
 * FIFO order. No production consumer in Phase 2; this ships as a
 * declare-now affordance to be populated by the owning phases.
 *
 * Scope: this is the TYPED-LEVEL §13 guarantee. The actual underlying
 * store is injected by the caller — Phase 2 only specifies the seam.
 * Phase 7 (or whichever owning phase wires the real Setting<T>
 * consumer) supplies the chrome.storage.local back-end.
 */

export interface SettingStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Module-level queue. Every call to `Setting.<verb>` is appended; the
 * next call awaits the previous one's settlement. This guarantees that
 * overlapping writes to the same key never interleave.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

export interface SettingHandle<T> {
  get(): Promise<T | undefined>;
  set(value: T): Promise<void>;
  delete(): Promise<void>;
}

/**
 * Build a typed Setting handle bound to a backing `SettingStore` and a
 * stable key. All operations on the returned handle serialize through
 * the module-level queue.
 */
export function defineSetting<T>(
  store: SettingStore,
  key: string,
): SettingHandle<T> {
  return {
    get() {
      return enqueue(() => store.get<T>(key));
    },
    set(value: T) {
      return enqueue(() => store.set<T>(key, value));
    },
    delete() {
      return enqueue(() => store.delete(key));
    },
  };
}

/**
 * Test-only seam — clears the module queue between tests so a stuck
 * promise does not bleed across cases.
 */
export function __resetSettingQueue(): void {
  queue = Promise.resolve();
}
