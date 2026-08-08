// src/core/registry/SidePanelPageRegistry.ts — side-panel page registry (§18
// canonical file; drives the 01-08 shell nav). Extends the generic Registry base
// over PageRegistration. `component` is a lazy string key resolved by the 01-08
// shells — NOT a React import (keeps this module UI-free, Pitfall 4).
// Reconciliation (W-7): this file uses the §18 canonical name
// SidePanelPageRegistry.ts — the plan's page set is the UI-SPEC nav set
// (Chat/Agent/Notes for the side panel; see plan Task 2 parenthetical).
import { Registry } from '@/core/registry/Registry';

export interface PageRegistration {
  id: string;
  label: string;
  icon?: string;
  /** Lazy component key resolved by the 01-08 shells (never a React import). */
  component: string;
}

const SIDE_PANEL_NAV_PAGES: PageRegistration[] = [
  { id: 'chat', label: 'Chat', component: 'ChatPage' },
  { id: 'agent', label: 'Agent', component: 'AgentPage' },
  { id: 'notes', label: 'Notes', component: 'NotesPage' },
];

export class SidePanelPageRegistry extends Registry<PageRegistration> {}

let singleton: SidePanelPageRegistry | null = null;

/**
 * Lazy singleton pre-registered with the UI-SPEC side-panel nav page set
 * (WSPC-04 pattern, 01-05 ThemePackRegistry precedent).
 */
export function getSidePanelPageRegistry(): SidePanelPageRegistry {
  if (singleton === null) {
    singleton = new SidePanelPageRegistry();
    for (const page of SIDE_PANEL_NAV_PAGES) singleton.register(page);
  }
  return singleton;
}
