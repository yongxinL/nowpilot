# NowPilot — v1 Requirements

**Defined:** 2026-08-19
**Core value:** AI chat and a personal knowledge base that work together, locally-first, so a support engineer can capture knowledge once and retrieve it with citations — without any data leaving their machine unless they opt in. (Source: `.planning/PROJECT.md` §Core Value.)
**Single source of truth:** `.planning/PRODUCT_SPEC_v0_1.md` (rev 2026-08-12). Planning artifacts never invent scope, paths, or types beyond it.

---

## Conventions

### ID strategy

- **Spec-native IDs are reused verbatim** from the product spec: `RICH-*`, `AGT-*`, `CTX-*`, `MEM-*`, `KNW-*`, `TOL-*`, `EVAL-*`, `EVO-*`, `PROP-*`, `COLLAB-*`, `MM-*`, `CAT-*`, `LLM-WIKI-*`, `SYNC-*`, `NMEM-*`, `WIKI-ID-*`, `OKF-WIKI-*`, `APPR-*`, `NOTES-COL-*`. Never invent variants (e.g., not `AGT-2`, not `agt-01`).
- **`REQ-F*` IDs are minted only for §9 features that lack a native ID.** Reserved range avoids the research-derived `REQ-R01…REQ-R25` IDs in `.planning/RESEARCH-RECONCILIATION.md` §D. `REQ-F01…REQ-F54` (54 IDs) covers Side Panel features (§9.1), Standalone view features (§9.2), Options Page sections (§9.3), the Write add-on (§9.5), the TeamGQM add-on (§9.6), the ServiceNow add-on (§9.7), and the Research global tool (§9.8).
- **`D-*` records** (§23, §27.8) and **ADR records** (`.planning/adr/`) are constraints/ADRs, not requirements.
- **§12 component-state strings** attach as acceptance criteria on feature requirements, not standalone requirements.

### Priority

- Priorities (`P0`, `P1`, `P2`) are taken verbatim from the spec. `P0` = must-have · `P1` = should-have · `P2` = nice-to-have.
- Phase-15 RICH items use sub-wave labels (15.3 P0 core · 15.4 P1 enhance · 15.5 P2 polish) inherited from spec §18.

### Traceability

- Every v1 requirement maps to **exactly one phase** (1–19) in spec §18.
- Phase 1 builds on the existing scaffold (validated requirements in PROJECT.md §Requirements → Validated), not a rebuild. UI shells, stores, runtime, registries, AI service are already in `src/`.
- Coverage validation is enforced in the §Traceability table below; unmapped count must be zero.

---

## v1 Requirements — Spec-Native IDs

### §17.1a Appearance Settings (APPR-01…06) — Phase 15

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| APPR-01 | P1 | Theme controls live in Options → General → Appearance (Standalone view only). The Side Panel has no theme UI; it follows the shared setting live. |
| APPR-02 | P1 | A single `Segmented` (or `Radio.Group`) with three options — Light · Dark · Auto — bound to `ThemeMode`. "Auto" follows `prefers-color-scheme`. Default is Auto. |
| APPR-03 | P1 | The selection writes only to `chrome.storage.sync.np_theme` (§15.1). A thin `chrome.storage`-backed Zustand `ThemeStore` (Appendix F) mirrors it, and `chrome.storage.onChanged` propagates the change to both surfaces immediately (no reload, no per-surface copy). There is no `themeMode` field on `UserPreferences` — that would create a second source of truth. |
| APPR-04 | P1 | On change, each surface re-derives its AntD config via `getAntdConfig({ mode, pack, compact })` and switches `theme.darkAlgorithm`/`defaultAlgorithm` plus the selected pack's token overlay. Because antd v6 uses pure CSS variables, the switch is real-time — no component remount, no `.dark` class manipulation. |
| APPR-05 | P1 | Compact vs default density is fixed per surface (Side Panel = compact, Standalone view = default). Appearance controls colour scheme only; a density toggle is out of scope. |
| APPR-06 | P1 | In addition to the Light/Dark/Auto display mode, a Theme pack selector ships in v0.1: a `Select` with Default · Liquid Glass · Claude Warm, bound to `chrome.storage.sync.np_theme_pack` (§15.1). Display mode and theme pack are orthogonal (3 modes × 3 packs = 9 valid appearances). Both write only to `chrome.storage.sync` and propagate to both surfaces via `chrome.storage.onChanged`. Every pack must pass WCAG AA (§17.6) in both light and dark before shipping. |

### §17.2c Notes Page Columns (NOTES-COL-01…03) — Phase 15

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| NOTES-COL-01 | P1 | The header has three segmented toggle buttons — Directory · Notes · Inspector (`colorPrimary` when active) that show/hide columns 1, 2, and 4. Column 3 is the persistent centre and cannot be hidden. |
| NOTES-COL-02 | P1 | Each collapsible column also has an inline collapse chevron in its own header (`«` left columns, `»` Inspector), kept in sync with the header toggles. |
| NOTES-COL-03 | P1 | Collapsed columns animate width→0 (150–200 ms) and the centre editor reflows to fill. State persists per surface. At narrow Standalone widths, auto-collapse Directory first, then Inspector, keeping Notes + content. |

### §17.7 RICH — Role (RICH-R-01…11)

| ID | Priority | Phase | Description (verbatim from spec) |
|---|---|---|---|
| RICH-R-01 | P0 | Phase 3 | Persona profile in `src/core/ai/persona/PersonaProfile.ts`: Identity (name, tagline, domain); Personality core (privacy-first, helpful, precise, humble); behavioral drivers (prefers clarifying questions over guessing, cites sources); Language style (professional-warm, technical-accessible, concise-by-default); Emotional repertoire (empathy, encouragement, curiosity). |
| RICH-R-02 | P0 | Phase 3 | `PersonaInjector` injects persona into system prompts across all AI calls. Depends on R-01. |
| RICH-R-03 | P1 | Phase 15 | "Meet NowPilot" character-introduction card as onboarding Step 1 (Flow 9). Depends on R-01. |
| RICH-R-04 | P2 | Phase 15 | Persona editor in Options → Persona (name, tone, brevity). Depends on R-01. |
| RICH-R-05 | P1 | Phase 8 | Persona persists across sessions/surfaces. Stored in PreferenceMemoryStore (`np_persona`), NOT the fact store (reconciliation R2). Depends on R-01. |
| RICH-R-06 | P1 | Phase 15 | Sentiment-aware framing (acknowledge frustration before solutions). Via persona prompt, no separate sentiment pipeline. Depends on R-02. |
| RICH-R-07 | P2 | Phase 15 | Progress celebration on milestone. Depends on R-02. |
| RICH-R-08 | P1 | Phase 15 | Humble error recovery (brief apology + alternative, not defensive). Depends on R-02. |
| RICH-R-09 | P1 | Phase 3 | Chat and Agent share the same persona. Depends on R-02. |
| RICH-R-10 | P1 | Phase 3 | Persona-consistent system prompt per pipeline stage (Planner/Executor/Renderer). Depends on R-02. |
| RICH-R-11 | P0 | Phase 15 | Consistent avatar/visual identity across surfaces and modes. |

### §17.7 RICH — Intention (RICH-I-01…14) — Phase 15

| ID | Priority | Sub-wave | Description (verbatim from spec) |
|---|---|---|---|
| RICH-I-01 | P0 | 15.3 | Interactive Welcome Card grid (4–6 capability cards: Summarize page / Draft response / Research incident / Explain code / Write script / Analyze sentiment); each has icon+title+description; click populates the Sender. |
| RICH-I-02 | P1 | 15.4 | Cards sorted: most-used first, then contextual (page URL/hostname). Depends on I-01. |
| RICH-I-03 | P1 | 15.4 | Cards respect persona (persona-aware greeting). Depends on I-01, R-01. |
| RICH-I-04 | P2 | 15.5 | Dismiss/don't-show-again toggle. Depends on I-01. |
| RICH-I-05 | P0 | 15.3 | 2–3 context-aware quick actions above the Sender when a page is pinned (ServiceNow incident/KB/generic mappings). Depends on PageContextBridge (§26). |
| RICH-I-06 | P0 | 15.3 | Horizontal scrollable chip/pill strip between last message and Sender. Depends on I-05. |
| RICH-I-07 | P2 | 15.5 | "More" expander. Depends on I-05. |
| RICH-I-08 | P1 | 15.4 | Lightweight `IntentClassifier` (URL-pattern → suggestion mapping), no LLM call. Depends on I-05. |
| RICH-I-09 | P1 | 15.4 | Browsable prompt-template catalog (Writing/Analysis/Research/Coding/Support); select populates Sender. |
| RICH-I-10 | P1 | 15.4 | Sender "Templates" popover (categories + recent). Depends on I-09. |
| RICH-I-11 | P2 | 15.5 | Recently-used first. Depends on I-09. |
| RICH-I-12 | P2 | 15.5 | After first 3 messages: "/" commands tip. |
| RICH-I-13 | P2 | 15.5 | On 5th session: Agent-mode hint. |
| RICH-I-14 | P2 | 15.5 | All tips "Got it" dismissible + tracked in memory. |

### §17.7 RICH — Conversation (RICH-C-01…15) — Phase 15

| ID | Priority | Sub-wave | Description (verbatim from spec) |
|---|---|---|---|
| RICH-C-01 | P0 | 15.3 | On ambiguous intent, ask a focused question + 2–4 option chips before executing; chips inject into Sender. Uses existing `ask_clarification` branch (§1.2) — no schema change. Depends on PlannerService. |
| RICH-C-02 | P0 | 15.3 | Detection rules: missing target / ambiguous reference / under-specified. Depends on C-01. |
| RICH-C-03 | P0 | 15.3 | Max 2 clarification rounds, then best-effort + caveat. Depends on C-01. |
| RICH-C-04 | P0 | 15.3 | Chips as interactive Button components in the Bubble, 2–4 max. Depends on C-01. |
| RICH-C-05 | P0 | 15.3 | 1–3 contextual follow-up chips after a response. Depends on PlannerService. |
| RICH-C-06 | P0 | 15.3 | "Follow up" divider separating suggestions. Depends on C-05. |
| RICH-C-07 | P0 | 15.3 | Tapping a chip sends it as the next user message. Depends on C-05. |
| RICH-C-08 | P0 | 15.3 | Non-blocking fast suggestion model, graceful timeout → no chips. Depends on C-05. |
| RICH-C-09 | P1 | 15.4 | Closure zone after 5 s idle: "Did this help?" 👍/👎 + "Anything else?". |
| RICH-C-10 | P2 | 15.5 | Feedback logged anonymously (no user-identifiable data). Depends on C-09. |
| RICH-C-11 | P2 | 15.5 | "Save this conversation" when ≥3 exchanges. Depends on C-09. |
| RICH-C-12 | P1 | 15.4 | Inline confirmation chip for side-effect chat actions ("I'll search the web. [Proceed] [Cancel]"). Depends on PermissionDialog (Phase 17). |
| RICH-C-13 | P1 | 15.4 | Read-only actions execute immediately. Depends on C-12. |
| RICH-C-14 | P1 | 15.4 | Empty-state greeting with user name + time-of-day. Depends on UserMemoryStore/PreferenceMemoryStore. |
| RICH-C-15 | P2 | 15.5 | Greeting includes contextual elements (page title, recent summary). Depends on C-14. |

### §17.7 RICH — Hybrid UI (RICH-H-01…20) — Phase 15

| ID | Priority | Sub-wave | Description (verbatim from spec) |
|---|---|---|---|
| RICH-H-01 | P0 | 15.3 | Branded, dismissible AI header bar (name, avatar, tagline). Depends on R-01. |
| RICH-H-02 | P1 | 15.4 | Brand badge on responses. |
| RICH-H-03 | P1 | 15.4 | Agent ThoughtChain header: "NowPilot is working…". Depends on H-01. |
| RICH-H-04 | P0 | 15.3 | Code-block inline actions: "Copy code"; "Insert into page" = CLIPBOARD-ONLY in v0.1 (reconciliation R1); "Save as macro". |
| RICH-H-05 | P1 | 15.4 | Structured outputs get "Export as CSV" / "Copy as table". |
| RICH-H-06 | P1 | 15.4 | "Save to note" promoted to a first-class button on every assistant message. |
| RICH-H-08 | P0 | 15.3 | Streaming stage indicators: "Reading page context…" → "Planning response…" → "Generating…" as pills. Depends on ChunkBuffer (Appendix J). |
| RICH-H-09 | P2 | 15.5 | Stage expand toggle for detail. Depends on H-08. |
| RICH-H-10 | P2 | 15.5 | Slow-stream (>3 s) "Still working…" indicator. Depends on ChunkBuffer. |
| RICH-H-11 | P1 | 15.4 | Standalone view split-pane: left 60% chat, right 40% Context panel; toggle. |
| RICH-H-12 | P1 | 15.4 | Right-pane tabs: Context / Notes / Tools. Depends on H-11. |
| RICH-H-13 | P2 | 15.5 | Split-pane layout persistent. Depends on H-11. |
| RICH-H-14 | P2 | 15.5 | Inline notes Q&A layout. Depends on notes CRUD (Phase 8). |
| RICH-H-15 | P2 | 15.5 | `@` mention (`@note:`, `@tab:`, `@prompt:`) + autocomplete. Depends on SlashCommandRegistry. |
| RICH-H-16 | P1 | 15.4 | Image-paste attach. |
| RICH-H-17 | P2 | 15.5 | Voice input (Web Speech, input only; TTS output deferred). |
| RICH-H-18 | P2 | 15.5 | TL;DR expand/collapse for long responses (>500 chars). |
| RICH-H-19 | P2 | 15.5 | Step-cards with checkoff for numbered/step lists. |
| RICH-H-20 | P2 | 15.5 | Sticky table headers + horizontal scroll (XMarkdown). Depends on CHAT-07. |

> **Boundary note (R1):** RICH-H-07 ("Fill this field…" page write-back) is **deferred to v0.2+** — see §Out of Scope and §v2 Requirements below.

### §27.1 Category System (CAT-01…05) — Phase 9

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| CAT-01 | P0 | Path-based `categoryPath` (e.g. `InfoTech/Database/MySQL`), `/` separator, no leading/trailing slashes; segments normalized (no empty, no `.`/`..`, trim). |
| CAT-02 | P0 | NoteList tree view grouped by category; "Uncategorized" node; click node → flat list within category. |
| CAT-03 | P0 | LLM suggests a category path during auto-tagging (LLM receives existing distinct category paths + note content). User accept/edit/dismiss. |
| CAT-04 | P0 | On backup, a note at `InfoTech/Database/MySQL` saves as `InfoTech/Database/MySQL/Note Title.md`; nested folders auto-created. |
| CAT-05 | P0 | Normalize on save (strip leading/trailing slashes, collapse duplicates, trim segments); invalid segments flagged (AntD red border). |

### §27.2 LLM Features (LLM-WIKI-01…11) — Phase 9

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| LLM-WIKI-01 | P0 | On save, one fast-tier, temperature-0 call returns ≤5 tags + 1 categoryPath (or null) + a 1–2 sentence summary (+ memory facts, NMEM-02). Rendered as accept/reject Tags + inline category input. |
| LLM-WIKI-02 | P0 | Independent toggles in Options → Notes (`np_notes_llm_features`: autoTag, autoCategorize, autoSummary, aiSearch). When off, no LLM call on save. |
| LLM-WIKI-03 | P0 | Optional `summary` field; displayed as secondary text in NoteList. |
| LLM-WIKI-04 | P0 | "Regenerate tags/summary" toolbar button; re-runs the combined call in place. |
| LLM-WIKI-05 | P0 | Natural-language search: MiniSearch fuzzy → if <3 results or "AI Search", a fast call reranks top-10 by semantic relevance ("AI-enhanced" indicator). No embeddings/vector store. |
| LLM-WIKI-06 | P0 | "Ask your notes" RAG: MiniSearch top-5 + memory facts (NMEM-01) → balanced-tier synthesis with per-statement citations → ephemeral @ant-design/x Bubble with clickable citation Tags (Flow 13). |
| LLM-WIKI-07 | P0 | "Save to note" on any assistant message → `NoteChatConverter` drafts title/content/tags/wikilinks/categoryPath → pre-filled NoteEditor for review (user is gatekeeper). |
| LLM-WIKI-08 | P0 | Staleness: `summaryGeneratedAt`/`tagsGeneratedAt` vs `updated` → subtle "Content has changed — [Regenerate tags/summary]" hint. |
| LLM-WIKI-09 | P0 | Orphan detection (algorithmic, no LLM): 0 wikilinks + 0 backlinks → "Orphan" badge + "Find context" (triggers RAG). |
| LLM-WIKI-10 | P0 | "Re-analyze all notes" (Options → Notes), user-initiated only, sequential; updates stats in real time. |
| LLM-WIKI-11 | P0 | Suggestion confidence gating. Every enrichment item the model returns (`memoryFacts[]`, suggested `tags[]`, suggested wikilinks) carries a self-reported `confidence` in `[0,1]`. Items below `NOTE_SUGGESTION_DISPLAY_THRESHOLD = 0.60` are never surfaced to the user. |

> **Note:** §18 Phase 9 lists "LLM-WIKI-01…10"; §27.2 (canonical definition) defines LLM-WIKI-01…11. The canonical set is 01…11 and is used here.

### §27.3 One-Way Filesystem Sync (SYNC-01…11) — Phase 9

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| SYNC-01 | P0 | "Set backup folder" via `showDirectoryPicker()` (Standalone view only); FileSystemDirectoryHandle persisted in `notes_backup_config` IndexedDB store (cannot use chrome.storage.local — handles are non-serializable). |
| SYNC-02 | P0 | On NotesPage mount, verify `handle.queryPermission()`; if denied/missing → sync disabled + banner "Backup folder not accessible. [Re-select folder] [Dismiss]". |
| SYNC-03 | P0 | Per-save write/update/delete of the `.md` file; fire-and-forget (no loading state); 50 ms debounce prevents rapid-save bursts. |
| SYNC-04 | P0 | File path: `{categoryPath}/{title}.md`; empty categoryPath → root folder; filename sanitized: `/ \ : * ? " < > |` → `_`. Each file is a UTF-8 Markdown document with an OKF v0.2-compatible YAML frontmatter block followed by the Markdown body. |
| SYNC-05 | P0 | Title collision (same title + same category) → numeric suffix: `My Note.md`, `My Note (1).md`, … Scan existing files for highest suffix before writing. |
| SYNC-06 | P0 | External-change detection: if file lastModified newer than last sync (2 s tolerance) → confirm "Overwrite with app version? [Overwrite] [Skip]", default Skip. |
| SYNC-07 | P0 | No backup folder → all sync ops are no-ops; toolbar indicator "Backup: off [Configure]". |
| SYNC-08 | P0 | Status Tag: green "Backup: On" / gray "Backup: Off" / red "Backup: Error" (tooltip shows last error). |
| SYNC-09 | P0 | "Restore from backup" via `showDirectoryPicker()` → walk tree → parse `.md` frontmatter → upsert: id exists → update (preserve updated if newer); id missing → create; additive (notes not in folder are NOT deleted); categoryPath reconstructed from folder path. |
| SYNC-10 | P0 | Restore preview modal: "Found 24 notes (12 new, 3 updated, 9 unchanged). Proceed? [Import] [Cancel]". |
| SYNC-11 | P0 | Delete-on-sync: deleting a note removes its `.md`; if the nested category folder becomes empty it is removed (clean backup). |

### §27.4 Memory ↔ Notes Integration (NMEM-01…03) — Phase 9

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| NMEM-01 | P0 | Memory-aware RAG: "Ask notes" retrieval also queries MemoryEngine for relevant user facts/preferences; highly relevant facts are included as context alongside note snippets. |
| NMEM-02 | P0 | On save, the same LLM call extracts memory-worthy facts (MemoryExtractor schema) → routed through MemoryEngine for conflict resolution + storage. Notes → Memory only (D-05). Runs on the primary surface only (§13). |
| NMEM-03 | P0 | "Save from chat" (LLM-WIKI-07) uses conversation messages AND `MemoryEngine.assemble()` facts to produce a richer draft. |

### §27.7a Note Identity (WIKI-ID-01…04) — Phase 9

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| WIKI-ID-01 | P0 | A note's `id` is a `crypto.randomUUID()` assigned at creation and never changes — not on rename, move (category change), or filesystem restore. The `title` is mutable display text; the `id` is the stable referent. |
| WIKI-ID-02 | P0 | Authors type human-readable `[[Title]]` in the markdown body. On save, `LinkParser.parseLinks()` extracts the raw targets and `resolveLinks()` maps each to a note ID via the resolution order. Resolved targets go to `links[]` (IDs). |
| WIKI-ID-03 | P0 | A `[[Title]]` with no matching note resolves to no ID and is recorded in the source note's `unresolvedLinks[]`. The editor renders unresolved links distinctly. When a matching note is later created, a save-time reconciliation pass promotes matching `unresolvedLinks[]` entries into `links[]`. |
| WIKI-ID-04 | P0 | Deleting a note does not rewrite source bodies; the referencing edges become dangling and are moved from `links[]` back into `unresolvedLinks[]` on those notes at the next save/graph rebuild. Filesystem restore (§27.3) reconstructs IDs from YAML frontmatter, so round-tripping a vault preserves every edge. |

### §18 OKF v0.2 alignment (OKF-WIKI-01…04) — Phase 9

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| OKF-WIKI-01 | P1 | NoteFileSync emits OKF-required `type` (default `Note`) + recommended `description` (= `Note.summary` when present). |
| OKF-WIKI-02 | P1 | NoteFileSync emits the OKF trust/lifecycle families `generated: { by, at }` (ISO 8601) and `status` (`draft`\|`stable`, default `stable`). |
| OKF-WIKI-03 | P1 | `Note.id` (UUID) is emitted and parsed as an OKF extension key; a write→restore round-trip preserves it and every wikilink edge (WIKI-ID-01/04 unchanged). |
| OKF-WIKI-04 | P0 | v0.1 boundary — NoteFileSync does NOT emit OKF standard-markdown-link edges and does NOT adopt path-as-identity; wikilinks + UUID identity remain authoritative (verified in Phase 9 DONE-when, §18). Strict-OKF link/identity conformance (+ sources/verified families) is deferred to v0.2+ behind a dedicated ADR. |

> **Boundary framing:** OKF-WIKI-04 is an **active v0.1 boundary** (a *prohibition* verified in Phase 9), counted in the Phase-9 set above. Only the positive *feature* — strict OKF standard-markdown-link edges + path-as-identity + `sources`/`verified` provenance families — is deferred to v0.2+ (see §v2 Requirements).

### §28.2 Agent reliability requirements (AGT-01…04) — Phase 4

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| AGT-01 | P0 | Add explicit trajectory states: assembling-context, planning, waiting-for-permission, executing, verifying, replanning, rendering, completed, failed, aborted. |
| AGT-02 | P0 | Side-effecting success requires `CompletionEvidence`. Renderer must not claim execution without matching evidence. |
| AGT-03 | P0 | Every turn produces a structured `AgentTurnOutcome`; cap exhaustion is partial, not successful. |
| AGT-04 | P0 | Replanning follows a deterministic retry/terminal policy: at most one replan per failed tool within the tier's planner cap; a repeated identical failure, a cap breach, or an abort is terminal and yields a `partial` or `failed` `AgentTurnOutcome` — never a silent success. |

### §28.3 Trust-aware context requirements (CTX-01…06) — Phase 7

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| CTX-01 | P0 | Context sources carry relevance, freshness, trust, sensitivity, and instruction-authority metadata. |
| CTX-02 | P0 | Page, note, memory, upload, and tool output are untrusted data and cannot redefine system/tool/permission policy. |
| CTX-03 | P0 | `ContextProvenanceManifest` becomes a context receipt with inclusion, omission, original/final tokens, compression, and cache eligibility. |
| CTX-04 | P0 | Stable prefix snapshot tests are mandatory. |
| CTX-05 | P1 | Skills use progressive disclosure; irrelevant full instructions consume zero prompt tokens. |
| CTX-06 | P1 | Diagnostics track context quality without persisting raw sensitive text. |

### §28.4 Memory and knowledge governance (MEM-01…05, KNW-01) — Phase 10

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| MEM-01 | P0 | Memory taxonomy includes working, episodic, semantic, preference, and procedural records. |
| MEM-02 | P0 | Durable memories require source, confidence, lifecycle, sensitivity, and verification timestamps. |
| MEM-03 | P0 | Conflict precedence is explicit correction > verified current state > prior explicit memory > inference. |
| MEM-04 | P0 | User controls include view, source, confidence, edit, pin, forget, type disable, export, and cloud exclusion. |
| MEM-05 | P1 | Procedural experience is stored separately and activated only after verification and approval. |
| KNW-01 | P1 | Graph edges record explicit, imported, suggested, or accepted provenance. |

### §28.5 Tool governance (TOL-01…06) — Phase 18

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| TOL-01 | P0 | Every tool has a `ToolCapabilityManifest` with category, risk, side effect, permissions, scopes, timeout, cost, idempotency, verifier, and schema hashes. |
| TOL-02 | P0 | Permission policy is risk- and side-effect based. |
| TOL-03 | P0 | Side-effecting tools define postcondition verification. |
| TOL-04 | P0 | Tool results are validated, redacted, size-limited, shaped, and attributed before context injection. |
| TOL-05 | P0 | Every write tool is replay-safe through idempotency. |
| TOL-06 | P1 | Tool registries use active discovery when schemas exceed the tools budget. |

> **Boundary:** TOL-07 (resumable long-running contract) is P2 / future — deferred; see §v2 Requirements.

### §28.6 Evaluation requirements (EVAL-01…07) — Phase 12

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| EVAL-01 | P0 | Maintain versioned golden suites for planner, context, tools, permissions, providers, memory, RAG, completion evidence, and multimodal routing. |
| EVAL-02 | P0 | Use a trajectory rubric with separate outcome, process, safety, grounding, memory, quality, latency, and cost dimensions. |
| EVAL-03 | P0 | Prefer deterministic environment/process validators; use calibrated LLM judges only for qualitative dimensions. |
| EVAL-04 | P0 | Diagnostics assign the first failing layer. |
| EVAL-05 | P0 | Safety, leakage, injection, false-completion, citation, and isolation regressions block release. |
| EVAL-06 | P1 | Report cost/latency/quality Pareto comparisons. |
| EVAL-07 | P1 | Calibrate and version LLM judges. |

### §28.7 Verified evolution (EVO-01…06) + §28.7a Candidate Proposer (PROP-01…06) — Phase 13

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| EVO-01 | P1 | Verified trajectories create candidates, never direct production changes. |
| EVO-02 | P1 | Each candidate targets one layer: knowledge, retrieval, instruction, experience, tool, workflow, or model tier. |
| EVO-03 | P1 | `EvolutionCandidate` stores evidence, baseline, candidate, security, version, status, and rollback. |
| EVO-04 | P0 | Untrusted/raw content cannot directly update active prompts, tools, permissions, code, or procedural memory. |
| EVO-05 | P1 | Candidate activation requires sandbox evaluation, approval, scoped rollout, monitoring, and rollback. |
| EVO-06 | P2 | Agent-generated tools remain sandbox proposals and cannot self-publish. |
| PROP-01 | P1 | The proposer's only inputs are failed golden-suite results carrying a `FailureLayer` (EVAL-04) and the `AITransactionLog` evidence for those operations. |
| PROP-02 | P1 | Each proposal targets exactly one layer, mapped deterministically from `FailureLayer` → candidate `targetLayer` (EVO-02). |
| PROP-03 | P1 | A proposal is emitted only when the weakness clears an evidence threshold (≥3 failing trajectories agree, rubric-score drop ≥ 0.15). |
| PROP-04 | P1 | Every proposal carries a cost cap; if projected sandbox cost exceeds `PROPOSE_MAX_EVAL_TOKENS` (default 50 000), the proposal is marked `deferred`, not run. |
| PROP-05 | P0 | The proposer only proposes. It emits `status: 'proposed'` candidates and can never activate, scope-roll, or write them into active prompts/tools/permissions/procedural memory. |
| PROP-06 | P1 | Every proposal is reproducible: eval-suite version, contributing `operationId`s, content hash. |

> **Boundary note (EVO-06):** EVO-06 is an **active v0.1 prohibition** — agent-generated tools remain sandbox proposals and cannot self-publish. Its Phase-13 acceptance is that **no self-publish path exists** (§28.7). Only the future self-publishing *capability* is v2; the guard ships in v0.1.

### §29.2 Multimodal Input (MM-01…06) — Phase 16

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| MM-01 | P1 | Define `ModalityInput` for text, image, audio, and document references. Binary payloads never enter prompt sections directly. |
| MM-02 | P1 | `ModalityObservation` carries source ID, modality, extracted text/structure, confidence, sensitivity, and timestamps. |
| MM-03 | P1 | Image paste/upload supports screenshot, diagram, table, UI-state, and note-draft use cases through a configured vision-capable model. |
| MM-04 | P1 | Voice input is transcribed into an editable Sender; tool execution requires explicit send/confirmation. |
| MM-06 | P1 | Interruption propagates the existing AbortSignal across transcription, planning, tools, and rendering. |
| MM-07 | P0 | APC-lite does not authorise computer use. Browser automation remains deferred to a separate addendum. |

> **Boundary:** MM-05 (later fast/slow split) is P2 / future — deferred; see §v2 Requirements.

### §30.2 Bounded Multi-Agent Collaboration (COLLAB-01…13) — Phase 14

| ID | Priority | Description (verbatim from spec) |
|---|---|---|
| COLLAB-01 | P1 | Multi-role collaboration requires explicit user/workflow activation or an allowed deterministic complexity policy. Planner recommendation alone cannot silently enable it. |
| COLLAB-02 | P1 | Roles come from a closed `CollaborationRoleRegistry`; each has a role-specific prompt, tool allowlist, context projection, budget, and timeout. |
| COLLAB-03 | P1 | `CollaborationPlan` defines stages, dependencies, roles, total planner/tool/token caps, and deadline. The single-agent default is the one-role plan (`stages.length === 1`). |
| COLLAB-04 | P1 | Roles exchange `AgentHandoffArtifact` values containing summaries, sourced facts, open questions, output references, and completion status. Hidden reasoning is never exchanged or logged. |
| COLLAB-05 | P0 | One coordinator owns sequencing, permission requests, side-effect commits, and termination. |
| COLLAB-06 | P0 | Workers cannot directly write memory/notes, execute side effects, export data, or activate evolution candidates. |
| COLLAB-07 | P1 | High-impact output requires an independent reviewer that did not create the candidate result. |
| COLLAB-08 | P1 | Role failures are contained and may trigger one safe retry, substitution, reduced-confidence continuation, single-agent fallback, or termination. |
| COLLAB-09 | P1 | Staged roles share one OptimizedContext through role-specific projections and typed artefacts; full trajectories are not duplicated across roles. |
| COLLAB-10 | P1 | Collaboration traces record roles, policies, supplied sources, handoffs, tools, permissions, budgets, reviewer decision, evidence, and termination without raw prompts or hidden reasoning. |
| COLLAB-11 | P1 | A collaborative workflow ships only after evaluation against the single-agent baseline and configured quality/cost/latency/safety gates. |
| COLLAB-12 | P2 | Future isolated parallel workers are allowed only for independent sub-tasks and communicate through validated artefacts or referenced files. |
| COLLAB-13 | P0 | Open-ended agent chat, dynamic unbounded spawning, peer-granted permissions, shared mutable worker memory, and agreement-as-verification are forbidden. |

> **Boundary note (COLLAB-12):** COLLAB-12 is **defined, not implemented** in v0.1 — the types/design leave room for isolated parallel workers, but none ship (§30.6). Its Phase-14 acceptance is that the boundary holds (no unbounded/parallel workers). Only full isolated-worker *execution* is v2.

---

## v1 Requirements — §9 Features Without Native IDs (`REQ-F*`)

### §9.1 Side Panel Features — REQ-F01…REQ-F13

| ID | Priority | Phase | Description (verbatim from spec §9.1) |
|---|---|---|---|
| REQ-F01 | P0 | Phase 15 | Chat — Streaming, abort, slash commands, quick context. _§12 acceptance: ChatPage Loading/Empty/Error/Success strings verbatim (Appendix B STR.chat)._ |
| REQ-F02 | P0 | Phase 15 | Agent — AgentOrchestrator with tier caps + permission prompts. _§12 acceptance: AgentPage state strings verbatim (Appendix B STR.agent)._ |
| REQ-F03 | P0 | Phase 17 | Write add-on page — Draft/rewrite/summarize/customer-update workflows. |
| REQ-F04 | P0 | Phase 17 | TeamGQM add-on page — Quick TeamGQM summary/actions. |
| REQ-F05 | P0 | Phase 1 | Open Standalone view action — Opens standalone.html with workspace handoff (Flow 11). |
| REQ-F06 | P0 | Phase 15 | Provider/model selector — Read-only in side panel — edit lives in Options. |
| REQ-F07 | P1 | Phase 15 | Quick save to note — "Save this response as note" quick action (lightweight, non-LLM). |
| REQ-F08 | P1 | Phase 15 | Slash commands — /write, /ask, /research, etc. |
| REQ-F09 | P1 | Phase 15 | Tab pinning — Max 10 pinned. |
| REQ-F10 | P0 | Phase 17 | Selection → Ask AI — Right-click context menu → opens side panel with selection prefilled. Promoted P1→P0 2026-08-19 (REQ-R24 / RESEARCH-RECONCILIATION.md §F) — #1 habit-forming entry point; assert in Phase 17 acceptance. |
| REQ-F11 | P1 | Phase 15 | Theme toggle — light/dark/auto. (§17.1a wires it in Options → General → Appearance; Side Panel follows shared setting per APPR-03.) |
| REQ-F12 | P1 | Phase 1 | Cmd+K palette — Includes "Open Standalone view". (Shell + Flow 10 command set live in Phase 1 per §18 Phase 1 DONE-when.) |
| REQ-F13 | P1 | Phase 15 | Error toast + "Open Diagnostics" link — Diagnostics lives in Standalone view → Options. |

> **RICH additions to Side Panel (per §9.1):** Persona header (RICH-H-01), Welcome cards (RICH-I-01), Context-aware quick-action chips (RICH-I-05/06), Clarification chips (RICH-C-01), Follow-up chips (RICH-C-05), Streaming stage indicators (RICH-H-08). Mapped to Phase 15.3 above.
>
> **Side Panel exclusions (§9.1):** no Notes editor, DiagnosticsPanel, PromptManager, ProvidersEditor, MCP servers editor, Feature flag editor, Import/Export, LLM-Wiki management, Filesystem Sync config — all live in Standalone view / Options.

### §9.2 Standalone view Features — REQ-F14…REQ-F21

| ID | Priority | Phase | Description (verbatim from spec §9.2) |
|---|---|---|---|
| REQ-F14 | P0 | Phase 15 | Chat (full-screen) — Shares WorkspaceStore + conversation with side panel. _§12 acceptance: ChatPage strings verbatim (both surfaces)._ |
| REQ-F15 | P0 | Phase 15 | Agent (full-screen) — Shares WorkspaceStore + conversation with Chat. _§12 acceptance: AgentPage strings verbatim (both surfaces)._ |
| REQ-F16 | P0 | Phase 15 | Notes — List, editor, wikilinks, backlinks, graph, search, + LLM-Wiki + Filesystem Sync (§27). _§12 acceptance: NotesPage / NoteEditor / NoteGraph + Ask-Notes / Backup-status / Restore state strings verbatim (Appendix B STR.notes)._ |
| REQ-F17 | P0 | Phase 17 | TeamGQM add-on (full-page) — Full workspace for TeamGQM add-on. |
| REQ-F18 | P0 | Phase 15 | Options — See §9.3. |
| REQ-F19 | P0 | Phase 1 | First-run onboarding entry point — If user opens Standalone view without provider configured (+ RICH-R-03 persona card). |
| REQ-F20 | P1 | Phase 1 | Cmd+K palette — Same command set as side panel + Standalone-only commands. |
| REQ-F21 | P1 | Phase 15 | Command "Focus Side Panel" — Programmatically opens side panel for current tab. |

### §9.3 Options Page — REQ-F22…REQ-F35

| ID | Priority | Phase | Section / Description (verbatim from spec §9.3) |
|---|---|---|---|
| REQ-F22 | P0 | Phase 15 | **General** — Account (name/email/log-out); AI access (Service provider select + provider grid → Set-up dialog §17.2d); Appearance (Display mode Light/Dark/Auto + Theme pack Default/Liquid Glass/Claude Warm), display language, font size, side-panel position — see §17.1a. |
| REQ-F23 | P0 | Phase 15 | **Providers** — Add/edit/delete provider configs, test connections, priority order. |
| REQ-F24 | P0 | Phase 15 | **Models** — Per-provider model list + context window override. |
| REQ-F25 | P0 | Phase 15 | **MCP Servers** — Add/enable/disable external MCP servers, view permissions. |
| REQ-F26 | P0 | Phase 15 | **Prompt Templates** — Create/edit/delete prompt templates + `{{variable}}` editor. |
| REQ-F27 | P0 | Phase 15 | **Slash Commands** — Manage slash command → template mapping. |
| REQ-F28 | P0 | Phase 15 | **Memory** — View/edit user memory facts; enable/disable memory. |
| REQ-F29 | P0 | Phase 15 | **Diagnostics** — DiagnosticsPanel, transaction traces, export debug bundle. _§12 acceptance: DiagnosticsPanel state strings verbatim (Appendix B STR.diagnostics)._ |
| REQ-F30 | P0 | Phase 15 | **Import / Export** — Sanitised JSON/ZIP export; import merge; Restore from folder (§27). |
| REQ-F31 | P0 | Phase 15 | **Feature Flags** — Toggle P2 features (webhooks, insights, TTS). |
| REQ-F32 | P0 | Phase 15 | **Add-on Settings** — Namespaced settings per registered add-on. |
| REQ-F33 | P0 | Phase 15 | **Persona** — Edit AI name, tone, brevity (RICH-R-04). |
| REQ-F34 | P0 | Phase 15 | **Notes** — LLM feature toggles, backup folder config, bulk maintenance (§27). |
| REQ-F35 | P0 | Phase 15 | **About** — Version, license, links. |

### §9.5 Write Add-on — REQ-F36…REQ-F39 (Phase 17)

| ID | Priority | Description (verbatim from spec §9.5) |
|---|---|---|
| REQ-F36 | P0 | **Side Panel Page:** `SidePanelWritePage` — quick actions: Rewrite professionally · Summarize · Draft customer update · Draft internal note · Explain technical issue · Create action plan · Generate concise status update. |
| REQ-F37 | P0 | **Skills:** DraftSkill, RewriteSkill, SummarizeSkill, CustomerUpdateSkill. |
| REQ-F38 | P0 | **Input source:** current clipboard, selected text (via SelectionContextMenu), pinned tab context, or free-form text area. |
| REQ-F39 | P0 | **Output:** streamed markdown; user actions include "Copy", "Insert into chat", "Save as note". |

> **Constraint:** Standalone view Write page is not required in v0.1 (side-panel-only). If added later, it must live in `src/addons/write/pages/StandaloneWritePage.tsx`.

### §9.6 TeamGQM Add-on — REQ-F40…REQ-F43 (Phase 17)

| ID | Priority | Description (verbatim from spec §9.6) |
|---|---|---|
| REQ-F40 | P0 | **Side Panel Page:** `SidePanelTeamGQMPage` — compact quick view: Latest TeamGQM digest · Quick action buttons · Link to full page. |
| REQ-F41 | P0 | **Standalone view Page:** `StandaloneTeamGQMPage` — full workspace: History · Reports · Detailed views · Shared workspace context (same conversationId as Chat/Agent). |
| REQ-F42 | P0 | **Skills:** TeamGQMSummarySkill — implementation-specific; this spec defines only the integration shell. |
| REQ-F43 | P0 | **Add-on Settings:** implementation-specific; must validate with a Zod schema. |

### §9.7 ServiceNow Add-on — REQ-F44…REQ-F53 (Phase 17)

| ID | Priority | Description (verbatim from spec §9.7) |
|---|---|---|
| REQ-F44 | P0 | JSESSIONID extraction — Via CookieSessionStore + ServiceNowSessionAdapter. |
| REQ-F45 | P0 | sysparmCK extraction — MAIN-world content script → adapter → CookieSessionStore. |
| REQ-F46 | P0 | Case context extraction — IContextExtractor implementation, extraction-only. |
| REQ-F47 | P0 | Table API client — SNowTableClient uses PROXY_FETCH + RateLimiter. |
| REQ-F48 | P0 | CaseAnalyzerSkill — AI analysis of case details. |
| REQ-F49 | P0 | CatchUpSkill — 24 h activity digest. |
| REQ-F50 | P1 | SentimentSkill — Case communication sentiment. |
| REQ-F51 | P1 | CodeSearchSkill — Map-reduce over scripts; needs ≥ 16K context (§14.4). |
| REQ-F52 | P0 | Side-panel page — Quick case-context view + skill launcher. |
| REQ-F53 | P1 | Full-app page — Detailed case workspace (case table, comments, work notes, skill results). |

> **Out of scope (v0.1) per §9.7:** CaseInsightBox (page-injected UI), serviceNowInjection.ts (Shadow DOM mount), scoped page UI enhancements. ServiceNow value is delivered inside the side panel and Standalone view only.

### §9.8 Research Global Tool — REQ-F54 (Phase 17)

| ID | Priority | Description (verbatim from spec §9.8) |
|---|---|---|
| REQ-F54 | P0 | Lives at `src/addons/global/ResearchSkill.ts`. `inputSchema: { query: string; maxSources?: number }`. Uses in priority order: user-connected MCP web-search server via MCPClient; a built-in web-search MCP tool if configured; graceful failure otherwise — never silently fall back to model-only answers. `outputSchema: { answer: string; sources: Array<{ title: string; url: string; snippet: string }> }`. Subject to PermissionGate and RateLimiter. Surfaced through `/research` slash command in both surfaces. _§12 acceptance: Research state strings verbatim incl. "Research failed: no web-search tool connected. [Open Settings]" (Appendix B STR.tools)._ |

---

## v2 Requirements (deferred from v0.1)

These items are explicitly out of v0.1 per the spec and PROJECT.md "Out of Scope" section. They are listed here as a v2 backlog, not v1 work.

| ID | Source | Description | Why deferred |
|---|---|---|---|
| **RICH-H-07** | spec §17.7.4 | "Fill this field…" page write-back. | §17.7.5 R1 / §0.2 / §25 — host-page write-back requires v0.2+ page-injection architecture. |
| **OKF-WIKI-04** (feature only) | spec §18 Phase 9 rev 2026-08-12 | *Feature deferred:* strict OKF standard-markdown-link edges + path-as-identity + `sources`/`verified` provenance families. | The v0.1 **boundary** (do NOT emit OKF link-edges / path-identity) is active and verified in Phase 9. Only the positive feature is v2 — conflicts with WIKI-ID-01…04; behind a dedicated ADR per §23 / §27.7. |
| **G-1 similar-cases card** | REQ-R22 (RESEARCH-RECONCILIATION §D.1) | Structured similar-cases result card on §9.7 ServiceNow add-on (Table API query → ranked card list with resolution previews). | Not v1 — acceptance criterion for Phase 17 §9.7 per RECONCILIATION §F. (Listed as §9.7 acceptance, not as a top-level requirement.) |
| **G-2 auto-suggest replies** | REQ-R25 (RESEARCH-RECONCILIATION §D.1) | Real-time auto-suggested replies on support copilots. | Spec §25 / §27.9 — needs host-page integration; deferred. |
| **G-5 PDF chat** | REQ-R25 (RESEARCH-RECONCILIATION §D.1) | PDF chat (case data lives in ServiceNow). | Spec §27.9 — correctly deferred. |
| **G-6 source-derived questions** | REQ-R25 (RESEARCH-RECONCILIATION §D.1) | Source-derived question suggestions. | Spec §27.9 — deferred. |
| **Bidirectional filesystem sync** | spec §27.9 | Two-way note ↔ filesystem sync. | Requires polling / Native Messaging. |
| **Browser automation** (feature only) | spec §26.7 / §29.2 MM-07 | *Feature deferred:* "debugger" permission + DebuggerSession manager + automation tools (clickElement / typeText / navigate). | **MM-07 itself is an active v0.1 boundary** counted in Phase 16 ("APC-lite does NOT authorise computer use"). Only the automation *feature* is v2; the APCLiteNode schema is automation-ready but automation does not ship in v0.1. |
| **Page injection (CaseInsightBox / serviceNowInjection.ts)** | spec §0.2 / §25 / R1 | Host-page UI mount via Shadow DOM / case insight boxes. | v0.1 is read-only / extraction-only per §5.6. |
| **Voice output (TTS)** | spec §17.7.7 | TTS output for AI responses. | Input (RICH-H-17) in scope; output deferred. |
| **Multi-modal animated 3D avatar** | spec §17.7.7 | Static identity (RICH-R-11) sufficient. | Over-scoped. |
| **Separate sentiment pipeline** | spec §17.7.7 | Independent sentiment-analysis LLM call. | In-scope framing uses persona prompt (RICH-R-06). |
| **Full NLP intent-parsing pipeline** | spec §17.7.7 | URL/hostname + keyword heuristics sufficient (RICH-I-08). | Not needed. |
| **Drag-and-drop GUI macro builder** | spec §17.7.7 | Not in v0.1. | Out of scope. |
| **Cross-session conversation resumption w/ full replay** | spec §17.7.7 | Deferred. | v0.1 stateless between sessions. |
| **TOL-07** (resumable long-running contract) | spec §28.5 | Future phase. | P2 future contract. |
| **MM-05** (later fast/slow architecture) | spec §29.2 | Separates low-latency interaction from deep reasoning. | P2 future. |

---

## Out of Scope (v0.1)

Verbatim from `.planning/PROJECT.md` §Requirements → Out of Scope:

- **Page injection / host-page UI** (CaseInsightBox, serviceNowInjection.ts, Shadow DOM mount) — deferred to v0.2+ (§0.2, §25, R1).
- **Host-page write-back** ("Fill this field", "Insert into page" = clipboard-only in v0.1) — reconciliation R1, §25.
- **Strict OKF markdown-link edges + path-as-identity + `sources`/`verified` families** — OKF-WIKI-04, deferred to v0.2+ behind a dedicated ADR.
- **Browser automation** (APC-lite ≠ browser automation) — MM-07 P0 boundary, §26.7.
- **ServiceNow value outside side panel / Standalone view** — §9.7 out of scope.
- **Voice output (TTS)** — input (RICH-H-17) in scope, output deferred.
- **Real-time collaboration, webhooks, insights, TTS** — P2 feature flags (§9.3).
- **Multi-modal animated 3D avatar, separate sentiment pipeline, full NLP intent parsing, drag-and-drop GUI macro builder, cross-session conversation resumption with full replay** — §17.7.7.

---

## Traceability

Every v1 requirement maps to exactly one phase. Counts: v1 = 220, mapped = 220, unmapped = 0. **Coverage 100%.** (Includes OKF-WIKI-04 as an active v0.1 boundary in Phase 9; EVO-06 and COLLAB-12 are active v0.1 boundaries counted in Phases 13/14, not v2 features.)

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-F05 | Phase 1 | Pending |
| REQ-F12 | Phase 1 | Pending |
| REQ-F19 | Phase 1 | Pending |
| REQ-F20 | Phase 1 | Pending |
| AGT-01 | Phase 4 | Pending |
| AGT-02 | Phase 4 | Pending |
| AGT-03 | Phase 4 | Pending |
| AGT-04 | Phase 4 | Pending |
| CTX-01 | Phase 7 | Pending |
| CTX-02 | Phase 7 | Pending |
| CTX-03 | Phase 7 | Pending |
| CTX-04 | Phase 7 | Pending |
| CTX-05 | Phase 7 | Pending |
| CTX-06 | Phase 7 | Pending |
| RICH-R-05 | Phase 8 | Complete |
| CAT-01 | Phase 9 | Pending |
| CAT-02 | Phase 9 | Pending |
| CAT-03 | Phase 9 | Pending |
| CAT-04 | Phase 9 | Pending |
| CAT-05 | Phase 9 | Pending |
| LLM-WIKI-01 | Phase 9 | Pending |
| LLM-WIKI-02 | Phase 9 | Pending |
| LLM-WIKI-03 | Phase 9 | Pending |
| LLM-WIKI-04 | Phase 9 | Pending |
| LLM-WIKI-05 | Phase 9 | Pending |
| LLM-WIKI-06 | Phase 9 | Pending |
| LLM-WIKI-07 | Phase 9 | Pending |
| LLM-WIKI-08 | Phase 9 | Pending |
| LLM-WIKI-09 | Phase 9 | Pending |
| LLM-WIKI-10 | Phase 9 | Pending |
| LLM-WIKI-11 | Phase 9 | Pending |
| SYNC-01 | Phase 9 | Pending |
| SYNC-02 | Phase 9 | Pending |
| SYNC-03 | Phase 9 | Pending |
| SYNC-04 | Phase 9 | Pending |
| SYNC-05 | Phase 9 | Pending |
| SYNC-06 | Phase 9 | Pending |
| SYNC-07 | Phase 9 | Pending |
| SYNC-08 | Phase 9 | Pending |
| SYNC-09 | Phase 9 | Pending |
| SYNC-10 | Phase 9 | Pending |
| SYNC-11 | Phase 9 | Pending |
| NMEM-01 | Phase 9 | Pending |
| NMEM-02 | Phase 9 | Pending |
| NMEM-03 | Phase 9 | Pending |
| WIKI-ID-01 | Phase 9 | Pending |
| WIKI-ID-02 | Phase 9 | Pending |
| WIKI-ID-03 | Phase 9 | Pending |
| WIKI-ID-04 | Phase 9 | Pending |
| OKF-WIKI-01 | Phase 9 | Pending |
| OKF-WIKI-02 | Phase 9 | Pending |
| OKF-WIKI-03 | Phase 9 | Pending |
| OKF-WIKI-04 | Phase 9 | Pending |
| MEM-01 | Phase 10 | Pending |
| MEM-02 | Phase 10 | Pending |
| MEM-03 | Phase 10 | Pending |
| MEM-04 | Phase 10 | Pending |
| MEM-05 | Phase 10 | Pending |
| KNW-01 | Phase 10 | Pending |
| EVAL-01 | Phase 12 | Pending |
| EVAL-02 | Phase 12 | Pending |
| EVAL-03 | Phase 12 | Pending |
| EVAL-04 | Phase 12 | Pending |
| EVAL-05 | Phase 12 | Pending |
| EVAL-06 | Phase 12 | Pending |
| EVAL-07 | Phase 12 | Pending |
| EVO-01 | Phase 13 | Pending |
| EVO-02 | Phase 13 | Pending |
| EVO-03 | Phase 13 | Pending |
| EVO-04 | Phase 13 | Pending |
| EVO-05 | Phase 13 | Pending |
| EVO-06 | Phase 13 | Pending |
| PROP-01 | Phase 13 | Pending |
| PROP-02 | Phase 13 | Pending |
| PROP-03 | Phase 13 | Pending |
| PROP-04 | Phase 13 | Pending |
| PROP-05 | Phase 13 | Pending |
| PROP-06 | Phase 13 | Pending |
| COLLAB-01 | Phase 14 | Pending |
| COLLAB-02 | Phase 14 | Pending |
| COLLAB-03 | Phase 14 | Pending |
| COLLAB-04 | Phase 14 | Pending |
| COLLAB-05 | Phase 14 | Pending |
| COLLAB-06 | Phase 14 | Pending |
| COLLAB-07 | Phase 14 | Pending |
| COLLAB-08 | Phase 14 | Pending |
| COLLAB-09 | Phase 14 | Pending |
| COLLAB-10 | Phase 14 | Pending |
| COLLAB-11 | Phase 14 | Pending |
| COLLAB-12 | Phase 14 | Pending |
| COLLAB-13 | Phase 14 | Pending |
| REQ-F01 | Phase 15 | Pending |
| REQ-F02 | Phase 15 | Pending |
| REQ-F06 | Phase 15 | Pending |
| REQ-F07 | Phase 15 | Pending |
| REQ-F08 | Phase 15 | Pending |
| REQ-F09 | Phase 15 | Pending |
| REQ-F11 | Phase 15 | Pending |
| REQ-F13 | Phase 15 | Pending |
| REQ-F14 | Phase 15 | Pending |
| REQ-F15 | Phase 15 | Pending |
| REQ-F16 | Phase 15 | Pending |
| REQ-F18 | Phase 15 | Pending |
| REQ-F21 | Phase 15 | Pending |
| REQ-F22 | Phase 15 | Pending |
| REQ-F23 | Phase 15 | Pending |
| REQ-F24 | Phase 15 | Pending |
| REQ-F25 | Phase 15 | Pending |
| REQ-F26 | Phase 15 | Pending |
| REQ-F27 | Phase 15 | Pending |
| REQ-F28 | Phase 15 | Pending |
| REQ-F29 | Phase 15 | Pending |
| REQ-F30 | Phase 15 | Pending |
| REQ-F31 | Phase 15 | Pending |
| REQ-F32 | Phase 15 | Pending |
| REQ-F33 | Phase 15 | Pending |
| REQ-F34 | Phase 15 | Pending |
| REQ-F35 | Phase 15 | Pending |
| APPR-01 | Phase 15 | Pending |
| APPR-02 | Phase 15 | Pending |
| APPR-03 | Phase 15 | Pending |
| APPR-04 | Phase 15 | Pending |
| APPR-05 | Phase 15 | Pending |
| APPR-06 | Phase 15 | Pending |
| NOTES-COL-01 | Phase 15 | Pending |
| NOTES-COL-02 | Phase 15 | Pending |
| NOTES-COL-03 | Phase 15 | Pending |
| RICH-R-03 | Phase 15 | Pending |
| RICH-R-04 | Phase 15 | Pending |
| RICH-R-06 | Phase 15 | Pending |
| RICH-R-07 | Phase 15 | Pending |
| RICH-R-08 | Phase 15 | Pending |
| RICH-R-11 | Phase 15 | Pending |
| RICH-I-01 | Phase 15 | Pending |
| RICH-I-02 | Phase 15 | Pending |
| RICH-I-03 | Phase 15 | Pending |
| RICH-I-04 | Phase 15 | Pending |
| RICH-I-05 | Phase 15 | Pending |
| RICH-I-06 | Phase 15 | Pending |
| RICH-I-07 | Phase 15 | Pending |
| RICH-I-08 | Phase 15 | Pending |
| RICH-I-09 | Phase 15 | Pending |
| RICH-I-10 | Phase 15 | Pending |
| RICH-I-11 | Phase 15 | Pending |
| RICH-I-12 | Phase 15 | Pending |
| RICH-I-13 | Phase 15 | Pending |
| RICH-I-14 | Phase 15 | Pending |
| RICH-C-01 | Phase 15 | Pending |
| RICH-C-02 | Phase 15 | Pending |
| RICH-C-03 | Phase 15 | Pending |
| RICH-C-04 | Phase 15 | Pending |
| RICH-C-05 | Phase 15 | Pending |
| RICH-C-06 | Phase 15 | Pending |
| RICH-C-07 | Phase 15 | Pending |
| RICH-C-08 | Phase 15 | Pending |
| RICH-C-09 | Phase 15 | Pending |
| RICH-C-10 | Phase 15 | Pending |
| RICH-C-11 | Phase 15 | Pending |
| RICH-C-12 | Phase 15 | Pending |
| RICH-C-13 | Phase 15 | Pending |
| RICH-C-14 | Phase 15 | Pending |
| RICH-C-15 | Phase 15 | Pending |
| RICH-H-01 | Phase 15 | Pending |
| RICH-H-02 | Phase 15 | Pending |
| RICH-H-03 | Phase 15 | Pending |
| RICH-H-04 | Phase 15 | Pending |
| RICH-H-05 | Phase 15 | Pending |
| RICH-H-06 | Phase 15 | Pending |
| RICH-H-08 | Phase 15 | Pending |
| RICH-H-09 | Phase 15 | Pending |
| RICH-H-10 | Phase 15 | Pending |
| RICH-H-11 | Phase 15 | Pending |
| RICH-H-12 | Phase 15 | Pending |
| RICH-H-13 | Phase 15 | Pending |
| RICH-H-14 | Phase 15 | Pending |
| RICH-H-15 | Phase 15 | Pending |
| RICH-H-16 | Phase 15 | Pending |
| RICH-H-17 | Phase 15 | Pending |
| RICH-H-18 | Phase 15 | Pending |
| RICH-H-19 | Phase 15 | Pending |
| RICH-H-20 | Phase 15 | Pending |
| MM-01 | Phase 16 | Pending |
| MM-02 | Phase 16 | Pending |
| MM-03 | Phase 16 | Pending |
| MM-04 | Phase 16 | Pending |
| MM-06 | Phase 16 | Pending |
| MM-07 | Phase 16 | Pending |
| REQ-F03 | Phase 17 | Pending |
| REQ-F04 | Phase 17 | Pending |
| REQ-F10 | Phase 17 | Pending |
| REQ-F17 | Phase 17 | Pending |
| REQ-F36 | Phase 17 | Pending |
| REQ-F37 | Phase 17 | Pending |
| REQ-F38 | Phase 17 | Pending |
| REQ-F39 | Phase 17 | Pending |
| REQ-F40 | Phase 17 | Pending |
| REQ-F41 | Phase 17 | Pending |
| REQ-F42 | Phase 17 | Pending |
| REQ-F43 | Phase 17 | Pending |
| REQ-F44 | Phase 17 | Pending |
| REQ-F45 | Phase 17 | Pending |
| REQ-F46 | Phase 17 | Pending |
| REQ-F47 | Phase 17 | Pending |
| REQ-F48 | Phase 17 | Pending |
| REQ-F49 | Phase 17 | Pending |
| REQ-F50 | Phase 17 | Pending |
| REQ-F51 | Phase 17 | Pending |
| REQ-F52 | Phase 17 | Pending |
| REQ-F53 | Phase 17 | Pending |
| REQ-F54 | Phase 17 | Pending |
| TOL-01 | Phase 18 | Pending |
| TOL-02 | Phase 18 | Pending |
| TOL-03 | Phase 18 | Pending |
| TOL-04 | Phase 18 | Pending |
| TOL-05 | Phase 18 | Pending |
| TOL-06 | Phase 18 | Pending |
| RICH-R-01 | Phase 3 | Pending |
| RICH-R-02 | Phase 3 | Pending |
| RICH-R-09 | Phase 3 | Pending |
| RICH-R-10 | Phase 3 | Pending |

### Phase counts (v1 requirements per phase)

| Phase | v1 requirements | Notes |
|-------|-----------------|-------|
| 1 | 4 | REQ-F05, F12, F19, F20 (workspace handoff, Cmd+K shell, onboarding) |
| 2 | 0 | Infrastructure (WriteJournal, EncryptedStorage, IndexedDB, KeyVault) — no §9 features |
| 3 | 4 | RICH-R-01/02/09/10 (persona runtime foundation) |
| 4 | 4 | AGT-01…04 (agent reliability + evidence) |
| 5 | 0 | Infrastructure (ContextOptimizer, TokenBudget) — no §9 features |
| 6 | 0 | Infrastructure (PageContentService layered extraction) — no §9 features |
| 7 | 6 | CTX-01…06 (trust-aware context + receipts) |
| 8 | 1 | RICH-R-05 (PreferenceMemoryStore np_persona persistence) |
| 9 | 38 | CAT-01…05 · LLM-WIKI-01…11 · SYNC-01…11 · NMEM-01…03 · WIKI-ID-01…04 · OKF-WIKI-01…04 (OKF-WIKI-04 is an active v0.1 boundary, verified in Phase 9) |
| 10 | 6 | MEM-01…05 · KNW-01 |
| 11 | 0 | Infrastructure (AITransactionLog, TraceRedactor, PromptInspector) — no §9 features |
| 12 | 7 | EVAL-01…07 |
| 13 | 12 | EVO-01…06 · PROP-01…06 |
| 14 | 13 | COLLAB-01…13 |
| 15 | 90 | REQ-F01/02/06/07/08/09/11/13/14/15/16/18/21/22/23/24/25/26/27/28/29/30/31/32/33/34/35 · APPR-01…06 · NOTES-COL-01…03 · RICH-R-03/04/06/07/08/11 · RICH-I-01…I-14 · RICH-C-01…C-15 · RICH-H-01…H-20 (excludes H-07) |
| 16 | 6 | MM-01…04, MM-06, MM-07 (excludes MM-05 deferred to v2) |
| 17 | 23 | REQ-F03/04/10/17 · REQ-F36…F54 (Write add-on, TeamGQM, ServiceNow, Research) |
| 18 | 6 | TOL-01…06 (excludes TOL-07 deferred to v2) |
| 19 | 0 | Hardening + release (verification only — no new requirements) |
| **Total** | **220** | Coverage 100% |

---

*Last updated: 2026-08-19 after initialization*
