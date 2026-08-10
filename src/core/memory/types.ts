// src/core/memory/types.ts — Source: PRODUCT_SPEC Appendix C lines 4541-4567
// (verbatim) / Appendix C.1 canonical-home note (line 4775: "UserPreferences and
// RetrievedMemory remain in @/core/memory/types"). P-3b: canonical home for
// RetrievedMemory + UserPreferences. R-1: single declaration — src/core/ai/types.ts
// imports (never re-declares) them; Phase-5 PreferenceMemoryStore/UserMemoryStore
// consume these same shapes.
import type { ProviderId } from '../ai/types';

export interface RetrievedMemory {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'pattern';
  tags: string[];
  score: number;
}

export interface UserPreferences {
  responseStyle: 'concise' | 'balanced' | 'detailed';
  preferredLanguage: string;
  preferStructuredOutput: boolean;
  allowCloudFallbackFromLocal: boolean;
  defaultProviderId?: ProviderId;
  toolAutonomy: 'ask_every_time' | 'allow_safe_tools' | 'manual_only';
  defaultSurface: 'sidepanel' | 'standalone';
  // theme is NOT here — display mode (np_theme) + theme pack (np_theme_pack) are the
  // single source of truth in chrome.storage.sync (§17.1a, §15.1, Appendix F).
  // --- RICH persona (reconciliation R2: user config, NOT a fact) ---
  personaId?: string;
  personaOverrides?: {
    name?: string;
    tone?: 'professional-warm' | 'concise' | 'friendly';
    brevity?: 'brief' | 'balanced' | 'detailed';
  };
}
