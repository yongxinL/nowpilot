import { create } from 'zustand';

/**
 * The ephemeral handoff composer draft (D-13 / WR-07 / WR-09).
 *
 * The handoff projection's `composerDraft` field is a **live** path: the
 * target's `apply` adapter writes it here and the Standalone composer consumes
 * it, so the field is no longer validated and then dropped. The slot is memory
 * only — never `chrome.storage.*`, never the URL, never `BroadcastBus`, never a
 * log, diagnostic, export or snapshot (marking convention hard rule 4, which
 * extends D-08 and D-14 to every ephemeral value).
 *
 * The slot is **consume-once** (WR-09): `consumeDraft` reads the pending value
 * and clears the slot in the same step, so a draft that has already reached a
 * composer cannot be applied a second time. The Standalone shell unmounts and
 * remounts the route on every Sider switch, so a slot that outlived its own
 * delivery would restore the handoff draft — and discard the user's edit — on
 * the next visit to the Write route.
 *
 * An empty draft is the ordinary case: the Side Panel composer can be left
 * empty (the composer there is live, but typing in it is optional), and a
 * handoff started from a surface with no composer carries none, so the
 * receiving composer keeps its own content.
 */
interface HandoffComposerDraftState {
  draft: string;
  setDraft: (draft: string) => void;
  consumeDraft: () => string;
}

export const useHandoffComposerDraftStore = create<HandoffComposerDraftState>((set, get) => ({
  draft: '',
  setDraft: (draft: string) => set({ draft }),
  consumeDraft: () => {
    const { draft } = get();
    if (draft) set({ draft: '' });
    return draft;
  },
}));
