import type {
  ProviderValidationPort,
  ProviderValidationResult,
} from '../ports/providerValidationPort';

/**
 * Deterministic fixture validation adapter (D-05).
 *
 * RED-half skeleton: the selector → result map and the adapter body land in
 * this task's GREEN half. The module exists here so the suite collects and
 * each case fails on its own assertion rather than as one module-load crash.
 */

/** The six D-05 fixture cases, one per UI-SPEC validation-matrix row. */
export type FixtureValidationSelector =
  | 'success'
  | 'invalid-credential'
  | 'provider-unavailable'
  | 'network-unavailable'
  | 'cancelled'
  | 'unexpected-failure';

export const FIXTURE_VALIDATION_SELECTORS: readonly FixtureValidationSelector[] = [
  'success',
  'invalid-credential',
  'provider-unavailable',
  'network-unavailable',
  'cancelled',
  'unexpected-failure',
];

export function createFixtureValidationPort(
  _selector: FixtureValidationSelector,
): ProviderValidationPort {
  return {
    validate: async () => undefined as unknown as ProviderValidationResult,
  };
}
