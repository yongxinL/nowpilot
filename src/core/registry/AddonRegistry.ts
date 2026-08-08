// src/core/registry/AddonRegistry.ts — the add-on registry (WSPC-04: registers
// zero add-ons in Phase 1; the addon ecosystem arrives in Phase 8). AddonEntry is
// the §8.6 base shape — the full addon manifest (scope, urlPatterns,
// contextExtractor, skills, prompts, sidePanelPages, standalonePages,
// addonSettings, keymap per §9.4) lands in Phase 8; this stub keeps the
// Phase-1 contract minimal. Extends the generic Registry base: idempotent
// register, synchronous Map ops, never throws.
import { Registry } from '@/core/registry/Registry';

/** §8.6 base add-on shape (full manifest lands in Phase 8 — stub noted here). */
export interface AddonEntry {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  settings?: Record<string, unknown>;
  permissions?: string[];
}

export class AddonRegistry extends Registry<AddonEntry> {}

let singleton: AddonRegistry | null = null;

/**
 * Lazy singleton. WSPC-04: Phase 1 registers ZERO add-ons — the registry starts
 * empty and add-ons register at startup in Phase 8.
 */
export function getAddonRegistry(): AddonRegistry {
  if (singleton === null) {
    singleton = new AddonRegistry();
  }
  return singleton;
}
