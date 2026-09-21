import type {
  ProviderValidationPort,
  ProviderValidationResult,
} from '../ports/providerValidationPort';

/**
 * Deterministic fixture validation adapter (D-05).
 *
 * Phase 1's validation is fixture-backed: this module is a plain data map plus
 * a one-method adapter. It imports no provider SDK, performs no network
 * request, reads no storage and touches no Chrome API — the suite proves the
 * first two with a source scan and a zero-call global spy.
 */

/** The six D-05 fixture cases — one per UI-SPEC validation-matrix row. */
export type FixtureValidationSelector =
  | 'success'
  | 'invalid-credential'
  | 'provider-unavailable'
  | 'network-unavailable'
  | 'cancelled'
  | 'unexpected-failure';

function frozen(result: ProviderValidationResult): ProviderValidationResult {
  return Object.freeze(result);
}

/**
 * The canned result per selector.
 *
 * Every failure maps to a canonical code (`PRODUCT_SPEC` §21.6 / Appendix C.2)
 * and the cancelled case maps to the cancellation member, which carries **no**
 * code — a cancelled attempt is neither a success nor a typed failure.
 */
const FIXTURE_RESULTS: Readonly<Record<FixtureValidationSelector, ProviderValidationResult>> = {
  success: frozen({ ok: true }),
  'invalid-credential': frozen({ ok: false, code: 'PROVIDER_AUTH' }),
  'provider-unavailable': frozen({ ok: false, code: 'PROVIDER_5XX' }),
  'network-unavailable': frozen({ ok: false, code: 'NETWORK' }),
  cancelled: frozen({ ok: false, cancelled: true }),
  'unexpected-failure': frozen({ ok: false, code: 'PROVIDER_CHECK_FAILED' }),
};

/**
 * Build the Phase-1 validation port for one fixture selector.
 *
 * `validate` never inspects the credential — it cannot echo, hash or retain a
 * value it never reads — and it honours an aborted `signal` by returning the
 * cancellation member (a real Phase-3 implementation must do the same). The
 * result is deep-equal across calls for the same selector: the adapter reads no
 * clock and no randomness.
 */
export function createFixtureValidationPort(
  selector: FixtureValidationSelector,
): ProviderValidationPort {
  return {
    validate: async ({ signal }) =>
      signal?.aborted ? FIXTURE_RESULTS.cancelled : FIXTURE_RESULTS[selector],
  };
}
