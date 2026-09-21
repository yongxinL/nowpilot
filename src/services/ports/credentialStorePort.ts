import type { ProviderId } from '../../types';

/**
 * Phase-2 port: secure credential storage (KeyVault / AES-GCM, migration,
 * re-entry UX) is Phase 2's work (D-07).
 *
 * Phase 1 ships the **interface only**: there is no implementation in this
 * repository and no Phase-1 call site. Secure persistence therefore cannot be
 * half-built here, and the onboarding flow reaches a credential store through
 * this type only when Phase 2 replaces its adapter.
 */
export interface CredentialStorePort {
  isConfigured(providerId: ProviderId): Promise<boolean>;
  store(
    providerId: ProviderId,
    credential: string,
  ): Promise<{ ok: true } | { ok: false; code: string }>;
}
