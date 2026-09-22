import { create } from 'zustand';

/**
 * The ephemeral handoff composer draft (D-13 / WR-07).
 *
 * The handoff projection's `composerDraft` field is a **live** path: the
 * target's `apply` adapter writes it here and the Standalone composer consumes
 * it, so the field is no longer validated and then dropped. The slot is memory
 * only — never `chrome.storage.*`, never the URL, never `BroadcastBus`, never a
 * log, diagnostic, export or snapshot (marking convention hard rule 4, which
 * extends D-08 and D-14 to every ephemeral value).
 *
 * An empty draft is the Phase-1 normal case: the Side Panel's Chat surface is a
 * fixture preview with no composer to type into, so `openStandalone` is called
 * without a draft and the receiving composer keeps its own content.
 */
interface HandoffComposerDraftState {
  draft: string;
  setDraft: (draft: string) => void;
}

export const useHandoffComposerDraftStore = create<HandoffComposerDraftState>((set) => ({
  draft: '',
  setDraft: (draft: string) => set({ draft }),
}));
