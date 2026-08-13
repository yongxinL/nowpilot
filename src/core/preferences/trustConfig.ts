// src/core/preferences/trustConfig.ts — D-4b-07/08 np_trust accessor (+1
// documented to §18 by 04b-01: not in the §18 Phase-4b create-list; RESEARCH
// Code Example 4 recommended path). The trust-source prefs are USER config
// (R-7) stored at chrome.storage.local key `np_trust` — registered area:'local'
// in Setting.ts (Task 2 of this plan; Pitfall 4: an unregistered key makes
// every settingRead silently fall back).
//
// Shape is agent discretion (D-4b-07): { page, notes, memory, tool_result }
// all-boolean. UI-SPEC binds behavior + all-true defaults only.
//
// Read-only accessor for the core pipeline (04b-04 ContextOptimizerInput.
// trustPrefs + 04b-05 TrustSettingsStore writer). Every read is
// TrustPrefsSchema-validated (GR-4/V5 inbound gate); an empty or invalid key
// logs ERROR_CODES.STORE_READ and falls back to DEFAULT_TRUST_PREFS — never a
// crash, never a source silently excluded (T-4b-06 safe-default degradation,
// personaConfig precedent). NEVER throws.
import { z } from 'zod';

import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { settingRead } from '@/core/storage/Setting';

/** §15.1 key — registered area:'local' at Setting.ts (Pitfall 4 closed). */
export const NP_TRUST_KEY = 'np_trust';

/** GR-4/V5 inbound gate — shape is discretion (D-4b-07); zod 3 API only. */
export const TrustPrefsSchema = z.object({
  page: z.boolean(),
  notes: z.boolean(),
  memory: z.boolean(),
  tool_result: z.boolean(),
});
export type TrustPrefs = z.infer<typeof TrustPrefsSchema>;

/** All-true safe default — no source silently excluded (D-4b-07/08). */
export const DEFAULT_TRUST_PREFS: TrustPrefs = {
  page: true,
  notes: true,
  memory: true,
  tool_result: true,
};

/**
 * D-4b-07/08: the Zod-gated np_trust read (personaConfig precedent). Stored
 * undefined → DEFAULT_TRUST_PREFS; TrustPrefsSchema failure → STORE_READ
 * debugLog (module + issueCount only — never the stored payload, R-10) then
 * DEFAULT_TRUST_PREFS; valid → parsed.data. NEVER throws — a tampered key
 * degrades to safe defaults (T-4b-06), never to a crash.
 */
export async function readTrustPrefs(): Promise<TrustPrefs> {
  const stored = await settingRead<unknown>(NP_TRUST_KEY, (v) => v, undefined);
  if (stored === undefined) {
    return DEFAULT_TRUST_PREFS;
  }
  const parsed = TrustPrefsSchema.safeParse(stored);
  if (!parsed.success) {
    debugLog(ERROR_CODES.STORE_READ, 'np_trust failed TrustPrefsSchema — using defaults', {
      module: 'trustConfig',
      extra: { issueCount: parsed.error.issues.length },
    });
    return DEFAULT_TRUST_PREFS;
  }
  return parsed.data;
}
