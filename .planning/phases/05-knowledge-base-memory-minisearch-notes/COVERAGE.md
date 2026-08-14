# API Coverage — Phase 5 (Knowledge Base)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

Phase 5 is a gap-closure run: the three BLOCKER gaps (CR-01 star persistence, CR-02 dirty-guard bypass, WR-01 memory budget) and their warning cohort (WR-02..WR-08, IN-01..04) touch existing internal modules only — `WorkspaceStore`, `NotesPage`, `MemoryEngine`, `ContextPack`, `ConversationMemoryStore`, `useStreamingLLM`, `ContextOptimizer`, `WikilinkAutocomplete`, `BacklinksPanel`, `NoteGraphView`. No new external API/SDK/service is integrated by the closure work; the external SDKs already in the approved stack remain as shipped.

| capability | decision | reason |
|---|---|---|
| d3-force (note graph layout) | INTEGRATE | already integrated in 05-08; closure does not alter the layout contract |
| minisearch (notes full-text index) | INTEGRATE | already integrated in 05-05/07; closure does not touch the index surface |
| MiniSearch `searchNotes` scoring (`[0,1]`) | INTEGRATE | unchanged; `[0,1]` normalization preserved |
| IndexedDB (NotesDB/MemoryDB) | INTEGRATE | already integrated; closure adds persistence fields/paths only |
