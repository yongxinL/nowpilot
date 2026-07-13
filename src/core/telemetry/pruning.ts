// =========================================================================
// pruning.ts — Tiered retention pruning with scheduled + debounced execution
//
// D-25: Hybrid retention (Time + Count), whichever exceeded first triggers pruning
// D-26: Tiered limits — transactions 30d/5000, normal traces 14d/2000, diag 7d/500, errors 30d/1000
// D-27: Failure-prioritized — failed/error records preserved, oldest successful pruned first
// D-29: Scheduled + Startup pruning — runs on startup and every 5 minutes
// D-33: Detailed success traces capped at 500, lightweight tx metadata retained longer
// D-36: Never blocks pipeline — runs asynchronously, debounced on transaction close
// =========================================================================

// Retention config constants (D-26)
export const TRANSACTION_MAX = 5000;
export const TRANSACTION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const NORMAL_TRACE_MAX = 2000;
export const NORMAL_TRACE_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
export const DIAGNOSTIC_TRACE_MAX = 500;
export const DIAGNOSTIC_TRACE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const ERROR_MAX = 1000;
export const ERROR_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// STUB — will implement in TDD GREEN phase

export async function pruneNow(): Promise<void> {
  // stub
}

export function scheduleDebouncedPrune(): void {
  // stub
}

export function startPruning(): void {
  // stub
}
