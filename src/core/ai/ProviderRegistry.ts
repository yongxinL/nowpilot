// src/core/ai/ProviderRegistry.ts — the D-07 gate primitive (01-CONTEXT D-07):
// a minimal in-memory registry tracking the ACTIVE provider id. Phase 1 ships
// NO real providers (the providers phase owns them) — the registry starts empty
// so the gate renders onboarding → disabled surface; UAT/browser tests may
// register a fake provider id to unlock the chat shell (registerActiveProvider
// is functional, not hardcoded — @implementation-tier stub per Golden Rule 10).
// This is the canonical AI home (B3, R-1): Phase 3 extends THIS exact file, it
// must NOT be duplicated under core/providers/. Invalid input logs REGISTRY_INIT
// and never throws (Golden Rule 9). The module stays dependency-free (Pitfall
// 4) — it imports only core/error.
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

export type ProviderRegistryListener = () => void;

export class ProviderRegistry {
  private activeProviderId: string | undefined;
  private listeners = new Set<ProviderRegistryListener>();

  /**
   * Subscribe to gate changes (T-1-18: the router re-evaluates on registry
   * change — no cached UI flag). Returns an unsubscribe function.
   */
  subscribe(listener: ProviderRegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        // A broken listener must never break the registry (Golden Rule 9).
      }
    }
  }

  /** Register the active provider id (idempotent — later registrations replace). */
  registerActiveProvider(providerId: string): void {
    if (typeof providerId !== 'string' || providerId.length === 0) {
      debugLog(ERROR_CODES.REGISTRY_INIT, 'skipping invalid active provider id', {
        module: 'ProviderRegistry',
        extra: { providerId },
      });
      return;
    }
    this.activeProviderId = providerId;
    this.notify();
    debugLog(ERROR_CODES.REGISTRY_INIT, `active provider registered: ${providerId}`, {
      silent: true,
      module: 'ProviderRegistry',
    });
  }

  /** D-07 gate predicate — true once any provider is configured. */
  hasActiveProvider(): boolean {
    return this.activeProviderId !== undefined;
  }

  getActiveProvider(): string | undefined {
    return this.activeProviderId;
  }

  /** Test/UAT isolation — drop the registered provider (starts empty again). */
  clear(): void {
    this.activeProviderId = undefined;
    this.notify();
  }
}

let singleton: ProviderRegistry | null = null;

/**
 * Lazy singleton (01-05/01-07 Registry precedent). Components read the gate via
 * the singleton — they never construct their own registry (T-1-18: one gate).
 */
export function getProviderRegistry(): ProviderRegistry {
  if (singleton === null) singleton = new ProviderRegistry();
  return singleton;
}
