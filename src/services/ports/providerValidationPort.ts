import type { ProviderId } from '../../types';

/**
 * The canonical provider-validation failure codes.
 *
 * These four are the registry's own identifiers (`PRODUCT_SPEC` §21.6 and
 * Appendix C.2) — Phase 1 invents no new error identifier (D-05). The fixture
 * disclosure is carried by the `deferred.reasonFixture` marker copy, never by
 * a code: an invented `PROVIDER_RUNTIME_NOT_READY`-style identifier would make
 * the fixture-backed nature look like a provider runtime failure.
 */
export type ProviderValidationErrorCode =
  | 'PROVIDER_AUTH'
  | 'PROVIDER_5XX'
  | 'NETWORK'
  | 'PROVIDER_CHECK_FAILED';

/** Runtime membership of the canonical code set — one source, no parallel list. */
export const PROVIDER_VALIDATION_ERROR_CODES: readonly ProviderValidationErrorCode[] = [
  'PROVIDER_AUTH',
  'PROVIDER_5XX',
  'NETWORK',
  'PROVIDER_CHECK_FAILED',
];

/**
 * The outcome of one validation attempt.
 *
 * A cancellation is its own member: `{ ok: false, cancelled: true }` carries
 * **no** code, so no caller can read a cancelled attempt as either a success or
 * a typed failure (UI-SPEC § Validation state matrix).
 */
export type ProviderValidationResult =
  | { ok: true }
  | { ok: false; code: ProviderValidationErrorCode }
  | { ok: false; cancelled: true };

/**
 * The cancellation guard. A cancelled attempt is neither a success nor a typed
 * failure, so callers must branch on this predicate rather than reading `code`
 * from a union member that does not carry one.
 */
export function isValidationCancelled(
  result: ProviderValidationResult,
): result is { ok: false; cancelled: true } {
  return !result.ok && 'cancelled' in result;
}

/** The validation input. The credential exists here and nowhere persisted (D-08). */
export interface ProviderValidationInput {
  providerId: ProviderId;
  credential: string;
  signal?: AbortSignal;
}

/**
 * Phase-3 port: `Requester` / `ProviderRouter` own the real implementation
 * (real validation, cancellation, fallback and the canonical error mapping).
 *
 * Phase 1 is **fixture-backed**: `createFixtureValidationPort` is the only
 * implementation in the repository and it performs no network request. The
 * onboarding flow depends on this interface, so Phase 3 swaps the adapter
 * without redesigning the component (D-05).
 */
export interface ProviderValidationPort {
  validate(input: ProviderValidationInput): Promise<ProviderValidationResult>;
}
