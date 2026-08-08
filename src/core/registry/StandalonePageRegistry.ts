// src/core/registry/StandalonePageRegistry.ts — standalone-view page registry
// (§18 canonical file; drives the 01-08 shell nav). Extends the generic Registry
// base over PageRegistration. `component` is a lazy string key resolved by the
// 01-08 shells — NOT a React import (keeps this module UI-free, Pitfall 4).
// Reconciliation (W-7): §18 create list names StandalonePageRegistry.ts — the
// plan's page set is the UI-SPEC nav set (Chat/Agent/Notes/Options for the
// standalone view; see plan Task 2 parenthetical).
import { Registry } from '@/core/registry/Registry';
import type { PageRegistration } from '@/core/registry/SidePanelPageRegistry';

const STANDALONE_NAV_PAGES: PageRegistration[] = [
  { id: 'chat', label: 'Chat', component: 'ChatPage' },
  { id: 'agent', label: 'Agent', component: 'AgentPage' },
  { id: 'notes', label: 'Notes', component: 'NotesPage' },
  { id: 'options', label: 'Options', component: 'OptionsPage' },
];

export class StandalonePageRegistry extends Registry<PageRegistration> {}

let singleton: StandalonePageRegistry | null = null;

/**
 * Lazy singleton pre-registered with the UI-SPEC standalone nav page set
 * (WSPC-04 pattern, 01-05 ThemePackRegistry precedent). Chat is the default
 * landing page (01-08 StandaloneRouter).
 */
export function getStandalonePageRegistry(): StandalonePageRegistry {
  if (singleton === null) {
    singleton = new StandalonePageRegistry();
    for (const page of STANDALONE_NAV_PAGES) singleton.register(page);
  }
  return singleton;
}
