// src/core/ai/ProviderRegistry.ts — the D-07 gate primitive (01-CONTEXT D-07),
// EXTENDED IN PLACE for Phase 3 (01-CONTEXT B3, R-1; D-21). Phase 1 shipped a
// minimal in-memory registry tracking the ACTIVE provider id so the gate renders
// onboarding → disabled surface. Phase 3 adds provider config presence
// (registerProvider/getProviderInfo), the PROVIDER_KEY_UNREADABLE error-emission
// half (markProviderKeyUnreadable → enabled:false, treated as unconfigured; no
// auto-wipe, no auto-regenerate — 02-CONTEXT D-04), and feeds ExecutorService's
// get-provider-info tool (03-04) + the surface-mount wiring (03-09). This is the
// canonical AI home (B3, R-1) — it must NOT be duplicated under core/providers/.
// Invalid input logs REGISTRY_INIT and never throws (Golden Rule 9). The module
// stays dependency-free (Pitfall 4) — it imports only core/error + type-only
// types; vault reads happen in the wiring layer and the typed PROVIDER_KEY_UNREADABLE
// emission crosses that boundary (D-21). No zustand/react imports (grep + test gate).
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

import type { ProviderConfig, ProviderId } from './types';

export type ProviderRegistryListener = () => void;

/**
 * D-21: vault-safe provider snapshot stored by the registry. The apiKey is
 * NEVER retained (R-10/T-03-02-01) — the registry never touches the vault
 * (Pitfall 4); `keyUnreadable` marks the PROVIDER_KEY_UNREADABLE single state
 * (decrypt failure / cleared installSecret / tampered ciphertext — all one).
 */
export interface RegistryProviderInfo {
  id: ProviderId;
  label: string;
  /** §10.2: customBaseURL ?? baseURL, computed once at registration. */
  resolvedBaseURL: string;
  models: string[];
  contextWindow: number;
  supportsTools: boolean;
  enabled: boolean;
  priority: number;
  lastValidated?: number;
  keyUnreadable: boolean;
}

export class ProviderRegistry {
  private activeProviderId: string | undefined;
  private providers = new Map<string, RegistryProviderInfo>();
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
      } catch (err) {
        // A broken listener must never break the registry (Golden Rule 9) — but
        // the failure is logged so it stays observable.
        debugLog(ERROR_CODES.EVT_HANDLER, 'ProviderRegistry listener error', {
          error: err instanceof Error ? err : undefined,
          module: 'ProviderRegistry',
        });
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

  /**
   * D-21: register (or re-register) a provider config. Sanitizes the snapshot
   * (apiKey stripped, R-10), computes resolvedBaseURL once (§10.2), and flips
   * the D-07 gate (last registration wins, registerActiveProvider precedent).
   * Unknown ids are rejected (the four-ID rule, §0.2) and logged — never thrown.
   */
  registerProvider(config: ProviderConfig): void {
    if (typeof config !== 'object' || config === null || !isProviderId(config.id)) {
      debugLog(ERROR_CODES.REGISTRY_INIT, 'skipping invalid provider config', {
        module: 'ProviderRegistry',
        extra: {
          providerId: typeof config === 'object' && config !== null ? config.id : undefined,
        },
      });
      return;
    }
    this.providers.set(config.id, {
      id: config.id,
      label: config.label,
      // §10.2: resolvedBaseURL = customBaseURL ?? baseURL, once at construction.
      resolvedBaseURL: config.customBaseURL ?? config.baseURL,
      models: config.models,
      contextWindow: config.contextWindow,
      supportsTools: config.supportsTools,
      enabled: config.enabled,
      priority: config.priority,
      lastValidated: config.lastValidated,
      keyUnreadable: false, // a fresh registration is a fresh key (user-driven, not auto)
    });
    this.activeProviderId = config.id;
    this.notify();
    debugLog(ERROR_CODES.REGISTRY_INIT, `provider config registered: ${config.id}`, {
      silent: true,
      module: 'ProviderRegistry',
    });
  }

  /**
   * D-21: the single transition for decrypt-failure / cleared installSecret /
   * tampered-ciphertext (all one state). Marks the provider disabled
   * (enabled:false, treated as unconfigured) so the router never calls it
   * (T-03-02-03) and emits the typed PROVIDER_KEY_UNREADABLE code across the
   * wiring boundary. NO auto-wipe, NO auto-regenerate (02-CONTEXT D-04): the
   * entry is kept (or created as a disabled marker when decrypt preceded any
   * registerProvider, per the 03-09 wiring order) so get-provider-info and the
   * Phase-7 UI gate can distinguish "unconfigured" from "key unreadable".
   */
  markProviderKeyUnreadable(providerId: string): void {
    if (!isProviderId(providerId)) {
      debugLog(ERROR_CODES.REGISTRY_INIT, 'skipping unreadable mark for unknown provider id', {
        module: 'ProviderRegistry',
        extra: { providerId },
      });
      return;
    }
    const existing = this.providers.get(providerId);
    this.providers.set(providerId, {
      id: providerId,
      label: existing?.label ?? providerId,
      resolvedBaseURL: existing?.resolvedBaseURL ?? '',
      models: existing?.models ?? [],
      contextWindow: existing?.contextWindow ?? 0,
      supportsTools: existing?.supportsTools ?? false,
      enabled: false, // treated as unconfigured — the router never calls it
      priority: existing?.priority ?? 0,
      lastValidated: existing?.lastValidated,
      keyUnreadable: true,
    });
    debugLog(
      ERROR_CODES.PROVIDER_KEY_UNREADABLE,
      `provider key unreadable — disabled: ${providerId}`,
      {
        module: 'ProviderRegistry',
        extra: { providerId },
      },
    );
    this.notify();
  }

  /** D-21: snapshot for one provider (undefined when never registered/marked). */
  getProviderInfo(providerId: ProviderId): RegistryProviderInfo | undefined {
    return this.providers.get(providerId);
  }

  /** Full snapshot for ExecutorService's get-provider-info (03-04) + wiring (03-09). */
  getProviderInfos(): RegistryProviderInfo[] {
    return [...this.providers.values()];
  }

  /**
   * D-07 gate predicate — true once any USABLE provider is configured. D-21:
   * a provider whose entry is keyUnreadable or user-disabled is treated as
   * unconfigured, so the gate closes and the router never calls a broken
   * provider (T-03-02-03).
   */
  hasActiveProvider(): boolean {
    if (this.activeProviderId === undefined) return false;
    const entry = this.providers.get(this.activeProviderId);
    if (entry && (entry.keyUnreadable || !entry.enabled)) return false;
    return true;
  }

  getActiveProvider(): string | undefined {
    return this.activeProviderId;
  }

  /** Test/UAT isolation — drop all registered providers (starts empty again). */
  clear(): void {
    this.activeProviderId = undefined;
    this.providers.clear();
    this.notify();
  }
}

/** The four-ID rule (§0.2): provider ids are exactly the four canonical IDs. */
function isProviderId(value: unknown): value is ProviderId {
  return value === 'openai' || value === 'anthropic' || value === 'gemini' || value === 'ollama';
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
