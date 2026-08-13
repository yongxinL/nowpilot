# Phase 5: Knowledge Base (Memory + MiniSearch + Notes) — Discussion Log

**Gathered:** 2026-08-13
**Mode:** --auto (auto-advance chain from Phase 04b execute-phase)

## Mode Context

This discussion ran in `--auto` mode as part of the auto-advance chain: Phase 04b executed green → verification passed → transition → auto-discuss Phase 5. Auto-mode selects all gray areas and resolves each with the spec-grounded recommended option (no interactive question calls).

## Gray Areas Selected

`[auto] Selected all gray areas: memory stores & ownership; memory scoring & injection; MiniSearch index strategy; notes core & wikilink resolution; note editor UX; note graph & backlinks; np_persona writer migration; verify gate`

## Decisions Auto-Resolved

| Area | Decision | Basis |
|------|----------|-------|
| Store paths | Six memory modules at §18/§8.5 paths verbatim (R-1) | Spec §18 2752–2790 |
| Ownership | MemoryEngine = single orchestrator; surfaces never touch stores; single-writer primary surface | Spec §3.1/§3.2/§13 |
| Conversation memory | §3.3 shape + turn/summarise rules + §15.3 LRU; reuse MemoryDB rows | Spec §3.3/§15.3 |
| User memory | §3.4 UserMemoryFact; working-memory block lives here as `inferred` | Spec §3.4/§3.6 |
| Scoring | §3.4 verbatim weights, all sub-scores [0,1], deterministic + injectable clock | Spec §3.4 |
| Injection budget | top-5/top-3 tiny, ≤ 1000 tokens, never secrets; degrade per §2.4 | GR-6, §3.4 |
| Injection seam | `ContextOptimizerInput.memoryHints` (exists); hook calls core builder (GR-3) | `ai/types.ts:158`, D-4b-09 |
| Preference injection | compact JSON incl. personaOverrides; feeds existing `preferences` section | Spec §3.5 |
| MemoryExtractor | LLM stage (haiku), primary-surface only, save-time non-blocking; PersonaInjector-routed | GR-3, §22.1 |
| MiniSearch | persistent notes index over title+content+tags+summary; distinct from ephemeral page index | Spec §26.5/§27 |
| Index lifecycle | rebuild on NotesPage mount, incremental on CRUD, in-memory only | Spec §22.1 (≤5000 notes) |
| Page→Note→MiniSearch | `source.kind: 'page-export'` manual save; no LLM in the 5 core path | Note type, SC#5 |
| Wikilink tie-break | exact title → updated desc → id asc (WIKI-ID-02); ID-based edges; unresolved + reconciliation | WIKI-ID-01/02/03 |
| Editor UX | real Notes view replaces E5 placeholder; PortableMarkdown body; manual `[[` autocomplete | §21.2 col 3, D-04 |
| Graph + backlinks | d3-force NoteGraphView + BacklinksPanel, derived edges, click→open | §21.2/§26 |
| np_persona writer | PreferenceMemoryStore becomes writer; Phase-3 accessor read path unchanged | R-7/R2, §3.5 |
| Verify gate | §24 chain per spec line 3685 (tsc + vitest tests/core/memory, /search, LinkParser) | Spec §18 3685 |

## Notes

- All decisions are spec-anchored; the agent's discretion items (exact MemoryEngine API, MiniSearch options, d3-force params, working-memory template) are listed in CONTEXT.md for the planner.
- No interactive questions — auto mode. Decisions are auditable in CONTEXT.md `<decisions>`.
- No scope creep captured; deferred items (LLM-Wiki, FS sync, memory governance, embeddings) tracked in CONTEXT.md `<deferred>` for Phases 5a/5b.

---

*Phase: 5-Knowledge Base (Memory + MiniSearch + Notes)*
*Discussion gathered: 2026-08-13*
