import type { ProviderId } from '../../types';

/**
 * RED-half skeleton for the onboarding completion record (D-06 / D-07).
 *
 * The typed record, the total migration, the storage access and the
 * subscription land in this task's GREEN half; the module exists here so the
 * suite collects and each case fails on its own assertion.
 */

export const ONBOARDING_STORAGE_KEY = 'np_onboarding';
export const LEGACY_ONBOARDING_FLAG_KEY = 'onboardingComplete';
export const ONBOARDING_SCHEMA_VERSION = 1;

export interface OnboardingState {
  uiComplete: boolean;
  persona: string | null;
  providerId: ProviderId | null;
  schemaVersion: number;
  validationBacking: 'fixture' | 'provider';
}

export type OnboardingUnknownReason = 'missing' | 'incompatible' | 'unreadable';

export type OnboardingReadResult =
  | { status: 'ok'; state: OnboardingState }
  | { status: 'unknown'; reason: OnboardingUnknownReason };

export function shouldPresentOnboarding(result: OnboardingReadResult): boolean {
  return undefined as unknown as boolean;
}

export function migrateOnboardingState(
  persisted: unknown,
  version: unknown,
): OnboardingState | null {
  return undefined as unknown as OnboardingState | null;
}

export async function readOnboardingState(): Promise<OnboardingReadResult> {
  return undefined as unknown as OnboardingReadResult;
}

export async function writeOnboardingState(
  partial: Partial<OnboardingState>,
): Promise<OnboardingState> {
  return undefined as unknown as OnboardingState;
}

export async function deleteLegacyOnboardingFlag(): Promise<void> {
  return undefined;
}

export function subscribeToOnboardingState(
  listener: (result: OnboardingReadResult) => void,
): () => void {
  return () => {};
}
