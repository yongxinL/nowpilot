# NowPilot

## What This Is

NowPilot v0.1 is a privacy-first Chrome MV3 extension — a local-first AI assistant and personal knowledge platform built with WXT + React 19 + Ant Design v6 / Ant Design X 2.x. It pairs a lightweight Side Panel (chat-only, always accessible) with a full Standalone workspace (chat, agents, notes, options, diagnostics) that runs against user-configured cost-effective providers (OpenAI, Anthropic, Gemini, Ollama) and is built to run entirely offline against local models.

## Core Value

A privacy-first, local-first AI assistant where chat, extracted page content, and a linked notes/knowledge layer combine into a persistent personal workspace — no data leaves the machine unless the user deliberately configures a cloud provider.

## Requirements

### Validated

- **Runtime & shells** — MV3/WXT runtime, WXT-first side panel + standalone entrypoints, AntD theme/design tokens
  *Validated in Phase 01: MV3/WXT Runtime + AntD Shells + Workspace (11/11 plans, 8/8 must-haves verified; RUNTIME-01…05, WSPC-01…05)*
- **Workspace** — shared WorkspaceStore, layout, navigation, dialog framework
  *Validated in Phase 01 (foundation): WorkspaceStore init/start wired at both mounts, WorkspaceSync live via BroadcastBus, M.3 workspaceId scope gate on both inbound paths*
- **Persistence & storage** — IndexedDB (idb) stores, AES-GCM encrypted vault, WriteJournal crash-safe writes, per-key permissioned storage layer, migrate-on-read, sync-quota shadow, import/export core
  *Validated in Phase 02: Storage, Security, WriteJournal, Workspace Persistence (11/11 plans, 10/10 must-haves verified; STORAGE-01…05; code review clean — 2 critical + 10 warning findings resolved)*

### Active

v1 scope, derived from the canonical product spec (`.planning/PRODUCT_SPEC_v0_1.md`) and detailed in `.planning/REQUIREMENTS.md`. Top-level capability areas:
- [ ] **Cost-effective AI runtime** — Vercel AI SDK, Anthropic/SDK provider integrations, Planner→Executor→Renderer orchestration, streaming (SSE + text), cost guardrails (tier caps, monthly budget)
- [ ] **Agent reliability & evidence** — agent-level token budget, CheckpointRecorder, evidence (probe + path), commit-confirm barrier, fallback/recovery
- [ ] **Context-adaptive execution** — context windows, ContextUpdate events, context-aware selection, phase-aware prompting
- [ ] **PageContentService** — content-script extraction (defuddle main content), schema `{title, url, text, metadata}`, TraceRedactor in DOMElems
- [ ] **Trust-aware context** — content-classification, XSS risk screening, prompt-injection quarantine, content trust controls
- [ ] **Knowledge & notes** — atomic note-taking, wikilinks, note graph ([[wiki]] navigation), note views
- [ ] **LLM-Wiki & filesystem sync** — auto-tagging, title→LLM integration, RAG "Ask notes" (MiniSearch), local-FS sync + baseline
- [ ] **Memory governance** — memory cap, decay, privacy-preserving compression
- [ ] **Diagnostics** — transaction logging, Debug Diagnostic Console, execution path inspection
- [ ] **Evaluation** — agent evaluation (checklist + recall + relevance rubrics), evals UI
- [ ] **Verified evolution** — human-verified continual evolution loop (no autonomous self-modification)
- [ ] **Bounded collaboration** — single-agent default = one-role CollaborationPlan; multi-role (User/Planner/Executor/Evidence) opt-in; collaboration manifest + coordination modes
- [ ] **Workspace UX + RICH** — rich chat features, persona, role-play, one-phase-per-response
- [ ] **Multimodal input** — image handling, Ollama vision, VLM integration
- [ ] **Add-ons** — ServiceNow, Write, TeamGQM (first-party)
- [ ] **Tool governance** — tool-calling registry, allowlist, AI-chosen tools, JSONSchema tools
- [ ] **Hardening** — TraceRedactor everywhere, content-script extraction-only, no secrets in logs, `content` bundle < 50KB, release

### Out of Scope

- **Page injection / automation of host pages** — v0.1 content scripts are extraction-only; page injection, click automation, and UI overlays deferred to v0.2+ (privacy + MV3 limitations)
- **PDF chat / extraction** — deferred (parser complexity, cost)
- **Embedding-based semantic search** — MiniSearch is the chosen retrieval; no embeddings in v0.1 (cost model)
- **Bidirectional filesystem sync / live watch** — only one-way local-FS export + baseline diff in v0.1 (correctness risk)
- **TTS audio output** — not part of v0.1 scope
- **A2UI / computer-use autonomy** — not part of v0.1 scope
- **Provider selection as primary config surface** — non-starter; local-first is the core value

## Context

- Greenfield project (no existing source); the authoritative, canonical design contract is `.planning/PRODUCT_SPEC_v0_1.md` (single source of truth — implementing agents must treat it as authoritative and complete).
- Tech stack is fixed by the spec §7: **WXT** (build tool), **React 19**, **TypeScript**, **Ant Design v6** + **Ant Design X 2.x**, **Vercel AI SDK**, **Zustand** (state), **IndexedDB/idb**, **MiniSearch** (no embeddings). Explicitly banned: Tailwind, shadcn/ui, x-sdk, x-card, framer-motion (UI-01..04).
- Cost-effective by design: primary implementation models Haiku / Gemini Flash / DeepSeek Flash; cost controls (tier caps, monthly budget, cheapest-model routing) are a first-class feature, not an afterthought.
- Two UI surfaces share one architecture: **Side Panel** = chat-only thin client; **Standalone view** = full workspace (chat/agent/notes/config/diagnostics, LLM-Wiki + filesystem sync).
- Single-agent default: one-role CollaborationPlan; multi-role bounded collaboration is opt-in — the coordinator-based agent platform (spec §28–§30).
- Continual evolution is human-verified (never autonomous self-modification); every executed plan must be verified before the next phase.
- ServiceNow is a first-party add-on target (enterprise integration).

## Constraints

- **Tech stack**: Approved packages per spec §7 only; banned list enforced (Tailwind, shadcn/ui, x-sdk, x-card, framer-motion).
- **Compatibility**: Chrome MV3 only in v0.1 (service workers, `chrome.tabs`), WXT for unified build.
- **Security**: content scripts extraction-only; never inject into host pages; local-first storage with encryption; TraceRedactor applied to all sensitive flows; no secrets/logs leakage.
- **Performance**: `content` bundle < 50KB; side panel paint < 300ms; first token < 2s (local provider); async non-blocking.
- **Privacy**: no cloud-only paths; Ollama/local providers first-class; everything works offline.
- **Cost**: tier caps per phase; monthly budget enforcement; cheapest-capable routing.
- **Architecture**: Planner→Executor→Renderer orchestration (never maxSteps loops); context-driven selection; agent-level token budget.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Chrome MV3 extension via WXT | Cross-browser build, modern tooling, content-script ergonomics | ✓ Spec §7 |
| React 19 + Ant Design v6 + Ant Design X 2.x | Mature ecosystem; no hand-rolled UI kit; Ant X conversational components | ✓ Spec §7 |
| No Tailwind / shadcn / x-sdk / x-card / framer-motion | Avoid redundant design layers; single design-token system | ✓ Spec UI-01..04 |
| Vercel AI SDK + custom providers | Unified streaming/messaging primitives; provider abstraction for cost routing | ✓ Spec §7 / §3 |
| Planner→Executor→Renderer orchestration (not maxSteps) | Deterministic, cost-controlled, observable execution — not free-running loops | ✓ Spec §3 / ADR |
| Coordinator-based agent platform; single-agent = one-role CollaborationPlan | Matches practical usage; multi-role is opt-in, not default complexity | ✓ Spec §28–§30 |
| Two surfaces (Side Panel + Standalone) sharing WorkspaceStore | Chat access without full workspace; one source of truth | ✓ Spec §1 / ADR |
| Content scripts extraction-only; page injection deferred to v0.2+ | MV3 + privacy constraints; page automation is a separate risk surface | ✓ Spec §26 / ADR |
| IndexedDB (idb) + encrypted vault + WriteJournal (CRDT) | Durable, conflict-safe note/knowledge layer with write-crash recovery | ✓ Spec §13 |
| MiniSearch for retrieval (no embeddings) | Cost model; sufficient for note/knowledge search; embeddings out of scope | ✓ Spec §14 / ADR |
| Local-FS sync = one-way export + baseline (not bidirectional) | Correctness first; bidirectional sync deferred | ✓ Spec §27 / ADR |
| Human-verified continual evolution (never autonomous) | Safety; every plan verified before the next phase | ✓ Spec §24 / ADR |
| ServiceNow, Write, TeamGQM as first-party add-ons | P1 add-ons; architecture supports third-party add-on SDK later | ✓ Spec §25 |

---
*Last updated: 2026-08-09 after Phase 02 completion (/gsd-execute-phase 2 → verification passed, code review clean)*
